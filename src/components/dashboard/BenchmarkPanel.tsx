import type { BenchmarkComparison } from '@/types/financial';

interface Props {
  benchmarks: BenchmarkComparison[];
  t: Record<string, string>;
  isRTL: boolean;
}

export default function BenchmarkPanel({ benchmarks, t, isRTL }: Props) {
  const isArabic = isRTL;

  return (
    <div className="space-y-3">
      {benchmarks.map((b, i) => (
        <div key={i} className="rounded-xl p-4 border" style={{ background: 'var(--bg-deep)', borderColor: 'var(--border-color)' }}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{b.metric}</span>
            <span className={`text-xs font-bold ${b.status === 'above' ? 'text-emerald-400' : b.status === 'below' ? 'text-red-400' : 'text-amber-400'}`}>
              {b.status === 'above' ? (isArabic ? 'أعلى' : 'Above') : b.status === 'below' ? (isArabic ? 'أقل' : 'Below') : (isArabic ? 'متوسط' : 'Average')}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: 'var(--text-muted)' }}>{isArabic ? 'متوسط الصناعة' : 'Industry'}: {b.industryAvg.toFixed(1)}</span>
                <span className="font-bold">{b.companyValue.toFixed(1)}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                <div className="h-full rounded-full bar-fill" style={{
                  width: `${Math.min(b.percentile, 100)}%`,
                  background: b.status === 'above' ? '#10B981' : b.status === 'below' ? '#EF4444' : '#F59E0B'
                }} />
              </div>
            </div>
            <div className="text-center min-w-16">
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{isArabic ? 'النسبة' : 'Pctile'}</div>
              <div className="text-lg font-bold" style={{ color: b.percentile >= 60 ? '#10B981' : b.percentile >= 40 ? '#F59E0B' : '#EF4444' }}>
                {b.percentile.toFixed(0)}%
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
