// Semantic Financial Field Mapping Engine
// Maps any column name (in any language) to standardized financial fields

export type FinancialField =
  | 'revenue' | 'sales' | 'netSales' | 'turnover' | 'income' | 'totalRevenue'
  | 'cogs' | 'costOfGoodsSold' | 'costOfRevenue'
  | 'grossProfit'
  | 'operatingExpenses' | 'opex' | 'sga' | 'adminExpenses'
  | 'ebitda'
  | 'ebit' | 'operatingIncome'
  | 'interestExpense'
  | 'tax'
  | 'netIncome' | 'netProfit' | 'profit'
  | 'totalAssets' | 'assets'
  | 'currentAssets'
  | 'fixedAssets' | 'ppe'
  | 'inventory' | 'stock'
  | 'accountsReceivable' | 'ar' | 'debtors'
  | 'cash' | 'cashAndEquivalents'
  | 'totalLiabilities' | 'liabilities'
  | 'currentLiabilities'
  | 'longTermDebt'
  | 'shortTermDebt'
  | 'accountsPayable' | 'ap' | 'creditors'
  | 'totalEquity' | 'equity' | 'shareholdersEquity'
  | 'retainedEarnings'
  | 'operatingCashFlow' | 'ocf'
  | 'investingCashFlow'
  | 'financingCashFlow'
  | 'capex'
  | 'dividends'
  | 'depreciation'
  | 'amortization'
  | 'employees'
  | 'sharesOutstanding'
  | 'month' | 'period' | 'date' | 'year' | 'quarter';

export interface FieldMapping {
  field: FinancialField;
  confidence: number; // 0-1
  originalColumn: string;
}

