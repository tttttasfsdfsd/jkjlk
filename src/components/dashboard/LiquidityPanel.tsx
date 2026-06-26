import type { LiquidityRatios } from '@/types/financial';
import { formatRatio, formatCurrency } from '@/lib/formatters';

interface Props {
  liquidity: LiquidityRatios;
  t: Record<string, string>;
  isRTL: boolean;
}

function RatioCard({ label, value, target, status }: { label: string; value: string; target: string; status: string }) {
  const statusColors: Record<string, string> = {
    'Strong': 'text-emerald-400', 'Adequate': 'text-cyan-400', 'Weak': 'text-red-400',
    'قوي': 'text-emerald-400', 'مقبول': 'text-cyan-400', 'ضعيف': 'text-red-400',
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

export default function LiquidityPanel({ liquidity, t }: Props) {
  const l = liquidity;
  const isArabic = t.brand === 'AI-CFO Pro' && t.liquidityTitle === 'تحليل السيولة';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <RatioCard
        label={t.currentRatio || 'Current Ratio'}
        value={formatRatio(l.currentRatio)}
        target={`Target: >1.5 | ${isArabic ? 'الحالي' : 'Current'}: ${l.currentRatio >= 1.5 ? (isArabic ? 'جيد' : 'Good') : (isArabic ? 'يحتاج تحسين' : 'Needs Improvement')}`}
        status={l.currentRatio > 2 ? (isArabic ? 'قوي' : 'Strong') : l.currentRatio >= 1.5 ? (isArabic ? 'مقبول' : 'Adequate') : (isArabic ? 'ضعيف' : 'Weak')}
      />
      <RatioCard
        label={t.quickRatio || 'Quick Ratio'}
        value={formatRatio(l.quickRatio)}
        target="Target: >1.0"
        status={l.quickRatio > 1.5 ? (isArabic ? 'قوي' : 'Strong') : l.quickRatio >= 1 ? (isArabic ? 'مقبول' : 'Adequate') : (isArabic ? 'ضعيف' : 'Weak')}
      />
      <RatioCard
        label={t.cashRatio || 'Cash Ratio'}
        value={formatRatio(l.cashRatio)}
        target="Target: >0.2"
        status={l.cashRatio > 0.5 ? (isArabic ? 'قوي' : 'Strong') : l.cashRatio >= 0.2 ? (isArabic ? 'مقبول' : 'Adequate') : (isArabic ? 'ضعيف' : 'Weak')}
      />
      <RatioCard
        label={t.workingCapital || 'Working Capital'}
        value={formatCurrency(l.workingCapital, isArabic ? ' ريال' : ' SAR')}
        target={isArabic ? 'يجب أن يكون موجباً' : 'Should be positive'}
        status={l.workingCapital > 0 ? (isArabic ? 'قوي' : 'Strong') : (isArabic ? 'ضعيف' : 'Weak')}
      />
      <RatioCard
        label={t.ocfRatio || 'OCF Ratio'}
        value={formatRatio(l.ocfRatio)}
        target="Target: >0.4"
        status={l.ocfRatio > 0.8 ? (isArabic ? 'قوي' : 'Strong') : l.ocfRatio >= 0.4 ? (isArabic ? 'مقبول' : 'Adequate') : (isArabic ? 'ضعيف' : 'Weak')}
      />
    </div>
  );
}
