/**
 * InsightsPanel — P2-11 extraction from Home.tsx
 * Renders AI-generated financial insights cards.
 */
import { ClipboardList, AlertTriangle, Lightbulb, CheckCircle2 } from 'lucide-react';

interface Insight {
  type: 'summary' | 'risk' | 'opportunity' | 'recommendation';
  title: string;
  text: string;
}

interface InsightsPanelProps {
  insights: Insight[];
  title: string;
}

const ICONS: Record<Insight['type'], React.ElementType> = {
  summary:        ClipboardList,
  risk:           AlertTriangle,
  opportunity:    Lightbulb,
  recommendation: CheckCircle2,
};

const COLORS: Record<Insight['type'], string> = {
  summary:        '#4F6AF6',
  risk:           '#EF4444',
  opportunity:    '#10B981',
  recommendation: '#F59E0B',
};

const BORDER_CLASS: Record<Insight['type'], string> = {
  summary:        'border-primary',
  risk:           'risk',
  opportunity:    'opportunity',
  recommendation: 'recommendation',
};

export default function InsightsPanel({ insights, title }: InsightsPanelProps) {
  return (
    <div className="rounded-2xl p-6 mb-6 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
      <h2 className="font-bold text-lg mb-5">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {insights.map((insight, i) => {
          const Icon = ICONS[insight.type] ?? ClipboardList;
          return (
            <div key={i} className={`insight-card ${BORDER_CLASS[insight.type] ?? 'border-primary'}`}>
              <div className="flex items-center gap-2 mb-2 text-sm font-bold">
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color: COLORS[insight.type] }} />
                {insight.title}
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {insight.text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