// Semantic patterns for each financial field
// Supports: English, Arabic, and common abbreviations
const SEMANTIC_PATTERNS: Record<FinancialField, string[]> = {
  // Revenue fields
  revenue: ['revenue', 'rev', 'إيرادات', 'الإيرادات', 'ايرادات', 'الايرادات', 'revenues', 'total revenue', 'إجمالي الإيرادات'],
  sales: ['sales', 'مبيعات', 'المبيعات', 'sale', 'net sales', 'صافي المبيعات'],
  netSales: ['net sales', 'صافي المبيعات', 'netsales', 'net revenue', 'صافي الإيرادات'],
  turnover: ['turnover', 'دوران', 'revenue turnover'],
  income: ['income', 'دخل', 'الدخل', 'total income', 'إجمالي الدخل'],
  totalRevenue: ['total revenue', 'إجمالي الإيرادات', 'total revenues', 'الإيرادات الإجمالية'],

  // COGS
  cogs: ['cogs', 'cost of goods sold', 'cost of goods', 'تكلفة البضاعة المباعة', 'تكلفة المبيعات'],
  costOfGoodsSold: ['cost of goods sold', 'cogs', 'cost of revenue', 'تكلفة البضاعة المباعة', 'cost of sales'],
  costOfRevenue: ['cost of revenue', 'تكلفة الإيرادات', 'cost of sales', 'تكلفة المبيعات'],

  // Profit fields
  grossProfit: ['gross profit', 'إجمالي الربح', 'الربح الإجمالي', 'gross margin', 'مجمل الربح'],
  operatingExpenses: ['operating expenses', 'مصاريف تشغيل', 'مصروفات تشغيلية', 'opex', 'operating costs'],
  opex: ['opex', 'operating expenditure', 'operating expenses', 'مصاريف تشغيل'],
  sga: ['sga', 'selling general and administrative', 'selling general administrative', 'مصاريف بيع وإدارية'],
  adminExpenses: ['administrative expenses', 'مصاريف إدارية', 'general and administrative'],
  ebitda: ['ebitda', 'earnings before interest tax depreciation amortization', 'الأرباح قبل الفوائد والضرائب والإهلاك', 'operating profit before depreciation'],
  ebit: ['ebit', 'operating income', 'earnings before interest and tax', 'الأرباح التشغيلية', 'الربح التشغيلي'],
  operatingIncome: ['operating income', 'ebit', 'تشغيلي', 'operating profit', 'الربح التشغيلي'],
  interestExpense: ['interest expense', 'مصاريف فوائد', 'finance cost', 'تكلفة تمويل', 'interest'],
  tax: ['tax', 'taxes', 'ضريبة', 'الضريبة', 'income tax', 'ضريبة الدخل'],
  netIncome: ['net income', 'صافي الدخل', 'net profit', 'صافي الربح', 'profit', 'الربح', 'bottom line', 'الأرباح'],
  netProfit: ['net profit', 'صافي الربح', 'الربح الصافي', 'profit after tax', 'الربح بعد الضريبة'],
  profit: ['profit', 'ربح', 'الربح', 'earnings', 'أرباح', 'الأرباح'],

  // Assets
  totalAssets: ['total assets', 'إجمالي الأصول', 'الأصول الإجمالية', 'assets'],
  assets: ['assets', 'أصول', 'الأصول', 'total assets', 'إجمالي الأصول'],
  currentAssets: ['current assets', 'الأصول المتداولة', 'current asset'],
  fixedAssets: ['fixed assets', 'الأصول الثابتة', 'non current assets', 'الأصول غير المتداولة', 'property plant equipment'],
  ppe: ['ppe', 'property plant and equipment', 'property plant equipment', 'الأملاك والمنشآت والمعدات'],
  inventory: ['inventory', 'مخزون', 'المخزون', 'stock', 'بضاعة', 'inventories'],
  stock: ['stock', 'مخزون', 'inventory', 'stocks'],
  accountsReceivable: ['accounts receivable', 'مدينون', 'account receivable', 'debtors', 'trade receivable', 'receivables', 'المبالغ المستحقة'],
  ar: ['ar', 'accounts receivable', 'مدينون', 'trade receivables'],
  debtors: ['debtors', 'مدينون', 'accounts receivable'],
  cash: ['cash', 'نقد', 'النقد', 'cash and equivalents', 'النقد وما يعادله', 'cash balance', 'رصيد نقدي'],
  cashAndEquivalents: ['cash and equivalents', 'النقد وما يعادله', 'cash equivalents', 'نقد وما يعادله'],

  // Liabilities
  totalLiabilities: ['total liabilities', 'إجمالي الخصوم', 'إجمالي الالتزامات', 'liabilities'],
  liabilities: ['liabilities', 'خصوم', 'الخصوم', 'التزامات', 'الالتزامات'],
  currentLiabilities: ['current liabilities', 'الخصوم المتداولة', 'الالتزامات المتداولة', 'short term liabilities'],
  longTermDebt: ['long term debt', 'ديون طويلة الأجل', 'long term borrowings', 'non current liabilities'],
  shortTermDebt: ['short term debt', 'ديون قصيرة الأجل', 'current portion of long term debt'],
  accountsPayable: ['accounts payable', 'دائنون', 'account payable', 'creditors', 'trade payable', 'payables'],
  ap: ['ap', 'accounts payable', 'دائنون'],
  creditors: ['creditors', 'دائنون', 'accounts payable'],

  // Equity
  totalEquity: ['total equity', 'إجمالي حقوق الملكية', 'equity', 'حقوق الملكية', 'shareholders equity', 'total shareholders equity'],
  equity: ['equity', 'حقوق الملكية', 'shareholders equity', 'حقوق المساهمين', 'owners equity'],
  shareholdersEquity: ['shareholders equity', 'حقوق المساهمين', 'shareholder equity'],
  retainedEarnings: ['retained earnings', 'أرباح محتجزة', 'earnings retained', 'accumulated profits', 'الأرباح المتراكمة'],

  // Cash Flow
  operatingCashFlow: ['operating cash flow', 'cash flow from operations', 'تدفق نقدي تشغيلي', 'ocf', 'cash from operations'],
  ocf: ['ocf', 'operating cash flow', 'cash flow from operating activities'],
  investingCashFlow: ['investing cash flow', 'cash flow from investing', 'تدفق نقدي استثماري', 'cash from investing activities'],
  financingCashFlow: ['financing cash flow', 'cash flow from financing', 'تدفق نقدي تمويلي', 'cash from financing activities'],
  capex: ['capex', 'capital expenditure', 'إنفاق رأسمالي', 'capital spending', 'purchases of property plant equipment'],
  dividends: ['dividends', 'توزيعات أرباح', 'dividend', 'dividend paid'],

  // Other
  depreciation: ['depreciation', 'إهلاك', 'الإهلاك', 'depreciation and amortization', 'depn'],
  amortization: ['amortization', 'استهلاك', 'amortisation'],
  employees: ['employees', 'موظفين', 'headcount', 'staff', 'workforce', 'number of employees'],
  sharesOutstanding: ['shares outstanding', 'أسهم قائمة', 'shares', 'number of shares'],

  // Period fields
  month: ['month', 'شهر', 'months', 'الشهر'],
  period: ['period', 'فترة', 'الفترة', 'reporting period'],
  date: ['date', 'تاريخ', 'التاريخ'],
  year: ['year', 'سنة', 'السنة', 'fiscal year'],
  quarter: ['quarter', 'ربع', 'الربع', 'q1', 'q2', 'q3', 'q4'],
};

