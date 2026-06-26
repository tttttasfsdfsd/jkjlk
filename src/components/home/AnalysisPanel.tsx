/**
 * AnalysisPanel — P2-11 extraction from Home.tsx
 * Displays the top-level metric cards after analysis completes.
 */
import type { LucideIcon } from 'lucide-react';

interface Metric {
  icon: LucideIcon;
  color: string;
  label: string;
  value: string;
  sub: string;
  subColor: string;
}

interface AnalysisPanelProps {
  metrics: Metric[];
  isRTL: boolean;
}

export default function AnalysisPanel({ metrics, isRTL }: AnalysisPanelProps) {
  if (!metrics.length) return null;

  return (
    <div
      className="grid gap-3"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
    >
      {metrics.map((m, i) => {
        const Icon = m.icon;
        return (
          <div
            key={i}
            className="rounded-2xl p-4 border border-white/8 hover:border-white/15 transition-all"
            style={{ background: 'var(--card-bg)' }}
          >
            <div className={`w-9 h-9 rounded-xl ${m.color} flex items-center justify-center mb-3`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{m.label}</p>
            <p className="text-base font-bold text-white leading-tight">{m.value}</p>
            <p className={`text-xs mt-0.5 ${m.subColor}`}>{m.sub}</p>
          </div>
        );
      })}
    </div>
  );
}
