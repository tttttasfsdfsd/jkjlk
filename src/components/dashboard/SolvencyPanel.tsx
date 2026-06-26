import type { SolvencyRatios } from '@/types/financial';
import { formatPercent, formatRatio } from '@/lib/formatters';

interface Props {
  solvency: SolvencyRatios;
  t: Record<string, string>;
  isRTL: boolean;
}

function RatioCard({ label, value, target, status }: { label: string; value: string; target: string; status: string }) {
  const statusColors: Record<string, string> = {
    'Safe': 'text-emerald-400', 'Moderate': 'text-amber-400', 'Risky': 'text-red-400',
    'آمن': 'text-emerald-400', 'متوسط': 'text-amber-400', 'محفوف بالمخاطر': 'text-red-400',
  };

  return (
    <div className="rounded-xl p-4 border" style={{ background: 'var(--bg-deep)', borderColor: 'var(--border-color)' }}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className={`text-xs font-bold ${statusColors[status] || 'text-emerald-400'}`}>{status}</span>
      </div>
      <div className="text-2xl font-bold mb-1">{value}</div>
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{target}</div>
    </div>
  );
}

export default function SolvencyPanel({ solvency, t }: Props) {
  const s = solvency;
  const isArabic = t.brand === 'AI-CFO Pro' && t.solvencyTitle === 'تحليل الاستقرار المالي';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <RatioCard label={t.debtRatio || 'Debt Ratio'} value={formatPercent(s.debtRatio * 100)} target="Target: <50%"
        status={s.debtRatio < 0.4 ? (isArabic ? 'آمن' : 'Safe') : s.debtRatio < 0.6 ? (isArabic ? 'متوسط' : 'Moderate') : (isArabic ? 'محفوف بالمخاطر' : 'Risky')} />
      <RatioCard label={t.debtToEquity || 'Debt to Equity'} value={formatRatio(s.debtToEquity)} target="Target: <1.0"
        status={s.debtToEquity < 0.5 ? (isArabic ? 'آمن' : 'Safe') : s.debtToEquity < 1.5 ? (isArabic ? 'متوسط' : 'Moderate') : (isArabic ? 'محفوف بالمخاطر' : 'Risky')} />
      <RatioCard label={t.equityRatio || 'Equity Ratio'} value={formatPercent(s.equityRatio * 100)} target="Target: >40%"
        status={s.equityRatio > 0.5 ? (isArabic ? 'آمن' : 'Safe') : s.equityRatio > 0.3 ? (isArabic ? 'متوسط' : 'Moderate') : (isArabic ? 'محفوف بالمخاطر' : 'Risky')} />
      <RatioCard label={t.interestCoverage || 'Interest Coverage'} value={formatRatio(s.interestCoverage)} target="Target: >3.0"
        status={s.interestCoverage > 5 ? (isArabic ? 'آمن' : 'Safe') : s.interestCoverage > 2 ? (isArabic ? 'متوسط' : 'Moderate') : (isArabic ? 'محفوف بالمخاطر' : 'Risky')} />
      <RatioCard label={t.financialLeverage || 'Financial Leverage'} value={formatRatio(s.financialLeverage)} target="Target: <2.5"
        status={s.financialLeverage < 2 ? (isArabic ? 'آمن' : 'Safe') : s.financialLeverage < 3 ? (isArabic ? 'متوسط' : 'Moderate') : (isArabic ? 'محفوف بالمخاطر' : 'Risky')} />
    </div>
  );
}