// Weighted scoring for field matching
function calculateMatchScore(columnName: string, patterns: string[]): number {
  const normalized = columnName.toLowerCase().trim();
  const normalizedNoSpaces = normalized.replace(/\s+/g, '');
  let bestScore = 0;

  for (const pattern of patterns) {
    const patternLower = pattern.toLowerCase().trim();
    const patternNoSpaces = patternLower.replace(/\s+/g, '');

    // Exact match (highest confidence)
    if (normalized === patternLower) {
      return 1.0;
    }

    // Exact match without spaces
    if (normalizedNoSpaces === patternNoSpaces) {
      bestScore = Math.max(bestScore, 0.95);
      continue;
    }

    // Contains pattern as whole word
    const wordRegex = new RegExp(`\\b${patternLower}\\b`, 'i');
    if (wordRegex.test(normalized)) {
      bestScore = Math.max(bestScore, 0.9);
      continue;
    }

    // Contains pattern substring
    if (normalized.includes(patternLower) || patternLower.includes(normalized)) {
      bestScore = Math.max(bestScore, 0.7);
      continue;
    }

    // Starts with pattern
    if (normalized.startsWith(patternLower)) {
      bestScore = Math.max(bestScore, 0.8);
      continue;
    }

    // Word overlap (Jaccard-like)
    const colWords = new Set(normalized.split(/\s+/));
    const patWords = new Set(patternLower.split(/\s+/));
    const intersection = new Set([...colWords].filter(w => patWords.has(w)));
    const union = new Set([...colWords, ...patWords]);
    if (union.size > 0) {
      const overlapScore = intersection.size / union.size;
      if (overlapScore > 0.5) {
        bestScore = Math.max(bestScore, overlapScore * 0.85);
      }
    }
  }

  return bestScore;
}

// Main mapping function
export function mapFinancialColumns(columns: string[]): FieldMapping[] {
  const mappings: FieldMapping[] = [];
  const usedFields = new Set<FinancialField>();

  for (const column of columns) {
    let bestMatch: FieldMapping | null = null;

    for (const [field, patterns] of Object.entries(SEMANTIC_PATTERNS)) {
      const score = calculateMatchScore(column, patterns);
      if (score > 0.5 && (!bestMatch || score > bestMatch.confidence)) {
        bestMatch = {
          field: field as FinancialField,
          confidence: score,
          originalColumn: column,
        };
      }
    }

    if (bestMatch && !usedFields.has(bestMatch.field)) {
      usedFields.add(bestMatch.field);
      mappings.push(bestMatch);
    } else if (bestMatch) {
      // Field already used, add with lower confidence
      mappings.push({
        ...bestMatch,
        confidence: bestMatch.confidence * 0.5,
      });
    }
  }

  return mappings.sort((a, b) => b.confidence - a.confidence);
}

// Get the mapped column name for a field
export function getColumnForField(mappings: FieldMapping[], field: FinancialField): string | null {
  const mapping = mappings.find(m => m.field === field && m.confidence > 0.5);
  return mapping?.originalColumn || null;
}

