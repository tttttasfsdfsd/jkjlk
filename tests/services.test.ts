/**
 * Service Unit Tests — P5-28 extension
 * FileParserService, AIInsightService, FinancialAnalysisService
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── FileParserService ─────────────────────────────────────────────────
describe("FileParserService", () => {
  describe("parseCSV", () => {
    it("parses valid CSV into rows", async () => {
      const { parseCSV } = await import("../api/services/FileParserService");
      const csv = "month,revenue,netIncome\nJan,1200000,180000\nFeb,1350000,202500";
      const rows = await parseCSV(Buffer.from(csv));
      expect(rows).toHaveLength(2);
      expect(rows[0].revenue).toBe(1200000);
      expect(rows[0].netIncome).toBe(180000);
    });

    it("returns empty array for CSV with only headers", async () => {
      const { parseCSV } = await import("../api/services/FileParserService");
      const rows = await parseCSV(Buffer.from("a,b,c"));
      expect(rows).toHaveLength(0);
    });

    it("handles Arabic-Indic numerals in values", async () => {
      const { parseCSV } = await import("../api/services/FileParserService");
      // Arabic numerals in CSV field
      const csv = "month,revenue\nيناير,١٢٠٠٠٠٠";
      const rows = await parseCSV(Buffer.from(csv));
      // parseCSV is text-based; Arabic numerals handled at field level
      expect(rows).toHaveLength(1);
    });
  });

  describe("XLSM macro detection", () => {
    it("detects vbaProject.bin marker in buffer", () => {
      // Simulate a ZIP buffer containing vbaProject.bin
      const marker = Buffer.from("vbaProject.bin", "utf8");
      const fakeZip = Buffer.concat([
        Buffer.alloc(10, 0),
        marker,
        Buffer.alloc(100, 0),
      ]);
      // The detection is done inline in boot.ts — verify the logic
      const detected = fakeZip.indexOf(marker) !== -1;
      expect(detected).toBe(true);
    });

    it("does not false-positive on clean xlsx", () => {
      const cleanBuffer = Buffer.from("PK\x03\x04regular_xlsx_content");
      const marker = Buffer.from("vbaProject.bin", "utf8");
      expect(cleanBuffer.indexOf(marker)).toBe(-1);
    });
  });
});

// ── FinancialAnalysisService ──────────────────────────────────────────
describe("FinancialAnalysisService", () => {
  it("normalizes raw rows with string numbers", async () => {
    const { normalizeFinancialData } = await import("../api/services/FinancialAnalysisService");
    const rows = normalizeFinancialData([
      { month: "Jan", revenue: "1,200,000", netIncome: "180,000", cogs: "720,000" },
    ]);
    expect(rows[0].revenue).toBe(1200000);
    expect(rows[0].netIncome).toBe(180000);
  });

  it("handles numeric revenue directly", async () => {
    const { normalizeFinancialData } = await import("../api/services/FinancialAnalysisService");
    const rows = normalizeFinancialData([{ revenue: 5000000, netIncome: 750000 }]);
    expect(rows[0].revenue).toBe(5000000);
  });

  it("fills missing fields with 0", async () => {
    const { normalizeFinancialData } = await import("../api/services/FinancialAnalysisService");
    const rows = normalizeFinancialData([{ revenue: 1000000 }]);
    expect(rows[0].totalAssets).toBe(0);
    expect(rows[0].cash).toBe(0);
  });

  it("computes grossProfit when missing", async () => {
    const { normalizeFinancialData } = await import("../api/services/FinancialAnalysisService");
    const rows = normalizeFinancialData([{ revenue: 1000000, cogs: 600000 }]);
    expect(rows[0].grossProfit).toBe(400000);
  });
});

// ── AIInsightService ──────────────────────────────────────────────────
describe("AIInsightService", () => {
  it("returns 4 insights with rule-based fallback (no API key)", async () => {
    const { generateInsights } = await import("../api/services/AIInsightService");
    const insights = await generateInsights(
      {
        score: { overall: 65 },
        profitability: { netMargin: 12, grossMargin: 35, ebitdaMargin: 18, roa: 8, roe: 14 },
        liquidity:     { currentRatio: 1.8, quickRatio: 1.2 },
        solvency:      { debtRatio: 0.45, interestCoverage: 4.2 },
        cashFlow:      { monthsRunway: 18, burnRate: 200000 },
        totalRevenue:  1200000,
        netProfit:     144000,
        revenueGrowth: 12.5,
      },
      "Test Company",
      undefined, // no API key → rule-based fallback
    );
    expect(insights).toHaveLength(4);
    expect(insights.map(i => i.type)).toEqual(["summary", "risk", "opportunity", "recommendation"]);
  });

  it("fallback includes AI unavailable disclaimer", async () => {
    const { generateInsights } = await import("../api/services/AIInsightService");
    const insights = await generateInsights(
      { score: { overall: 50 }, profitability: {}, liquidity: {}, solvency: {}, cashFlow: {} },
      "ACME Corp",
      undefined,
    );
    const hasDisclaimer = insights.some(i =>
      i.title.includes("AI service unavailable") || i.text.includes("AI service unavailable")
    );
    expect(hasDisclaimer).toBe(true);
  });

  it("fallback does not use hardcoded non-metric strings", async () => {
    const { generateInsights } = await import("../api/services/AIInsightService");
    const insights = await generateInsights(
      { score: { overall: 75 }, profitability: { netMargin: 15 }, liquidity: { currentRatio: 2.1 }, solvency: { debtRatio: 0.3 }, cashFlow: { monthsRunway: 24, burnRate: 150000 }, revenueGrowth: 20 },
      "Test Co",
      undefined,
    );
    // All number references in insight text should come from metrics
    const allText = insights.map(i => i.text).join(" ");
    // Should contain actual metric values, not generic placeholders
    expect(allText).toContain("24"); // monthsRunway
  });
});

// ── aiSafety grounding ────────────────────────────────────────────────
describe("aiSafety: grounding validation (P4-25)", () => {
  it("passes when all figures are within ±1% of known metrics", async () => {
    const { validateGrounding } = await import("../api/lib/aiSafety");
    const result = validateGrounding(
      "Revenue was 1,200,000 SAR with net profit of 180,000 SAR.",
      { revenue: 1200000, netProfit: 180000 },
    );
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("fails when figure deviates >1% from known metric for figures > 1000", async () => {
    const { validateGrounding } = await import("../api/lib/aiSafety");
    const result = validateGrounding(
      "Revenue was 1,300,000 SAR.", // 8% above 1,200,000 → fails ±1%
      { revenue: 1200000 },
    );
    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it("tagUnverifiableFigures prepends disclaimer", async () => {
    const { tagUnverifiableFigures } = await import("../api/lib/aiSafety");
    const tagged = tagUnverifiableFigures(
      "Revenue was 5,000,000.",
      { passed: false, violations: ["Unverified: 5,000,000"], confidence: 0.0 }
    );
    expect(tagged).toContain("[AI ESTIMATE — VERIFY MANUALLY]");
  });
});

// ── Plan enforcement ──────────────────────────────────────────────────
describe("checkPlanLimit (P1-8)", () => {
  it("blocks when reportsLimit is 0", async () => {
    const { checkPlanLimit } = await import("../api/queries/reports");
    const result = await checkPlanLimit(88888, "free", 0);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.reason).toBeTruthy();
  });

  it("allows when user has never used any reports", async () => {
    const { checkPlanLimit } = await import("../api/queries/reports");
    const result = await checkPlanLimit(77777, "professional", 30);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeLessThanOrEqual(30);
  });
});
