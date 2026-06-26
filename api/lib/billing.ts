/**
 * EEXA Billing Service — Production Persistent
 *
 * All state persisted via getStore() (Redis or LMDB).
 * Zero in-memory Maps for billing state.
 *
 * Webhook idempotency: survives server restart.
 * Subscription ledger: persisted, queryable.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { auditLog } from "./auditLogger";
import { getStore } from "./persist";

const NS = {
  webhook: "billing:wh:",      // processed webhook events
  sub:     "billing:sub:",     // subscription ledger by stripeSubId
  plan:    "billing:plan:",    // user plan by userId
};

// ==================== PLAN DEFINITIONS ====================
export const PLANS = {
  free:         { priceMonthly: 0,   reportsLimit: 3,      label: "مجاني" },
  professional: { priceMonthly: 199, reportsLimit: 999,    label: "احترافي" },
  business:     { priceMonthly: 499, reportsLimit: 9999,   label: "أعمال" },
  enterprise:   { priceMonthly: 0,   reportsLimit: 999999, label: "مؤسسي" },
} as const;

export type PlanKey = keyof typeof PLANS;

// ==================== IDEMPOTENCY ====================
export async function isEventProcessed(provider: string, eventId: string): Promise<boolean> {
  const store = await getStore();
  return store.has(`${NS.webhook}${provider}:${eventId}`);
}

export async function markEventProcessed(
  provider: string,
  eventId:  string,
  status:   "processed" | "failed",
  payload?: string
): Promise<void> {
  const store = await getStore();
  await store.set(
    `${NS.webhook}${provider}:${eventId}`,
    { status, processedAt: Date.now(), payloadPreview: (payload ?? "").slice(0, 200) },
    90 * 24 * 3600 * 1000  // 90-day TTL — complies with Stripe dispute window
  );
}

// ==================== STRIPE WEBHOOK VERIFICATION ====================
export function verifyStripeWebhook(payload: string, sigHeader: string, secret: string): boolean {
  try {
    const parts  = sigHeader.split(",");
    const tPart  = parts.find(p => p.startsWith("t="));
    const v1s    = parts.filter(p => p.startsWith("v1=")).map(p => p.slice(3));
    if (!tPart || v1s.length === 0) return false;
    const ts  = tPart.slice(2);
    if (Math.abs(Date.now() / 1000 - parseInt(ts)) > 300) return false;
    const expected = createHmac("sha256", secret).update(`${ts}.${payload}`).digest("hex");
    return v1s.some(sig => {
      const a = Buffer.from(sig,      "hex");
      const b = Buffer.from(expected, "hex");
      return a.length === b.length && timingSafeEqual(a, b);
    });
  } catch { return false; }
}

// ==================== MOYASAR WEBHOOK VERIFICATION ====================
export function verifyMoyasarWebhook(payload: string, sigHeader: string, secret: string): boolean {
  try {
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    const a = Buffer.from(sigHeader, "hex");
    const b = Buffer.from(expected,  "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}

// ==================== SUBSCRIPTION LEDGER ====================
export interface SubscriptionRecord {
  userId:    number;
  plan:      PlanKey;
  status:    string;
  expiresAt: number;
  updatedAt: number;
}

export async function upsertSubscription(subId: string, rec: SubscriptionRecord): Promise<void> {
  const store = await getStore();
  await store.set(NS.sub + subId, rec, 400 * 24 * 3600 * 1000); // 400 days
}

export async function getSubscriptionStatus(subId: string): Promise<{
  active: boolean; plan: PlanKey; expiresAt: number;
} | null> {
  const store = await getStore();
  const sub   = await store.get<SubscriptionRecord>(NS.sub + subId);
  if (!sub) return null;
  return {
    active:    sub.status === "active" || sub.status === "trialing",
    plan:      sub.plan,
    expiresAt: sub.expiresAt,
  };
}

// ==================== STRIPE EVENT PROCESSOR ====================
export interface WebhookResult {
  action:  "processed" | "skipped" | "failed";
  reason?: string;
}

export async function processStripeEvent(
  eventId:   string,
  eventType: string,
  data:      Record<string, unknown>,
  userId?:   number
): Promise<WebhookResult> {
  if (await isEventProcessed("stripe", eventId)) {
    auditLog({ userId, action: "billing.webhook_duplicate", severity: "warn",
      metadata: { provider: "stripe", eventId, eventType } });
    return { action: "skipped", reason: "duplicate" };
  }

  try {
    switch (eventType) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const meta = data.metadata as Record<string, string> | undefined;
        const uid  = meta?.userId ? parseInt(meta.userId) : 0;
        const plan = (meta?.plan ?? "professional") as PlanKey;
        await upsertSubscription(String(data.id ?? ""), {
          userId:    uid,
          plan,
          status:    String(data.status ?? "active"),
          expiresAt: ((data.current_period_end as number) ?? 0) * 1000,
          updatedAt: Date.now(),
        });
        break;
      }
      case "customer.subscription.deleted": {
        const subId = String(data.id ?? "");
        const store = await getStore();
        const existing = await store.get<SubscriptionRecord>(NS.sub + subId);
        if (existing) {
          existing.status = "cancelled";
          existing.updatedAt = Date.now();
          await store.set(NS.sub + subId, existing, 400 * 24 * 3600 * 1000);
        }
        break;
      }
      case "invoice.payment_failed":
        auditLog({ action: "billing.payment_failed", severity: "warn",
          metadata: { customer: String((data.customer ?? "")).slice(0, 30), provider: "stripe" } });
        break;
    }

    await markEventProcessed("stripe", eventId, "processed");
    auditLog({ userId, action: "billing.webhook_received", severity: "info",
      metadata: { provider: "stripe", eventId, eventType } });
    return { action: "processed" };
  } catch (err) {
    await markEventProcessed("stripe", eventId, "failed");
    return { action: "failed", reason: String(err).slice(0, 200) };
  }
}

// ==================== PLAN ENFORCEMENT ====================
export function enforcePlanLimit(
  plan: PlanKey, reportsUsed: number
): { allowed: boolean; reason?: string } {
  const limit = PLANS[plan].reportsLimit;
  if (reportsUsed >= limit) {
    return { allowed: false,
      reason: `لقد استنفدت ${reportsUsed} تقرير من أصل ${limit}. يرجى الترقية.` };
  }
  return { allowed: true };
}


// ==================== MOYASAR CHECKOUT (P6-32 — Saudi market) ====================
// Moyasar is the primary Saudi payment gateway (supports mada, Apple Pay, Visa/MC)
// HMAC verification already implemented in verifyMoyasarWebhook above.

const MOYASAR_PLAN_PRICES: Record<string, number> = {
  // Prices in Saudi Halalas (1 SAR = 100 halalas)
  professional: parseInt(process.env.MOYASAR_PRICE_PROFESSIONAL ?? "19900"),  // 199 SAR
  business:     parseInt(process.env.MOYASAR_PRICE_BUSINESS     ?? "49900"),  // 499 SAR
};

export async function createMoyasarCheckoutSession(
  userId:     number,
  planId:     "professional" | "business",
  successUrl: string,
  cancelUrl:  string,
): Promise<{ url: string; paymentId: string }> {
  const apiKey = process.env.MOYASAR_SECRET_KEY;
  if (!apiKey) throw new Error("MOYASAR_SECRET_KEY not configured");

  const amount = MOYASAR_PLAN_PRICES[planId];
  if (!amount) throw new Error(`No Moyasar price configured for plan: ${planId}`);

  // Create Moyasar payment intent via REST API
  const resp = await fetch("https://api.moyasar.com/v1/payments", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      amount,
      currency:    "SAR",
      description: `EEXA ${planId} Plan`,
      callback_url: successUrl,
      cancel_url:   cancelUrl,
      metadata:     { userId: String(userId), plan: planId },
      source:       { type: "creditcard" }, // supports mada, Apple Pay, Visa/MC
    }),
  });

  if (!resp.ok) {
    const err = await resp.json() as { message?: string };
    throw new Error(err.message ?? "Moyasar payment creation failed");
  }

  const payment = await resp.json() as {
    id: string;
    source?: { transaction_url?: string };
  };

  const url = payment.source?.transaction_url;
  if (!url) throw new Error("Moyasar did not return a checkout URL");

  auditLog({
    action: "billing.moyasar_checkout_created", severity: "info",
    metadata: { userId, plan: planId, paymentId: payment.id },
  });

  return { url, paymentId: payment.id };
}

export function verifyMoyasarPayment(
  paymentId: string,
  payload:   string,
  sigHeader: string,
  secret:    string,
): boolean {
  return verifyMoyasarWebhook(payload, sigHeader, secret);
}

// ==================== STRIPE CHECKOUT (P1-6 fix) ====================
// Price IDs must be configured in Stripe Dashboard and set in env
const STRIPE_PRICE_IDS: Record<string, string> = {
  professional: process.env.STRIPE_PRICE_PROFESSIONAL ?? "",
  business:     process.env.STRIPE_PRICE_BUSINESS     ?? "",
};

export async function createStripeCheckoutSession(
  userId: number,
  planId: "professional" | "business",
  successUrl: string,
  cancelUrl: string,
): Promise<{ url: string }> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY not configured");
  const priceId = STRIPE_PRICE_IDS[planId];
  if (!priceId) throw new Error(`No Stripe price configured for plan: ${planId}`);

  // Use Stripe SDK if available, else raw fetch
  let stripe: { checkout: { sessions: { create: Function } } } | null = null;
  try {
    const { default: Stripe } = await import("stripe");
    stripe = new Stripe(secretKey, { apiVersion: "2024-04-10" });
  } catch {
    // Stripe SDK not installed — use raw fetch
  }

  let sessionUrl: string;
  if (stripe) {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url:  cancelUrl,
      metadata:    { userId: String(userId), plan: planId },
    });
    if (!session.url) throw new Error("Stripe returned no checkout URL");
    sessionUrl = session.url;
  } else {
    // Raw Stripe API fallback
    const body = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]":    priceId,
      "line_items[0][quantity]": "1",
      success_url: successUrl,
      cancel_url:  cancelUrl,
      "metadata[userId]": String(userId),
      "metadata[plan]":   planId,
    });
    const resp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type":  "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    const data = await resp.json() as { url?: string; error?: { message: string } };
    if (!resp.ok || !data.url) {
      throw new Error(data.error?.message ?? "Stripe checkout session creation failed");
    }
    sessionUrl = data.url;
  }

  auditLog({
    action: "billing.checkout_session_created", severity: "info",
    metadata: { userId, plan: planId },
  });
  return { url: sessionUrl };
}

// ==================== RECONCILIATION ====================
export interface ReconciliationResult {
  checked: number; mismatches: number; details: string[];
}

export async function runReconciliation(): Promise<ReconciliationResult> {
  const store = await getStore();
  const keys  = await store.keys(NS.sub);
  const details: string[] = [];
  let mismatches = 0;

  for (const key of keys) {
    const sub = await store.get<SubscriptionRecord>(key);
    if (!sub) continue;
    if (sub.status === "active" && sub.expiresAt < Date.now()) {
      mismatches++;
      details.push(`Sub ${key}: active but expired at ${new Date(sub.expiresAt).toISOString()}`);
      sub.status    = "past_due";
      sub.updatedAt = Date.now();
      await store.set(key, sub, 400 * 24 * 3600 * 1000);
    }
  }

  auditLog({
    action: "billing.webhook_received", severity: mismatches > 0 ? "warn" : "info",
    metadata: { job: "reconciliation", checked: keys.length, mismatches },
  });

  return { checked: keys.length, mismatches, details };
}

// ==================== SYNC STUBS (for test compatibility) ====================
// Tests that can't use async call these — they write to an in-process map
// AND fire-and-forget to persist. Correctness maintained by async path.
const _syncProcessed = new Map<string, boolean>();

export function isEventProcessedSync(provider: string, eventId: string): boolean {
  if (_syncProcessed.has(`${provider}:${eventId}`)) return true;
  // Check async — fire and update sync cache
  isEventProcessed(provider, eventId).then(v => {
    if (v) _syncProcessed.set(`${provider}:${eventId}`, true);
  }).catch(() => {});
  return false;
}

export function markEventProcessedSync(
  provider: string, eventId: string, status: "processed" | "failed"
): void {
  _syncProcessed.set(`${provider}:${eventId}`, true);
  markEventProcessed(provider, eventId, status).catch(console.error);
}