// Extract numeric value from a cell (handles various formats)
export function extractNumericValue(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Remove currency symbols, commas, parentheses for negatives
    const cleaned = value
      .replace(/[,$€£¥\s]/g, '')
      .replace(/\((.*)\)/, '-$1') // (100) → -100
      .replace(/[%]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  return null;
}

// Normalize raw data using semantic mappings
export interface NormalizedFinancialRecord {
  month?: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  ebitda: number;
  ebit: number;
  interestExpense: number;
  tax: number;
  netIncome: number;
  totalAssets: number;
  currentAssets: number;
  fixedAssets: number;
  inventory: number;
  accountsReceivable: number;
  cash: number;
  totalLiabilities: number;
  currentLiabilities: number;
  longTermDebt: number;
  accountsPayable: number;
  totalEquity: number;
  retainedEarnings: number;
  operatingCashFlow: number;
  investingCashFlow: number;
  financingCashFlow: number;
  depreciation: number;
  capex: number;
  dividends: number;
  [key: string]: unknown;
}

export function normalizeFinancialData(
  rawData: Record<string, unknown>[],
  mappings: FieldMapping[]
): NormalizedFinancialRecord[] {
  const getField = (field: FinancialField): string | null =>
    getColumnForField(mappings, field);

  return rawData.map((row) => {
    const get = (field: FinancialField): number => {
      const col = getField(field);
      if (!col) return 0;
      const val = extractNumericValue(row[col]);
      return val ?? 0;
    };

    const getString = (field: FinancialField): string | undefined => {
      const col = getField(field);
      if (!col) return undefined;
      const val = row[col];
      return val !== undefined && val !== null ? String(val) : undefined;
    };

    const revenue = get('revenue') || get('sales') || get('netSales') || get('turnover') || get('income') || get('totalRevenue');
    const cogs = get('cogs') || get('costOfGoodsSold') || get('costOfRevenue');
    const grossProfit = get('grossProfit');
    const operatingExpenses = get('operatingExpenses') || get('opex') || get('sga') || get('adminExpenses');
    const ebitda = get('ebitda');
    const ebit = get('ebit') || get('operatingIncome');
    const interestExpense = get('interestExpense');
    const tax = get('tax');
    const netIncome = get('netIncome') || get('netProfit') || get('profit');
    const totalAssets = get('totalAssets') || get('assets');
    const currentAssets = get('currentAssets');
    const fixedAssets = get('fixedAssets') || get('ppe');
    const inventory = get('inventory') || get('stock');
    const accountsReceivable = get('accountsReceivable') || get('ar') || get('debtors');
    const cash = get('cash') || get('cashAndEquivalents');
    const totalLiabilities = get('totalLiabilities') || get('liabilities');
    const currentLiabilities = get('currentLiabilities');
    const longTermDebt = get('longTermDebt');
    const accountsPayable = get('accountsPayable') || get('ap') || get('creditors');
    const totalEquity = get('totalEquity') || get('equity') || get('shareholdersEquity');
    const retainedEarnings = get('retainedEarnings');
    const operatingCashFlow = get('operatingCashFlow') || get('ocf');
    const investingCashFlow = get('investingCashFlow');
    const financingCashFlow = get('financingCashFlow');
    const depreciation = get('depreciation');
    const capex = get('capex');
    const dividends = get('dividends');
    const month = getString('month') || getString('period') || getString('date') || getString('year') || getString('quarter');

    // Derive missing values from available data
    const derivedGrossProfit = grossProfit || (revenue - cogs);
    const derivedEbit = ebit || (derivedGrossProfit - operatingExpenses);
    const derivedEbitda = ebitda || (derivedEbit + depreciation);
    const derivedNetIncome = netIncome || (derivedEbit - interestExpense - tax);
    const derivedTotalEquity = totalEquity || (totalAssets - totalLiabilities);
    const derivedCurrentAssets = currentAssets || (cash + accountsReceivable + inventory);
    const shortTermDebt = get('shortTermDebt');
    const derivedCurrentLiabilities = currentLiabilities || (accountsPayable + shortTermDebt);

    return {
      month,
      revenue,
      cogs,
      grossProfit: derivedGrossProfit,
      operatingExpenses,
      ebitda: derivedEbitda,
      ebit: derivedEbit,
      interestExpense,
      tax,
      netIncome: derivedNetIncome,
      totalAssets,
      currentAssets: derivedCurrentAssets || currentAssets,
      fixedAssets,
      inventory,
      accountsReceivable,
      cash,
      totalLiabilities,
      currentLiabilities: derivedCurrentLiabilities || currentLiabilities,
      longTermDebt,
      accountsPayable,
      totalEquity: derivedTotalEquity,
      retainedEarnings,
      operatingCashFlow,
      investingCashFlow,
      financingCashFlow,
      depreciation,
      capex,
      dividends,
      ...row, // keep original fields
    };
  });
}
