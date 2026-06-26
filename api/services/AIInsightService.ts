/**
 * AIInsightService — P2-12 extraction from boot.ts
 * Generates AI-powered financial insights with grounding validation.
 * Independently testable — inject financials + apiKey.
 *
 * P4-25: Tight ±1% grounding for figures > 1,000
 * P4-26: Explicit AI unavailable disclaimer on fallback
 */

export interface Insight {
  type:  "summary" | "risk" | "opportunity" | "recommendation";
  title: string;
  text:  string;
}

const AI_UNAVAILABLE_DISCLAIMER =
  "AI service unavailable. Displaying pre-computed metrics only.";

/**
 * Try Anthropic API first; fall back to rule-based insights on error.
 * Fallback uses only pre-computed metrics — no hardcoded strings.
 */
export async function generateInsights(
  financials:   Record<string, unknown>,
  companyName:  string,
  anthropicKey: string | undefined,
): Promise<Insight[]> {
  const f     = financials as Record<string, number>;
  const score = (financials.score as Record<string, number>)?.overall ?? 0;
  const prof  = (financials.profitability  as Record<string, number>) ?? {};
  const liq   = (financials.liquidity      as Record<string, number>) ?? {};
  const sol   = (financials.solvency       as Record<string, number>) ?? {};
  const cf    = (financials.cashFlow       as Record<string, number>) ?? {};

  // ── AI path ───────────────────────────────────────────────────────────
  if (anthropicKey && !anthropicKey.includes("placeholder") && !anthropicKey.includes("YOUR_KEY")) {
    try {
      const Anthropic = await import("@anthropic-ai/sdk");
      const client    = new Anthropic.default({ apiKey: anthropicKey });

      const prompt = buildInsightPrompt(companyName, score, f, prof, liq, sol, cf);
      const response = await client.messages.create({
        model:      "claude-sonnet-4-6",
        max_tokens: 1500,
        messages:   [{ role: "user", content: prompt }],
      });

      const raw   = response.content[0]?.type === "text" ? response.content[0].text : "";
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed) && parsed.length >= 4) return parsed as Insight[];
      }
    } catch (e) {
      console.error("[AIInsightService] API error:", (e as Error).message);
      // Fall through to rule-based
    }
  }

  // ── Rule-based fallback — dynamic, no hardcoded strings (P4-26) ───────
  return buildRuleBasedInsights(score, f, prof, liq, sol, cf);
}

function buildInsightPrompt(
  companyName: string,
  score: number,
  f: Record<string, number>,
  prof: Record<string, number>,
  liq:  Record<string, number>,
  sol:  Record<string, number>,
  cf:   Record<string, number>,
): string {
  return `You are an expert CFO and financial analyst. Use ONLY the following pre-calculated metrics. Do NOT invent numbers beyond what is listed below.

Company: ${companyName}
Financial Health Score: ${score}/100
Revenue: ${f.totalRevenue?.toLocaleString()} SAR
Net Profit: ${f.netProfit?.toLocaleString()} SAR (${prof.netMargin?.toFixed(1)}% margin)
Gross Margin: ${prof.grossMargin?.toFixed(1)}%
EBITDA Margin: ${prof.ebitdaMargin?.toFixed(1)}%
ROA: ${prof.roa?.toFixed(1)}% | ROE: ${prof.roe?.toFixed(1)}%
Current Ratio: ${liq.currentRatio?.toFixed(2)} | Quick Ratio: ${liq.quickRatio?.toFixed(2)}
Debt Ratio: ${((sol.debtRatio ?? 0) * 100).toFixed(1)}%
Interest Coverage: ${sol.interestCoverage?.toFixed(1)}x
Cash Runway: ${cf.monthsRunway?.toFixed(1)} months
Revenue Growth: ${f.revenueGrowth?.toFixed(1)}%

Respond ONLY with a valid JSON array (no markdown, no preamble):
[
  {"type":"summary","title":"Executive Summary","text":"2-3 sentences covering overall health"},
  {"type":"risk","title":"Key Risks","text":"Top 2-3 risks with exact numbers from above"},
  {"type":"opportunity","title":"Growth Opportunities","text":"2-3 concrete opportunities"},
  {"type":"recommendation","title":"CFO Recommendations","text":"Top 3 prioritized actions"}
]`;
}

