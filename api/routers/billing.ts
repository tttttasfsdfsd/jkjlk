/**
 * EEXA Billing Router — Stripe + Moyasar webhooks via tRPC
 * Also exposes subscription query endpoints.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, withPermission, protectedQuery, publicQuery } from "../middleware";
import {
  verifyStripeWebhook, verifyMoyasarWebhook,
  processStripeEvent, isEventProcessed, markEventProcessed,
  enforcePlanLimit, getSubscriptionStatus, runReconciliation, PLANS,
} from "../lib/billing";
import { auditLog, extractAuditContext } from "../lib/auditLogger";
import { env } from "../lib/env";
import type { AuthUser } from "../middleware";

export const billingRouter = createRouter({

  // ── STRIPE WEBHOOK (public — signature-only auth, P1-7 fix) ─────────────
  // Stripe servers cannot authenticate as super_admin, so we removed the
  // platform:manage guard. Stripe HMAC signature IS the only auth needed.
  // The canonical endpoint is /api/billing/stripe-webhook (raw HTTP, no tRPC).
  // This tRPC route is a secondary path using the same verification logic.
  stripeWebhook: publicQuery
    .input(z.object({
      payload:      z.string(),
      signatureHeader: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { ipAddress } = extractAuditContext(ctx.req);

      if (!env.stripeWebhookSecret) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Webhook secret not configured" });
      }

      // HMAC signature verification
      if (!verifyStripeWebhook(input.payload, input.signatureHeader, env.stripeWebhookSecret)) {
        auditLog({ action: "billing.webhook_received", severity: "critical",
          metadata: { provider: "stripe", error: "signature_invalid", ip: ipAddress } });
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid webhook signature" });
      }

      const event = JSON.parse(input.payload) as { id: string; type: string; data: { object: Record<string, unknown> } };

      // Redis-backed idempotency (survives restarts)
      if (await isEventProcessed("stripe", event.id)) {
        return { status: "skipped", reason: "duplicate" };
      }

      const result = await processStripeEvent(event.id, event.type, event.data.object);
      await markEventProcessed("stripe", event.id, result.action === "failed" ? "failed" : "processed", input.payload.slice(0, 500));

      return { status: result.action };
    }),

  // ── SUBSCRIPTION STATUS ──────────────────────────────────────────────────
  getStatus: protectedQuery
    .query(async ({ ctx }) => {
      const user = (ctx as { user: AuthUser }).user;
      // Return from JWT payload (fast path)
      return {
        plan:         user.plan,
        reportsUsed:  user.reportsUsed,
        reportsLimit: user.reportsLimit,
        planDetails:  PLANS[user.plan],
      };
    }),

  // ── PLAN LIMIT CHECK ─────────────────────────────────────────────────────
  checkLimit: protectedQuery
    .query(async ({ ctx }) => {
      const user   = (ctx as { user: AuthUser }).user;
      const check  = enforcePlanLimit(user.plan, user.reportsUsed);
      return { ...check, remaining: Math.max(0, user.reportsLimit - user.reportsUsed) };
    }),

  // ── RECONCILIATION (admin only) ──────────────────────────────────────────
  reconcile: withPermission("platform:manage")
    .mutation(async () => {
      return await runReconciliation();
    }),
});
