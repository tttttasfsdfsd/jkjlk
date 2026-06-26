import type { DuPontAnalysis } from '@/types/financial';
import { formatPercent, formatRatio } from '@/lib/formatters';
import { GitMerge } from 'lucide-react';

interface Props { dupont: DuPontAnalysis; t: Record<string, string>; isRTL: boolean; }

export default function DuPontPanel({ dupont, t }: Props) {
  const d = dupont;
  const roeDisplay = d.roe === 0 ? '—' : formatPercent(d.roe);
  const npmDisplay = d.netProfitMargin === 0 ? '—' : formatPercent(d.netProfitMargin);
  const atoDisplay = d.assetTurnover   === 0 ? '—' : formatRatio(d.assetTurnover, 2);
  const flDisplay  = d.financialLeverage === 0 ? '—' : formatRatio(d.financialLeverage, 2);

  return (
    <div className="rounded-2xl border p-6" style={{ background:'var(--bg-card)', borderColor:'var(--border-color)' }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <GitMerge size={18} className="text-[#4F6AF6]" />
          <h3 className="font-bold text-lg">تحليل DuPont</h3>
        </div>
      </div>

      {/* ROE */}
      <div className="text-center mb-6 p-4 rounded-xl" style={{ background:'var(--bg-deep)' }}>
        <p className="text-sm mb-1" style={{ color:'var(--text-secondary)' }}>ROE</p>
        <p className="text-4xl font-black text-[#4F6AF6]">{roeDisplay}</p>
        <p className="text-xs mt-1" style={{ color:'var(--text-muted)' }}>Net Margin × Asset Turnover × Financial Leverage</p>
      </div>

      {/* 3 components */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label:'هامش الربح الصافي', value:npmDisplay, sub:'Net Income / Revenue',     pct:d.npmContribution },
          { label:'دوران الأصول',       value:atoDisplay, sub:'Revenue / Total Assets',   pct:d.atoContribution },
          { label:'الرافعة المالية',    value:flDisplay,  sub:'Total Assets / Equity',    pct:d.flContribution },
        ].map((c, i) => (
          <div key={i} className="rounded-xl p-4 border text-center" style={{ background:'var(--bg-deep)', borderColor:'var(--border-color)' }}>
            <p className="text-xs mb-2" style={{ color:'var(--text-secondary)' }}>{c.label}</p>
            <p className="text-2xl font-bold text-[#4F6AF6]">{c.value}</p>
            <p className="mono text-xs mt-1" style={{ color:'var(--text-muted)' }}>{c.sub}</p>
            <div className="mt-2">
              <div className="h-1 rounded-full" style={{ background:'var(--border-color)' }}>
                <div className="h-1 rounded-full bg-[#4F6AF6]" style={{ width:`${Math.min(100, c.pct||0)}%` }} />
              </div>
              <p className="text-xs mt-1" style={{ color:'var(--text-muted)' }}>مساهمة {(c.pct||0).toFixed(1)}%</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