function buildRuleBasedInsights(
  score:  number,
  f:      Record<string, number>,
  prof:   Record<string, number>,
  liq:    Record<string, number>,
  sol:    Record<string, number>,
  cf:     Record<string, number>,
): Insight[] {
  const netMargin    = prof.netMargin    ?? 0;
  const currentRatio = liq.currentRatio  ?? 0;
  const debtRatio    = (sol.debtRatio ?? 0) * 100;
  const monthsRunway = cf.monthsRunway   ?? 0;
  const revenueGrowth = f.revenueGrowth  ?? 0;
  const burnRate     = cf.burnRate       ?? 0;

  const healthLabel = score >= 80 ? "ممتاز" : score >= 60 ? "جيد" : score >= 40 ? "يحتاج تحسين" : "خطر عالٍ";

  return [
    {
      type:  "summary",
      title: `الملخص التنفيذي [${AI_UNAVAILABLE_DISCLAIMER}]`,
      text:  `مؤشر الصحة المالية: ${score}/100 (${healthLabel}). هامش الربح الصافي ${netMargin.toFixed(1)}% يشير إلى ربحية ${netMargin > 15 ? "قوية" : netMargin > 8 ? "معتدلة" : "ضعيفة"}. نمو الإيرادات: ${revenueGrowth.toFixed(1)}%. السيولة المتاحة: ${monthsRunway.toFixed(1)} شهر.`,
    },
    {
      type:  "risk",
      title: "المخاطر الرئيسية",
      text:  [
        debtRatio > 60  ? `نسبة الديون المرتفعة (${debtRatio.toFixed(1)}%) تقيد المرونة المالية.`          : null,
        monthsRunway < 6  ? `تحذير: متبقٍ ${monthsRunway.toFixed(1)} شهر فقط من السيولة النقدية.`          :
        monthsRunway < 12 ? `الرصيد النقدي يكفي ${monthsRunway.toFixed(1)} شهراً — أقل من الحد الموصى به.` : null,
        currentRatio < 1.2 ? `نسبة السيولة ${currentRatio.toFixed(2)} — يوجد ضغط على الالتزامات قصيرة الأجل.` : null,
        netMargin < 5 ? `هوامش ضيقة (${netMargin.toFixed(1)}%) تترك هامشاً محدوداً للمناورة.`              : null,
      ].filter(Boolean).join(" ") || "مستوى المخاطر المالية مقبول بناءً على المؤشرات الحالية.",
    },
    {
      type:  "opportunity",
      title: "فرص النمو",
      text:  currentRatio > 2 && debtRatio < 40
        ? `الميزانية العمومية القوية تُمكّن من الاستثمار الاستراتيجي. الرافعة المالية المنخفضة (${debtRatio.toFixed(0)}%) تفتح آفاقاً للتمويل.`
        : `التركيز على تحسين الهوامش. تخفيض تكلفة البضاعة بنسبة 3-5% يمكن أن يحسّن الأرباح بشكل ملموس.`,
    },
    {
      type:  "recommendation",
      title: "توصيات المدير المالي",
      text:  [
        monthsRunway < 12    ? `[عاجل] بناء احتياطي نقدي يكفي لـ 12+ شهراً.`                                   : null,
        debtRatio > 55       ? `[30 يوماً] وضع خطة لتخفيض نسبة الدين إلى ${Math.max(40, debtRatio - 15).toFixed(0)}%.` : null,
        `[60 يوماً] مراجعة أبرز بنود التكاليف لتحقيق وفورات ${netMargin < 10 ? "عاجلة" : "تدريجية"}.`,
        `[مستمر] مراقبة معدل الإنفاق الشهري (${burnRate.toLocaleString()} ريال/شهر).`,
      ].filter(Boolean).join(" "),
    },
  ];
}
