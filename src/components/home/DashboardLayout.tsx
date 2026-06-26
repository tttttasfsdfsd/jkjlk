/**
 * DashboardLayout — P2-11 extraction from Home.tsx
 * Wraps the main dashboard grid with header and export controls.
 */
import { forwardRef } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import ScoreRing from '@/components/dashboard/ScoreRing';

interface DashboardLayoutProps {
  score: number;
  scoreLabel: string;
  scoreColors: { ring: string; bg: string; text: string };
  companyName: string;
  exportLoading: boolean;
  isRTL: boolean;
  t: Record<string, string>;
  onExport: () => void;
  onNewAnalysis: () => void;
  children: React.ReactNode;
}

const DashboardLayout = forwardRef<HTMLDivElement, DashboardLayoutProps>(({
  score, scoreLabel, scoreColors, companyName, exportLoading,
  isRTL, t, onExport, onNewAnalysis, children,
}, ref) => {
  return (
    <div ref={ref} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Score header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <ScoreRing score={score} colors={scoreColors} size={72} />
          <div>
            <h2 className="text-xl font-bold text-white">{companyName}</h2>
            <p className={`text-sm font-medium ${scoreColors.text}`}>{scoreLabel}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onNewAnalysis}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10
              text-sm text-white/70 hover:text-white hover:border-white/30 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {isRTL ? 'تحليل جديد' : 'New analysis'}
          </button>
          <button
            onClick={onExport}
            disabled={exportLoading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl gradient-primary
              text-sm text-white disabled:opacity-50 transition-opacity"
          >
            <Download className="w-3.5 h-3.5" />
            {exportLoading ? '...' : (isRTL ? 'تصدير PDF' : 'Export PDF')}
          </button>
        </div>
      </div>

      {/* Panel grid */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {children}
      </div>
    </div>
  );
});

DashboardLayout.displayName = 'DashboardLayout';
export default DashboardLayout;
