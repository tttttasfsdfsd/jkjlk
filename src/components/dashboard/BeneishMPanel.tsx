import type { BeneishMScore } from '@/types/financial';
import { formatRatio, getBeneishStatusColor } from '@/lib/formatters';

interface Props {
  beneishM: BeneishMScore;
  t: Record<string, string>;
  isRTL: boolean;
}

export default function BeneishMPanel({ beneishM, t, isRTL }: Props) {
  const b = beneishM;
  const statusColor = getBeneishStatusColor(b.isManipulator);
  const isArabic = isRTL;

  const hasData = b.mScore !== -99;

  if (!hasData) {
    return (
      <div className="p-4 rounded-xl border text-center" style={{ background: 'var(--bg-deep)', borderColor: 'var(--border-color)' }}>
        <p style={{ color: 'var(--text-secondary)' }}>
          {isArabic ? 'يتطلب بيانات فترتين متتاليتين للحساب.' : 'Requires data from two consecutive periods to calculate.'}
        </p>
      </div>
    );
  }

  const statusLabel = b.isManipulator
    ? (isArabic ? 'مشبوه محتمل' : 'Possible Manipulator')
    : (isArabic ? 'غير مشبوه' : 'Unlikely Manipulator');

  return (
    <div className="space-y-4">
      {/* M-Score Display */}
      <div className="flex flex-wrap items-center gap-6 p-4 rounded-xl border" style={{ background: 'var(--bg-deep)', borderColor: 'var(--border-color)' }}>
        <div className="text-center">
          <div className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>M-Score</div>
          <div className={`text-4xl font-black ${statusColor}`}>{b.mScore.toFixed(2)}</div>
          <div className={`text-sm font-bold mt-1 ${statusColor}`}>{statusLabel}</div>
        </div>
        <div className="flex-1 min-w-60">
          <div className="flex justify-between text-xs mb-1">
            <span style={{ color: 'var(--text-muted)' }}>-4.00</span>
            <span style={{ color: 'var(--text-muted)' }}>-2.22</span>
            <span style={{ color: 'var(--text-muted)' }}>0.00</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden relative" style={{ background: 'var(--bg-elevated)' }}>
            <div className="absolute inset-y-0 left-0 w-[55%] rounded-l-full" style={{ background: 'rgba(16, 185, 129, 0.3)' }} />
            <div className="absolute inset-y-0 right-0 w-[45%] rounded-r-full" style={{ background: 'rgba(239, 68, 68, 0.3)' }} />
            <div className="absolute top-1/2 -translate-y-1/2 w-1 h-5 rounded-full"
              style={{ left: `${Math.min(Math.max(((b.mScore + 4) / 6) * 100, 0), 100)}%`, background: b.isManipulator ? '#EF4444' : '#10B981' }} />
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-emerald-400">{isArabic ? 'غير مشبوه' : 'Unlikely'}</span>
            <span className="text-red-400">{isArabic ? 'مشبوه' : 'Manipulator'}</span>
          </div>
        </div>
      </div>

      {/* Components */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'DSRI', desc: 'Days Sales Receivable Index', value: b.components.dsri },
          { label: 'GMI', desc: 'Gross Margin Index', value: b.components.gmi },
          { label: 'AQI', desc: 'Asset Quality Index', value: b.components.aqi },
          { label: 'SGI', desc: 'Sales Growth Index', value: b.components.sgi },
          { label: 'DEPI', desc: 'Depreciation Index', value: b.components.depi },
          { label: 'SGAI', desc: 'SGA Index', value: b.components.sgai },
          { label: 'LVGI', desc: 'Leverage Index', value: b.components.lvgi },
          { label: 'TATA', desc: 'Total Accruals/TA', value: b.components.tata },
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
