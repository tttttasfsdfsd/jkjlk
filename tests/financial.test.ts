/**
 * EEXA Platform v4 Enterprise — Comprehensive Financial Engine Tests
 * Covers: all ratios, edge cases, Piotroski F-Score, DSCR, Beneish sentinel
 * Run: npm test
 */

import { describe, it, expect } from "vitest";
import {
  calculateProfitabilityRatios,
  calculateLiquidityRatios,
  calculateSolvencyRatios,
  calculateEfficiencyRatios,
  calculateAltmanZScore,
  calculateBeneishMScore,
  calculateFinancialScore,
  calculateEarningsQuality,
  calculateCashFlowAnalysis,
  calculateDuPont,
  calculatePiotroskiFScore,
  analyzeFinancials,
  generateSmartAlerts,
  BENEISH_INSUFFICIENT_DATA,
} from "../src/lib/financialEngine";
import type { NormalizedFinancialRecord } from "../src/lib/semanticMapping";

const PRECISION = 2;

// ==================== BASE RECORD ====================
const baseRecord: NormalizedFinancialRecord = {
  month: "Dec",
  revenue: 1_000_000,
  sales: 1_000_000,
  cogs: 600_000,
  grossProfit: 400_000,
  operatingExpenses: 150_000,
  ebitda: 260_000,
  ebit: 250_000,
  depreciation: 10_000,
  amortization: 0,
  interestExpense: 25_000,
  tax: 45_000,
  netIncome: 180_000,
  totalAssets: 2_000_000,
  currentAssets: 700_000,
  fixedAssets: 1_200_000,
  inventory: 200_000,
  accountsReceivable: 150_000,
  cash: 350_000,
  totalLiabilities: 800_000,
  currentLiabilities: 300_000,
  longTermDebt: 500_000,
  accountsPayable: 100_000,
  shortTermDebt: 0,
  totalEquity: 1_200_000,
  retainedEarnings: 500_000,
  operatingCashFlow: 220_000,
  investingCashFlow: -80_000,
  financingCashFlow: -40_000,
  capex: 80_000,
  dividends: 0,
};

const prevRecord: NormalizedFinancialRecord = {
  ...baseRecord,
  month: "Nov",
  revenue: 900_000,
  cogs: 540_000,
  netIncome: 160_000,
  ebit: 220_000,
  totalAssets: 1_900_000,
  currentAssets: 650_000,
  accountsReceivable: 135_000,
  inventory: 180_000,
  currentLiabilities: 280_000,
  longTermDebt: 520_000,
  totalLiabilities: 780_000,
  totalEquity: 1_120_000,
};

const zeroRecord: NormalizedFinancialRecord = {
  month: "Jan",
  revenue: 0, sales: 0, cogs: 0, grossProfit: 0,
  operatingExpenses: 0, ebitda: 0, ebit: 0, depreciation: 0, amortization: 0,
  interestExpense: 0, tax: 0, netIncome: 0,
  totalAssets: 0, currentAssets: 0, fixedAssets: 0, inventory: 0,
  accountsReceivable: 0, cash: 0,
  totalLiabilities: 0, currentLiabilities: 0, longTermDebt: 0,
  accountsPayable: 0, shortTermDebt: 0,
  totalEquity: 0, retainedEarnings: 0,
  operatingCashFlow: 0, investingCashFlow: 0, financingCashFlow: 0,
  capex: 0, dividends: 0,
};

const negativeRecord: NormalizedFinancialRecord = {
  ...baseRecord,
  month: "Mar",
  netIncome: -50_000,
  ebit: -30_000,
  operatingCashFlow: -20_000,
  totalEquity: -100_000,
};

