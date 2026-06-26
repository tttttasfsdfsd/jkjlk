/**
 * FinancialAnalysisService — P2-12 extraction from boot.ts
 * Orchestrates data normalization and financial ratio calculation.
 * Independently testable — no HTTP context required.
 */

export interface NormalizedFinancials {
  month:               string;
  revenue:             number;
  netIncome:           number;
  cogs:                number;
  grossProfit:         number;
  ebitda:              number;
  ebit:                number;
  operatingExpenses:   number;
  interestExpense:     number;
  tax:                 number;
  totalAssets:         number;
  currentAssets:       number;
  fixedAssets:         number;
  totalLiabilities:    number;
  currentLiabilities:  number;
  totalEquity:         number;
  cash:                number;
  inventory:           number;
  accountsReceivable:  number;
  accountsPayable:     number;
  retainedEarnings:    number;
  operatingCashFlow:   number;
  depreciation:        number;
  capex:               number;
  [key: string]: unknown;
}

/**
 * Normalizes raw parsed rows from any file type into a consistent
 * financial data structure with sensible defaults.
 */
export function normalizeFinancialData(
  rawData: Record<string, unknown>[]
): NormalizedFinancials[] {
  return rawData.map(row => {
    const g = (key: string): number => {
      const v = row[key];
      if (typeof v === "number") return v;
      if (typeof v === "string") {
        const n = parseFloat(v.replace(/[,،\s]/g, ""));
        return isNaN(n) ? 0 : n;
      }
      return 0;
    };

    const revenue   = g("revenue") || g("sales") || g("total_revenue") || 0;
    const netIncome = g("netIncome") || g("net_income") || g("net_profit") || 0;
    const cogs      = g("cogs") || g("cost_of_goods_sold") || 0;

    return {
      month:               String(row["month"] ?? row["period"] ?? row["date"] ?? "Period 1"),
      revenue,
      netIncome,
      cogs,
      grossProfit:         g("grossProfit") || (revenue - cogs) || 0,
      ebitda:              g("ebitda") || 0,
      ebit:                g("ebit") || 0,
      operatingExpenses:   g("operatingExpenses") || 0,
      interestExpense:     g("interestExpense") || 0,
      tax:                 g("tax") || 0,
      totalAssets:         g("totalAssets") || 0,
      currentAssets:       g("currentAssets") || 0,
      fixedAssets:         g("fixedAssets") || 0,
      totalLiabilities:    g("totalLiabilities") || 0,
      currentLiabilities:  g("currentLiabilities") || 0,
      totalEquity:         g("totalEquity") || 0,
      cash:                g("cash") || 0,
      inventory:           g("inventory") || 0,
      accountsReceivable:  g("accountsReceivable") || 0,
      accountsPayable:     g("accountsPayable") || 0,
      retainedEarnings:    g("retainedEarnings") || 0,
      operatingCashFlow:   g("operatingCashFlow") || 0,
      depreciation:        g("depreciation") || 0,
      capex:               g("capex") || 0,
    } satisfies NormalizedFinancials;
  });
}
