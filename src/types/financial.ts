export interface ProfitabilityRatios {
  grossMargin: number;
  operatingMargin: number;
  ebitdaMargin: number;
  netMargin: number;
  roa: number;
  roe: number;
  roce: number;
  roic: number;
}

export interface LiquidityRatios {
  currentRatio: number;
  quickRatio: number;
  cashRatio: number;
  workingCapital: number;
  ocfRatio: number;
}

export interface SolvencyRatios {
  debtRatio: number;
  debtToEquity: number;
  equityRatio: number;
  interestCoverage: number;
  financialLeverage: number;
}

export interface EfficiencyRatios {
  assetTurnover: number;
  fixedAssetTurnover: number;
  inventoryTurnover: number;
  dio: number;
  arTurnover: number;
  dso: number;
  apTurnover: number;
  dpo: number;
  ccc: number;
}

export interface DuPontAnalysis {
  roe: number;
  netProfitMargin: number;
  assetTurnover: number;
  financialLeverage: number;
  npmContribution: number;
  atoContribution: number;
  flContribution: number;
}

export interface EarningsQuality {
  accrualsRatio: number;
  cashToEarningsRatio: number;
  nonRecurringItems: number;
  sustainabilityScore: number;
  quality: 'high' | 'moderate' | 'low';
  description: string;
}

export interface CashFlowAnalysis {
  ocf: number;
  icf: number;
  fcf: number;
  burnRate: number;
  monthsRunway: number;
  liquidityRisk: 'safe' | 'caution' | 'danger';
  fundingDependency: number;
  freeCashFlow: number;
  ocfToNetIncome: number;
}

export interface AltmanZScore {
  zScore: number;
  zone: 'safe' | 'grey' | 'distress';
  probability: number;
  components: {
    x1: number;
    x2: number;
    x3: number;
    x4: number;
    x5: number;
  };
}

export interface BeneishMScore {
  mScore: number;
  isManipulator: boolean;
  components: {
    dsri: number;
    gmi: number;
    aqi: number;
    sgi: number;
    depi: number;
    sgai: number;
    lvgi: number;
    tata: number;
  };
}

export interface FinancialScore {
  overall: number;
  profitability: number;
  liquidity: number;
  solvency: number;
  efficiency: number;
  growth: number;
  cashFlow: number;
  earningsQuality: number;
  label: string;
}

export interface ForecastPoint {
  period: string;
  value: number;
  lowerBound: number;
  upperBound: number;
}

export interface Forecasts {
  revenue: ForecastPoint[];
  profit: ForecastPoint[];
  ebitda: ForecastPoint[];
  cashFlow: ForecastPoint[];
  cashBalance: ForecastPoint[];
  workingCapital: ForecastPoint[];
}

export interface ScenarioCase {
  name: string;
  revenueGrowth: number;
  costChange: number;
  projectedRevenue: number;
  projectedProfit: number;
  projectedCash: number;
  projectedLiquidity: number;
}

export interface ScenarioAnalysis {
  bestCase: ScenarioCase;
  baseCase: ScenarioCase;
  worstCase: ScenarioCase;
}

export interface BenchmarkComparison {
  metric: string;
  companyValue: number;
  industryAvg: number;
  percentile: number;
  status: 'above' | 'at' | 'below';
}

export interface Insight {
  type: 'summary' | 'risk' | 'opportunity' | 'recommendation';
  title: string;
  text: string;
}

export interface ComprehensiveFinancials {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  netMargin: number;
  revenueGrowth: number;
  expenseGrowth: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  cash: number;
  inventory: number;
  accountsReceivable: number;
  accountsPayable: number;
  profitability: ProfitabilityRatios;
  liquidity: LiquidityRatios;
  solvency: SolvencyRatios;
  efficiency: EfficiencyRatios;
  dupont: DuPontAnalysis;
  earningsQuality: EarningsQuality;
  cashFlow: CashFlowAnalysis;
  altmanZ: AltmanZScore;
  beneishM: BeneishMScore;
  score: FinancialScore;
  forecasts: Forecasts;
  scenarioAnalysis: ScenarioAnalysis;
  benchmarks: BenchmarkComparison[];
  months: string[];
  monthlyRevenue: number[];
  monthlyExpenses: number[];
  monthlyNetIncome: number[];
  monthlyCash: number[];
  monthlyAssets: number[];
  monthlyLiabilities: number[];
}

export interface AnalysisResult {
  success: boolean;
  financials: ComprehensiveFinancials & { smartAlerts?: import('../lib/financialEngine').SmartAlert[] };
  insights: Insight[];
  rawData: Record<string, unknown>[];
  companyName: string;
  isPDF: boolean;
  error?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  time: string;
}

export type Language = 'ar' | 'en';