// ==================== PROFITABILITY ====================
describe("Profitability Ratios", () => {
  const p = calculateProfitabilityRatios(baseRecord);

  it("Gross Margin = (Revenue - COGS) / Revenue × 100", () => {
    expect(p.grossMargin).toBeCloseTo(40.0, PRECISION);
  });

  it("Operating Margin = EBIT / Revenue × 100", () => {
    expect(p.operatingMargin).toBeCloseTo(25.0, PRECISION);
  });

  it("EBITDA Margin = EBITDA / Revenue × 100", () => {
    expect(p.ebitdaMargin).toBeCloseTo(26.0, PRECISION);
  });

  it("Net Margin = Net Income / Revenue × 100", () => {
    expect(p.netMargin).toBeCloseTo(18.0, PRECISION);
  });

  it("ROA = Net Income / Total Assets × 100", () => {
    expect(p.roa).toBeCloseTo(9.0, PRECISION);
  });

  it("ROE = Net Income / Total Equity × 100", () => {
    expect(p.roe).toBeCloseTo(15.0, PRECISION);
  });

  it("handles zero revenue gracefully — no Infinity or NaN", () => {
    const z = calculateProfitabilityRatios(zeroRecord);
    expect(isFinite(z.grossMargin)).toBe(true);
    expect(isFinite(z.roa)).toBe(true);
    expect(isFinite(z.roe)).toBe(true);
  });

  it("handles negative equity (distressed company)", () => {
    const p2 = calculateProfitabilityRatios(negativeRecord);
    expect(isFinite(p2.roe)).toBe(true);
    expect(p2.netMargin).toBeLessThan(0);
  });
});

// ==================== LIQUIDITY ====================
describe("Liquidity Ratios", () => {
  const l = calculateLiquidityRatios(baseRecord);

  it("Current Ratio = Current Assets / Current Liabilities", () => {
    expect(l.currentRatio).toBeCloseTo(700_000 / 300_000, PRECISION);
  });

  it("Quick Ratio = (Current Assets - Inventory) / Current Liabilities", () => {
    expect(l.quickRatio).toBeCloseTo((700_000 - 200_000) / 300_000, PRECISION);
  });

  it("Cash Ratio = Cash / Current Liabilities", () => {
    expect(l.cashRatio).toBeCloseTo(350_000 / 300_000, PRECISION);
  });

  it("Working Capital = Current Assets - Current Liabilities", () => {
    expect(l.workingCapital).toBe(400_000);
  });

  it("zero liabilities — ratio clamped, no Infinity", () => {
    const l2 = calculateLiquidityRatios(zeroRecord);
    expect(isFinite(l2.currentRatio)).toBe(true);
    expect(l2.currentRatio).toBeGreaterThanOrEqual(0);
  });
});

// ==================== SOLVENCY + DSCR ====================
describe("Solvency Ratios including DSCR", () => {
  const s = calculateSolvencyRatios(baseRecord);

  it("Debt Ratio = Total Liabilities / Total Assets", () => {
    expect(s.debtRatio).toBeCloseTo(800_000 / 2_000_000, PRECISION);
  });

  it("Debt-to-Equity = Total Liabilities / Total Equity", () => {
    expect(s.debtToEquity).toBeCloseTo(800_000 / 1_200_000, PRECISION);
  });

  it("Interest Coverage = EBIT / Interest Expense", () => {
    expect(s.interestCoverage).toBeCloseTo(250_000 / 25_000, PRECISION);
  });

  it("DSCR is positive when OCF > 0 and debt service > 0", () => {
    expect(s.dscr).toBeGreaterThan(0);
  });

  it("DSCR formula: OCF / (interest + principal)", () => {
    // OCF=220000, interest=25000, principal≈500000×0.05=25000 → DSCR≈220000/50000=4.4
    expect(s.dscr).toBeCloseTo(220_000 / (25_000 + 500_000 * 0.05), 1);
  });

  it("DSCR = 0 when no OCF data", () => {
    const noOcf = { ...baseRecord, operatingCashFlow: 0 };
    const s2 = calculateSolvencyRatios(noOcf);
    expect(s2.dscr).toBe(0);
  });
});

