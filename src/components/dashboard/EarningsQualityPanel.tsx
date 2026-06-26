import type { EarningsQuality } from '@/types/financial';
import { formatPercent, formatRatio, getScoreColor } from '@/lib/formatters';

interface Props {
  earningsQuality: EarningsQuality;
  t: Record<string, string>;
  isRTL: boolean;
}

export default function EarningsQualityPanel({ earningsQuality, t, isRTL }: Props) {
  const eq = earningsQuality;
  const scoreColors = getScoreColor(eq.sustainabilityScore);

  const qualityLabels: Record<string, { ar: string; en: string }> = {
    high: { ar: 'جودة عالية', en: 'High Quality' },
    moderate: { ar: 'جودة متوسطة', en: 'Moderate Quality' },
    low: { ar: 'جودة منخفضة', en: 'Low Quality' },
  };

  const qualityLabel = qualityLabels[eq.quality] || qualityLabels.moderate;
  const displayQuality = isRTL ? qualityLabel.ar : qualityLabel.en;

  return (
    <div className="space-y-4">
      {/* Quality Score */}
      <div className="flex flex-wrap items-center gap-6 p-4 rounded-xl border" style={{ background: 'var(--bg-deep)', borderColor: 'var(--border-color)' }}>
        <div className="text-center">
          <div className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>{t.sustainainabilityScore || 'Sustainability Score'}</div>
          <div className={`text-3xl font-black ${scoreColors.text}`}>{eq.sustainabilityScore}/100</div>
          <div className={`text-sm font-bold mt-1 ${scoreColors.text}`}>{displayQuality}</div>
        </div>
        <div className="flex-1 min-w-60">
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
            <div className={`h-full rounded-full bar-fill ${scoreColors.bg}`} style={{ width: `${eq.sustainabilityScore}%`, background: eq.sustainabilityScore >= 70 ? '#10B981' : eq.sustainabilityScore >= 40 ? '#F59E0B' : '#EF4444' }} />
          </div>
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>{eq.description}</p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl p-4 border" style={{ background: 'var(--bg-deep)', borderColor: 'var(--border-color)' }}>
          <span className="text-sm block mb-2" style={{ color: 'var(--text-secondary)' }}>{t.accrualsRatio || 'Accruals Ratio'}</span>
          <div className="text-2xl font-bold">{formatPercent(Math.abs(eq.accrualsRatio))}</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{isRTL ? 'أقل = أفضل' : 'Lower is better'}</div>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: 'var(--bg-deep)', borderColor: 'var(--border-color)' }}>
          <span className="text-sm block mb-2" style={{ color: 'var(--text-secondary)' }}>{t.cashToEarnings || 'Cash to Earnings'}</span>
          <div className="text-2xl font-bold">{formatRatio(eq.cashToEarningsRatio)}</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{isRTL ? '> 1.0 = جيد' : '> 1.0 = Good'}</div>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: 'var(--bg-deep)', borderColor: 'var(--border-color)' }}>
          <span className="text-sm block mb-2" style={{ color: 'var(--text-secondary)' }}>{isRTL ? 'البنود غير المتكررة' : 'Non-Recurring Items'}</span>
          <div className="text-2xl font-bold">{eq.nonRecurringItems > 0 ? eq.nonRecurringItems : (isRTL ? 'لم يتم اكتشافها' : 'None detected')}</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{isRTL ? 'تأثير على الأرباح' : 'Impact on earnings'}</div>
        </div>
      </div>
    </div>
  );
}
