import type { CashFlowAnalysis } from '@/types/financial';
import { formatCurrency, formatNumber, getLiquidityRiskColor } from '@/lib/formatters';
import { TrendingDown, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

interface Props {
  cashFlow: CashFlowAnalysis;
  t: Record<string, string>;
  isRTL: boolean;
  showRunwayOnly?: boolean;
}

export default function CashFlowPanel({ cashFlow, t, isRTL, showRunwayOnly = false }: Props) {
  const cf = cashFlow;
  const riskColor = getLiquidityRiskColor(cf.liquidityRisk);

  const isArabic = isRTL;

  if (showRunwayOnly) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-6 p-4 rounded-xl border" style={{ background: 'var(--bg-deep)', borderColor: 'var(--border-color)' }}>
          <div className="text-center">
            <div className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>{t.monthsRunway || 'Months Runway'}</div>
            <div className={`text-4xl font-black ${riskColor}`}>{cf.monthsRunway >= 999 ? '∞' : formatNumber(cf.monthsRunway)}</div>
            <div className={`text-sm font-bold mt-1 ${riskColor}`}>
              {cf.liquidityRisk === 'safe' ? (isArabic ? 'آمن' : 'Safe') : cf.liquidityRisk === 'caution' ? (isArabic ? 'احترس' : 'Caution') : (isArabic ? 'خطر' : 'Danger')}
            </div>
          </div>
          <div className="flex-1 min-w-60 space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: 'var(--text-secondary)' }}>{isArabic ? 'المخزون النقدي' : 'Cash Reserve'}</span>
                <span>{cf.monthsRunway >= 12 ? (isArabic ? 'ممتاز' : 'Excellent') : cf.monthsRunway >= 6 ? (isArabic ? 'مقبول' : 'Adequate') : cf.monthsRunway >= 3 ? (isArabic ? 'منخفض' : 'Low') : (isArabic ? 'حرج' : 'Critical')}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                <div className={`h-full rounded-full bar-fill ${riskColor.replace('text-', 'bg-')}`} style={{ width: `${Math.min((cf.monthsRunway / 18) * 100, 100)}%` }} />
              </div>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {cf.monthsRunway >= 12
                ? (isArabic ? 'السيولة جيدة. لديك أكثر من سنة من النقد.' : 'Liquidity is strong. You have over a year of cash.')
                : cf.monthsRunway >= 6
                ? (isArabic ? 'السيولة مقبولة. راقب النفقات.' : 'Liquidity is adequate. Monitor expenses.')
                : (isArabic ? 'تحذير! قد تنفد السيولة قريباً. أنصح بالبحث عن تمويل.' : 'Warning! Cash may run out soon. Consider seeking financing.')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl p-4 border" style={{ background: 'var(--bg-deep)', borderColor: 'var(--border-color)' }}>
          <div className="flex items-center gap-2 mb-2">
            {cf.ocf >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{isArabic ? 'التدفق التشغيلي' : 'Operating CF'}</span>
          </div>
          <div className={`text-2xl font-bold ${cf.ocf >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(cf.ocf, isArabic ? ' ريال' : ' SAR')}</div>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: 'var(--bg-deep)', borderColor: 'var(--border-color)' }}>
          <div className="flex items-center gap-2 mb-2">
            {cf.fcf >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t.freeCashFlow || 'Free Cash Flow'}</span>
          </div>
          <div className={`text-2xl font-bold ${cf.fcf >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(cf.fcf, isArabic ? ' ريال' : ' SAR')}</div>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: 'var(--bg-deep)', borderColor: 'var(--border-color)' }}>
          <div className="flex items-center gap-2 mb-2">
            {cf.liquidityRisk === 'safe' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t.monthsRunway || 'Months Runway'}</span>
          </div>
          <div className={`text-2xl font-bold ${riskColor}`}>{cf.monthsRunway >= 999 ? '∞' : formatNumber(cf.monthsRunway)} {isArabic ? 'شهر' : 'months'}</div>
        </div>
      </div>

      {/* Burn Rate & Risk */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl p-4 border" style={{ background: 'var(--bg-deep)', borderColor: 'var(--border-color)' }}>
          <span className="text-sm block mb-2" style={{ color: 'var(--text-secondary)' }}>{t.burnRate || 'Monthly Burn Rate'}</span>
          <div className="text-2xl font-bold text-red-400">{formatCurrency(cf.burnRate, isArabic ? ' ريال' : ' SAR')}</div>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: 'var(--bg-deep)', borderColor: 'var(--border-color)' }}>
          <span className="text-sm block mb-2" style={{ color: 'var(--text-secondary)' }}>{t.fundingDependency || 'External Funding Dependency'}</span>
          <div className="text-2xl font-bold">{formatNumber(cf.fundingDependency)}%</div>
        </div>
      </div>
    </div>
  );
}