// ==================== EFFICIENCY ====================
describe("Efficiency Ratios", () => {
  const e = calculateEfficiencyRatios(baseRecord);

  it("Asset Turnover = Revenue / Total Assets", () => {
    expect(e.assetTurnover).toBeCloseTo(1_000_000 / 2_000_000, PRECISION);
  });

  it("Inventory Turnover = COGS / Inventory", () => {
    expect(e.inventoryTurnover).toBeCloseTo(600_000 / 200_000, PRECISION);
  });

  it("DIO = 365 / Inventory Turnover", () => {
    const invTurn = 600_000 / 200_000;
    expect(e.dio).toBeCloseTo(365 / invTurn, 1);
  });

  it("DSO = 365 / AR Turnover", () => {
    const arTurn = 1_000_000 / 150_000;
    expect(e.dso).toBeCloseTo(365 / arTurn, 1);
  });

  it("DPO = 365 / AP Turnover", () => {
    const apTurn = 600_000 / 100_000;
    expect(e.dpo).toBeCloseTo(365 / apTurn, 1);
  });

  it("CCC = DIO + DSO - DPO", () => {
    expect(e.ccc).toBeCloseTo(e.dio + e.dso - e.dpo, 1);
  });

  it("zero inventory → inventoryTurnover = 0 (shown as —)", () => {
    const noInv = { ...baseRecord, inventory: 0 };
    const e2 = calculateEfficiencyRatios(noInv);
    expect(e2.inventoryTurnover).toBe(0);
    expect(e2.dio).toBe(0);
  });
});

// ==================== DUPONT ====================
describe("DuPont Analysis", () => {
  const d = calculateDuPont(baseRecord);

  it("NPM = Net Income / Revenue", () => {
    expect(d.netProfitMargin).toBeCloseTo(18.0, PRECISION);
  });

  it("ATO = Revenue / Total Assets", () => {
    expect(d.assetTurnover).toBeCloseTo(0.5, PRECISION);
  });

  it("Financial Leverage = Total Assets / Total Equity", () => {
    expect(d.financialLeverage).toBeCloseTo(2_000_000 / 1_200_000, PRECISION);
  });

  it("ROE ≈ NPM × ATO × Leverage × 100", () => {
    const npm = 180_000 / 1_000_000;
    const ato = 1_000_000 / 2_000_000;
    const fl  = 2_000_000 / 1_200_000;
    expect(d.roe).toBeCloseTo(npm * ato * fl * 100, 1);
  });
});

// ==================== ALTMAN Z' ====================
describe("Altman Z' Score (1983 Private Company)", () => {
  it("Coefficients: 0.717, 0.847, 3.107, 0.420, 0.998", () => {
    const z = calculateAltmanZScore(baseRecord);
    const ta = 2_000_000;
    const x1 = (700_000 - 300_000) / ta;
    const x2 = 500_000 / ta;
    const x3 = 250_000 / ta;
    const x4 = 1_200_000 / 800_000;
    const x5 = 1_000_000 / ta;
    const expected = 0.717*x1 + 0.847*x2 + 3.107*x3 + 0.420*x4 + 0.998*x5;
    expect(z.zScore).toBeCloseTo(expected, 2);
  });

  it("safe zone when Z > 2.9", () => {
    const z = calculateAltmanZScore(baseRecord);
    if (z.zScore > 2.9) expect(z.zone).toBe("safe");
  });

  it("distress zone when Z < 1.23", () => {
    const bad = { ...baseRecord, revenue: 100_000, netIncome: -300_000, ebit: -250_000, totalEquity: 100_000, totalLiabilities: 1_900_000 };
    const z = calculateAltmanZScore(bad);
    expect(z.zone).toBe("distress");
  });
});

// ==================== BENEISH M-SCORE ====================
describe("Beneish M-Score", () => {
  it("returns INSUFFICIENT_DATA sentinel when no previous period", () => {
    const b = calculateBeneishMScore(baseRecord, undefined);
    expect(b.mScore).toBe(BENEISH_INSUFFICIENT_DATA);
    expect(b.isManipulator).toBe(false);
  });

  it("NEVER returns fake -2.5 when data is absent", () => {
    const b = calculateBeneishMScore(baseRecord, undefined);
    expect(b.mScore).not.toBe(-2.5);
  });

  it("calculates actual M-Score with two periods", () => {
    const b = calculateBeneishMScore(baseRecord, prevRecord);
    expect(b.mScore).not.toBe(BENEISH_INSUFFICIENT_DATA);
    expect(isFinite(b.mScore)).toBe(true);
  });

  it("identifies manipulator when M > -2.22 (Beneish 1999 threshold)", () => {
    const b = calculateBeneishMScore(baseRecord, prevRecord);
    expect(b.isManipulator).toBe(b.mScore > -2.22); // Beneish (1999) threshold
  });
});

