import type { ScenarioAnalysis } from '@/types/financial';
import { formatCurrency } from '@/lib/formatters';

interface Props {
  scenarios: ScenarioAnalysis;
  t: Record<string, string>;
  isRTL: boolean;
}

function ScenarioCard({ scenario, color }: { scenario: typeof scenarios.bestCase; color: string }) {
  const isArabic = scenario.name === 'Best Case' || scenario.name === 'أفضل سيناريو' ? false : scenario.name === 'أفضل سيناريو';

  return (
    <div className="rounded-xl p-4 border" style={{ background: 'var(--bg-deep)', borderColor: 'var(--border-color)', borderTop: `3px solid ${color}` }}>
      <h4 className="font-bold mb-3" style={{ color }}>{scenario.name}</h4>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span style={{ color: 'var(--text-secondary)' }}>Revenue Growth</span>
          <span className={scenario.revenueGrowth > 0 ? 'text-emerald-400' : 'text-red-400'}>{scenario.revenueGrowth > 0 ? '+' : ''}{scenario.revenueGrowth}%</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--text-secondary)' }}>Cost Change</span>
          <span className={scenario.costChange < 0 ? 'text-emerald-400' : 'text-red-400'}>{scenario.costChange > 0 ? '+' : ''}{scenario.costChange}%</span>
        </div>
        <div className="h-px my-2" style={{ background: 'var(--border-color)' }} />
        <div className="flex justify-between">
          <span style={{ color: 'var(--text-secondary)' }}>Projected Revenue</span>
          <span className="font-bold">{formatCurrency(scenario.projectedRevenue, ' SAR')}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--text-secondary)' }}>Projected Profit</span>
          <span className={`font-bold ${scenario.projectedProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(scenario.projectedProfit, ' SAR')}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--text-secondary)' }}>Projected Cash</span>
          <span className="font-bold">{formatCurrency(scenario.projectedCash, ' SAR')}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--text-secondary)' }}>Liquidity</span>
          <span className={`font-bold ${scenario.projectedLiquidity >= 1.5 ? 'text-emerald-400' : scenario.projectedLiquidity >= 1 ? 'text-amber-400' : 'text-red-400'}`}>{scenario.projectedLiquidity.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

export default function ScenarioPanel({ scenarios, t }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <ScenarioCard scenario={scenarios.bestCase} color="#10B981" />
      <ScenarioCard scenario={scenarios.baseCase} color="#4F6AF6" />
      <ScenarioCard scenario={scenarios.worstCase} color="#EF4444" />
    </div>
  );
}
