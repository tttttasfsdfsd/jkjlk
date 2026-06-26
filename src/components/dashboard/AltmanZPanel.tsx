import type { AltmanZScore } from '@/types/financial';
import { formatRatio, getAltmanZoneColor } from '@/lib/formatters';

interface Props {
  altmanZ: AltmanZScore;
  t: Record<string, string>;
  isRTL: boolean;
}

export default function AltmanZPanel({ altmanZ, t, isRTL }: Props) {
  const z = altmanZ;
  const zoneColor = getAltmanZoneColor(z.zone);
  const isArabic = isRTL;

  const zoneLabels: Record<string, { ar: string; en: string }> = {
    safe: { ar: 'منطقة الآمان', en: 'Safe Zone' },
    grey: { ar: 'المنطقة الرمادية', en: 'Grey Zone' },
    distress: { ar: 'منطقة الخطر', en: 'Distress Zone' },
  };

  const zoneLabel = zoneLabels[z.zone] || zoneLabels.grey;

  return (
    <div className="space-y-4">
      {/* Z-Score Display */}
      <div className="flex flex-wrap items-center gap-6 p-4 rounded-xl border" style={{ background: 'var(--bg-deep)', borderColor: 'var(--border-color)' }}>
        <div className="text-center">
          <div className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Z-Score</div>
          <div className={`text-4xl font-black ${zoneColor}`}>{z.zScore.toFixed(2)}</div>
          <div className={`text-sm font-bold mt-1 ${zoneColor}`}>
            {isArabic ? zoneLabel.ar : zoneLabel.en}
          </div>
        </div>
        <div className="flex-1 min-w-60">
          <div className="flex justify-between text-xs mb-1">
            <span style={{ color: 'var(--text-muted)' }}>1.81</span>
            <span style={{ color: 'var(--text-muted)' }}>2.99</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden relative" style={{ background: 'var(--bg-elevated)' }}>
            <div className="absolute inset-y-0 left-0 w-[45%] rounded-l-full" style={{ background: 'rgba(239, 68, 68, 0.3)' }} />
            <div className="absolute inset-y-0 left-[45%] w-[30%]" style={{ background: 'rgba(245, 158, 11, 0.3)' }} />
            <div className="absolute inset-y-0 right-0 w-[25%] rounded-r-full" style={{ background: 'rgba(16, 185, 129, 0.3)' }} />
            <div className="absolute top-1/2 -translate-y-1/2 w-1 h-5 rounded-full" style={{ left: `${Math.min(Math.max(((z.zScore - 0) / 5) * 100, 0), 100)}%`, background: z.zone === 'safe' ? '#10B981' : z.zone === 'grey' ? '#F59E0B' : '#EF4444' }} />
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-red-400">{isArabic ? 'خطر' : 'Distress'}</span>
            <span className="text-amber-400">{isArabic ? 'حذر' : 'Grey'}</span>
            <span className="text-emerald-400">{isArabic ? 'آمن' : 'Safe'}</span>
          </div>
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            {isArabic ? 'احتمالية التعثر:' : 'Bankruptcy Probability:'} {(z.probability * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Components */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
        {[
          { label: 'X1', desc: 'WC/TA', value: z.components.x1 },
          { label: 'X2', desc: 'RE/TA', value: z.components.x2 },
          { label: 'X3', desc: 'EBIT/TA', value: z.components.x3 },
          { label: 'X4', desc: 'Eq/Liab', value: z.components.x4 },
          { label: 'X5', desc: 'Rev/TA', value: z.components.x5 },
        ].map(c => (
          <div key={c.label} className="rounded-xl p-3 border text-center" style={{ background: 'var(--bg-deep)', borderColor: 'var(--border-color)' }}>
            <div className="text-xs font-bold mb-1" style={{ color: 'var(--accent-primary)' }}>{c.label}</div>
            <div className="text-lg font-bold">{formatRatio(c.value)}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