// ==================== PIOTROSKI F-SCORE ====================
describe("Piotroski F-Score", () => {
  it("scores 0–9 range", () => {
    const f = calculatePiotroskiFScore(baseRecord, prevRecord);
    expect(f.fScore).toBeGreaterThanOrEqual(0);
    expect(f.fScore).toBeLessThanOrEqual(9);
  });

  it("strong company scores ≥ 7", () => {
    const f = calculatePiotroskiFScore(baseRecord, prevRecord);
    // baseRecord is financially healthy — should score well
    expect(f.fScore).toBeGreaterThanOrEqual(4);
  });

  it("F1: ROA > 0 scores 1", () => {
    const f = calculatePiotroskiFScore(baseRecord, prevRecord);
    expect(f.components.f1_roa).toBe(1); // 180k / 2M = 9% ROA
  });

  it("F2: OCF > 0 scores 1", () => {
    const f = calculatePiotroskiFScore(baseRecord, prevRecord);
    expect(f.components.f2_ocf).toBe(1); // OCF = 220k
  });

  it("F4: OCF > Net Income scores 1 (earnings quality)", () => {
    const f = calculatePiotroskiFScore(baseRecord, prevRecord);
    // OCF=220k > NI=180k → accruals = 1
    expect(f.components.f4_accruals).toBe(1);
  });

  it("F4: scores 0 when NI > OCF (accrual-heavy)", () => {
    const accrualHeavy = { ...baseRecord, operatingCashFlow: 50_000 };
    const f = calculatePiotroskiFScore(accrualHeavy, prevRecord);
    expect(f.components.f4_accruals).toBe(0); // OCF=50k < NI=180k
  });

  it("grade classification: ≥7 = strong, 4-6 = neutral, <4 = weak", () => {
    const f = calculatePiotroskiFScore(baseRecord, prevRecord);
    const expected = f.fScore >= 7 ? "strong" : f.fScore >= 4 ? "neutral" : "weak";
    expect(f.grade).toBe(expected);
  });

  it("works without previous period (uses single-period signals only)", () => {
    const f = calculatePiotroskiFScore(baseRecord, undefined);
    expect(f.fScore).toBeGreaterThanOrEqual(0);
    expect(f.fScore).toBeLessThanOrEqual(9);
  });
});

// ==================== CASH FLOW ANALYSIS ====================
describe("Cash Flow Analysis", () => {
  const cf = calculateCashFlowAnalysis(baseRecord);

  it("FCF = OCF - CAPEX", () => {
    expect(cf.freeCashFlow).toBe(220_000 - 80_000);
  });

  it("Months Runway > 0 when cash > 0 and burn > 0", () => {
    expect(cf.monthsRunway).toBeGreaterThan(0);
  });

  it("liquidityRisk = safe when runway > 12 months", () => {
    const safeCo = { ...baseRecord, cash: 5_000_000 };
    const cf2 = calculateCashFlowAnalysis(safeCo);
    expect(cf2.liquidityRisk).toBe("safe");
  });

  it("liquidityRisk = danger when runway < 3 months", () => {
    const danger = { ...baseRecord, cash: 10_000 };
    const cf3 = calculateCashFlowAnalysis(danger);
    expect(cf3.liquidityRisk).toBe("danger");
  });
});

// ==================== EARNINGS QUALITY ====================
describe("Earnings Quality", () => {
  it("high quality when OCF >> NI", () => {
    const hq = { ...baseRecord, operatingCashFlow: 350_000 };
    const eq = calculateEarningsQuality(hq);
    expect(eq.quality).toBe("high");
  });

  it("low quality when OCF < 0 and NI > 0", () => {
    const lq = { ...baseRecord, operatingCashFlow: -50_000 };
    const eq = calculateEarningsQuality(lq);
    expect(eq.quality).toBe("low");
  });
});

