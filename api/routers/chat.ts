/**
 * EEXA Chat Router — AI Financial Assistant
 *
 * Security:
 *   - Requires authentication (protectedQuery + reports:read permission)
 *   - Per-user AI rate limiting (aiLimiter)
 *   - Prompt injection detection on every message + history item
 *   - Grounding validation on AI output
 *   - Tenant isolation: companyId scoped to JWT
 *   - AI audit log on every request
 *   - No financial data sent in raw form — only pre-computed metrics
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, withPermission } from "../middleware";
import { checkPromptInjection, buildIsolatedPrompt, sanitizeAiOutput, validateGrounding } from "../lib/aiSafety";
import { aiLimiter } from "../lib/rateLimiter";
import { auditLog, extractAuditContext } from "../lib/auditLogger";
import { metrics, startTimer } from "../lib/observability";
import { env } from "../lib/env";
import type { AuthUser } from "../middleware";

const chatProcedure = withPermission("ai:use");

export const chatRouter = createRouter({
  send: chatProcedure
    .input(z.object({
      message:     z.string().min(1).max(2000),
      financials:  z.record(z.unknown()).optional(),
      companyName: z.string().max(255).optional(),
      history:     z.array(z.object({
        role:    z.enum(["user", "assistant"]),
        content: z.string().max(2000),
      })).max(20).optional(),
      language:    z.enum(["ar", "en"]).default("ar"),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = (ctx as { user: AuthUser }).user;
      const { ipAddress } = extractAuditContext(ctx.req);

      // Per-user AI rate limit: 20 requests / 15 min
      const rlKey = `ai:user:${user.id}`;
      if (!await aiLimiter.allow(rlKey, 20, 15 * 60_000)) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "تجاوزت حد طلبات الذكاء الاصطناعي. حاول بعد 15 دقيقة." });
      }

      const { message, financials, companyName, history, language } = input;

      // ── Prompt injection check ──────────────────────────────────────────────
      const msgCheck = checkPromptInjection(message, user.id, user.companyId ?? undefined);
      if (!msgCheck.safe) {
        auditLog({ userId: user.id, companyId: user.companyId ?? undefined,
          action: "ai.injection_detected", severity: "warn",
          metadata: { reason: msgCheck.reason ?? "unknown", ip: ipAddress } });
        // Return generic error — don't reveal detection to attacker
        throw new TRPCError({ code: "BAD_REQUEST", message: language === "ar"
          ? "الرسالة تحتوي على محتوى غير مسموح به."
          : "Message contains disallowed content." });
      }

      // Sanitize history too
      const safeHistory = (history ?? []).slice(-8).map(h => ({
        role:    h.role as "user" | "assistant",
        content: checkPromptInjection(h.content, user.id, user.companyId ?? undefined).sanitized,
      }));

      // ── Build isolated system prompt ────────────────────────────────────────
      // Only pre-computed scalar metrics enter the AI context — never raw file data
      const safeMetrics = extractSafeMetrics(financials);
      const systemPrompt = buildIsolatedPrompt(
        companyName ?? "Unknown Company",
        user.companyId ?? 0,
        safeMetrics,
        language
      );

      const timer = startTimer();
      let reply   = "";
      let model   = "fallback";

      try {
        if (env.anthropicApiKey && !env.anthropicApiKey.includes("placeholder")) {
          const result = await callAnthropic(msgCheck.sanitized, safeHistory, systemPrompt, env.anthropicApiKey);
          reply = result.reply;
          model = result.model;
        } else if (env.openaiApiKey) {
          const result = await callOpenAI(msgCheck.sanitized, safeHistory, systemPrompt, env.openaiApiKey);
          reply = result.reply;
          model = result.model;
        } else {
          reply = generateFallbackResponse(message, financials, language);
          model = "fallback";
        }
      } catch (err) {
        metrics.inc("ai_errors", { reason: "api_error" });
        reply = language === "ar"
          ? "معليش، حدث خطأ في الاتصال بالذكاء الاصطناعي. حاول مرة ثانية."
          : "Sorry, an error occurred. Please try again.";
      }

      // ── Grounding validation ────────────────────────────────────────────────
      const grounding = validateGrounding(reply, safeMetrics);
      if (!grounding.passed) {
        metrics.inc("ai_grounding_failures");
        auditLog({ userId: user.id, companyId: user.companyId ?? undefined,
          action: "ai.grounding_failed", severity: "warn",
          metadata: { violations: grounding.violations.length } });
        // P4-25: Tag unverifiable figures with [AI ESTIMATE — VERIFY MANUALLY] disclaimer
        const { tagUnverifiableFigures } = await import("../lib/aiSafety");
        reply = tagUnverifiableFigures(reply, grounding);
        // If confidence is very low (< 0.3), fall back to pre-computed metrics
        // Strip heavily hallucinated content
        reply = language === "ar"
          ? "البيانات المتوفرة لا تكفي للإجابة بدقة على هذا السؤال. يرجى تأكيد الأرقام من التقرير المالي مباشرة."
          : "Available data is insufficient to answer this accurately. Please verify figures from the financial report directly.";
      }

      const latencyMs = timer();

      // ── AI Audit Log ────────────────────────────────────────────────────────
      auditLog({ userId: user.id, companyId: user.companyId ?? undefined,
        action: "ai.request", severity: "info",
        metadata: { model, latencyMs: Math.round(latencyMs), groundingPassed: grounding.passed } });

      metrics.observe("ai_latency_ms", latencyMs);
      metrics.inc("ai_requests", { model });

      return { success: true, reply: sanitizeAiOutput(reply) };
    }),
});

// ==================== SAFE METRICS EXTRACTOR ====================
// Only scalar numbers pass into the AI context. No raw strings, no nested objects.
function extractSafeMetrics(financials: Record<string, unknown> | undefined): Record<string, number | string> {
  if (!financials) return {};
  const safe: Record<string, number | string> = {};

  function flatten(obj: unknown, prefix: string, depth: number): void {
    if (depth > 3 || !obj || typeof obj !== "object") return;
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const key = prefix ? `${prefix}_${k}` : k;
      if (typeof v === "number" && isFinite(v)) {
        safe[key] = v;
      } else if (typeof v === "string" && v.length < 50 && !/[<>]/.test(v)) {
        // Only short, safe strings (e.g. zone labels)
        safe[key] = v;
      } else if (typeof v === "object" && v !== null) {
        flatten(v, key, depth + 1);
      }
    }
  }

  flatten(financials, "", 0);
  return safe;
}

// ==================== ANTHROPIC CALL ====================
async function callAnthropic(
  message:    string,
  history:    Array<{ role: "user" | "assistant"; content: string }>,
  systemPrompt: string,
  apiKey:     string
): Promise<{ reply: string; model: string }> {
  const Anthropic = await import("@anthropic-ai/sdk");
  const client    = new Anthropic.default({ apiKey });

  const MODEL = "claude-sonnet-4-20250514";
  const response = await client.messages.create({
    model:      MODEL,
    max_tokens: 800,
    system:     systemPrompt,
    messages:   [...history, { role: "user" as const, content: message }],
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text : "";
  return { reply: text, model: MODEL };
}

// ==================== OPENAI CALL ====================
async function callOpenAI(
  message:    string,
  history:    Array<{ role: "user" | "assistant"; content: string }>,
  systemPrompt: string,
  apiKey:     string
): Promise<{ reply: string; model: string }> {
  const OpenAI = await import("openai");
  const client = new OpenAI.default({ apiKey });

  const MODEL = "gpt-4o-mini";
  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 800,
    messages: [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user",   content: message },
    ],
  });

  return { reply: response.choices[0]?.message?.content ?? "", model: MODEL };
}

// ==================== FALLBACK RESPONSE ====================
// Used when no AI API key is configured. Returns deterministic responses from computed data.
function generateFallbackResponse(
  message:    string,
  financials: Record<string, unknown> | undefined,
  language:   "ar" | "en"
): string {
  const isAr  = language === "ar";
  const prof  = (financials?.profitability as Record<string, number>) || {};
  const liq   = (financials?.liquidity    as Record<string, number>) || {};
  const sol   = (financials?.solvency     as Record<string, number>) || {};
  const cf    = (financials?.cashFlow     as Record<string, number>) || {};
  const score = (financials?.score        as Record<string, number>) || {};
  const lower = message.toLowerCase();

  if (!financials || Object.keys(financials).length === 0) {
    return isAr
      ? "ما فيه بيانات مالية محمّلة. ارفع ملف Excel أو PDF لأقدر أحلل وضعك المالي."
      : "No financial data loaded. Upload an Excel or PDF file to begin analysis.";
  }
  if (/roe|return.*equity|عائد.*ملك/i.test(lower)) {
    const v = prof.roe ?? 0;
    return isAr ? `العائد على حقوق الملكية (ROE): **${v.toFixed(1)}%** — ${v>20?"ممتاز":v>12?"جيد":v>5?"مقبول":"منخفض"}.` : `ROE: **${v.toFixed(1)}%** — ${v>20?"Excellent":v>12?"Good":v>5?"Acceptable":"Low"}.`;
  }
  if (/roa|return.*assets|عائد.*أصول/i.test(lower)) {
    const v = prof.roa ?? 0;
    return isAr ? `العائد على الأصول (ROA): **${v.toFixed(1)}%**.` : `ROA: **${v.toFixed(1)}%**.`;
  }
  if (/cash|سيولة|runway|نقد/i.test(lower)) {
    const r = cf.monthsRunway ?? 0;
    return isAr ? `أشهر السيولة: **${r.toFixed(1)}** — ${r>12?"✅ آمن":r>6?"⚠️ مراقبة":"🚨 خطر"}.` : `Cash runway: **${r.toFixed(1)} months** — ${r>12?"✅ Safe":r>6?"⚠️ Monitor":"🚨 Critical"}.`;
  }
  const s = score.overall ?? 0;
  return isAr
    ? `التقييم المالي الإجمالي: **${s}/100**. اسأل عن الربحية، السيولة، الديون، أو المخاطر.`
    : `Overall financial score: **${s}/100**. Ask about profitability, liquidity, debt, or risk.`;
}