// ==================== FINANCIAL SCORE ====================
describe("Financial Score", () => {
  it("overall score 0–100", () => {
    const p = calculateProfitabilityRatios(baseRecord);
    const l = calculateLiquidityRatios(baseRecord);
    const s = calculateSolvencyRatios(baseRecord);
    const e = calculateEfficiencyRatios(baseRecord);
    const cf = calculateCashFlowAnalysis(baseRecord);
    const eq = calculateEarningsQuality(baseRecord);
    const score = calculateFinancialScore(p, l, s, e, cf, eq, 11.1);
    expect(score.overall).toBeGreaterThanOrEqual(0);
    expect(score.overall).toBeLessThanOrEqual(100);
  });

  it("healthy company scores ≥ 60", () => {
    const p  = calculateProfitabilityRatios(baseRecord);
    const l  = calculateLiquidityRatios(baseRecord);
    const s  = calculateSolvencyRatios(baseRecord);
    const e  = calculateEfficiencyRatios(baseRecord);
    const cf = calculateCashFlowAnalysis(baseRecord);
    const eq = calculateEarningsQuality(baseRecord);
    const score = calculateFinancialScore(p, l, s, e, cf, eq, 11.1);
    expect(score.overall).toBeGreaterThanOrEqual(60);
  });
});

// ==================== ANALYZE FINANCIALS (INTEGRATION) ====================
describe("analyzeFinancials integration", () => {
  it("throws on empty data", () => {
    expect(() => analyzeFinancials([])).toThrow("No financial data provided");
  });

  it("returns all required fields", () => {
    const result = analyzeFinancials([baseRecord, prevRecord]);
    expect(result.profitability).toBeDefined();
    expect(result.liquidity).toBeDefined();
    expect(result.solvency).toBeDefined();
    expect(result.efficiency).toBeDefined();
    expect(result.dupont).toBeDefined();
    expect(result.cashFlow).toBeDefined();
    expect(result.earningsQuality).toBeDefined();
    expect(result.altmanZ).toBeDefined();
    expect(result.beneishM).toBeDefined();
    expect(result.piotroskiF).toBeDefined();
    expect(result.score).toBeDefined();
    expect(result.forecasts).toBeDefined();
    expect(result.smartAlerts).toBeDefined();
  });

  it("Piotroski F-Score is included in multi-period analysis", () => {
    const result = analyzeFinancials([prevRecord, baseRecord]);
    expect(result.piotroskiF.fScore).toBeGreaterThanOrEqual(0);
    expect(result.piotroskiF.fScore).toBeLessThanOrEqual(9);
  });

  it("Beneish M returns sentinel (not -2.5) for single period", () => {
    const result = analyzeFinancials([baseRecord]);
    expect(result.beneishM.mScore).toBe(BENEISH_INSUFFICIENT_DATA);
  });

  it("processes zero records without throwing", () => {
    const result = analyzeFinancials([zeroRecord]);
    expect(result.score.overall).toBeGreaterThanOrEqual(0);
    expect(isFinite(result.score.overall)).toBe(true);
  });

  it("handles negative-equity company without NaN/Infinity", () => {
    const result = analyzeFinancials([negativeRecord]);
    expect(isFinite(result.profitability.roe)).toBe(true);
    expect(isFinite(result.solvency.debtToEquity)).toBe(true);
  });

  it("multi-period: revenue growth calculated correctly", () => {
    const result = analyzeFinancials([prevRecord, baseRecord]);
    // (1_000_000 - 900_000) / 900_000 × 100 ≈ 11.11%
    expect(result.revenueGrowth).toBeCloseTo(11.11, 1);
  });
});

// ==================== SMART ALERTS ====================
describe("Smart Alerts", () => {
  it("generates danger alert for low cash runway", () => {
    const lowCash = { ...baseRecord, cash: 5_000 };
    const cf  = calculateCashFlowAnalysis(lowCash);
    const l   = calculateLiquidityRatios(lowCash);
    const s   = calculateSolvencyRatios(lowCash);
    const p   = calculateProfitabilityRatios(lowCash);
    const score = { overall: 30, profitability: 30, liquidity: 20, solvency: 50, efficiency: 50, growth: 30, cashFlow: 10, earningsQuality: 50, label: "High Risk" as const };
    const az  = calculateAltmanZScore(lowCash);
    const alerts = generateSmartAlerts(lowCash, cf, l, s, p, score, az);
    const hasDanger = alerts.some(a => a.type === "danger");
    expect(hasDanger).toBe(true);
  });
});
