import type { ProfitabilityRatios } from '@/types/financial';
import { formatPercent } from '@/lib/formatters';

interface Props { profitability: ProfitabilityRatios; t: Record<string, string>; isRTL: boolean; }

function RatioCard({ label, value, formula, status }: { label: string; value: number; formula: string; status: string }) {
  const statusColors: Record<string, string> = {
    'Excellent':'text-emerald-400','Good':'text-cyan-400','Moderate':'text-amber-400','Weak':'text-red-400',
    'ممتاز':'text-emerald-400','جيد':'text-cyan-400','متوسط':'text-amber-400','ضعيف':'text-red-400','—':'text-gray-500',
  };
  const display = value === 0 ? '—' : formatPercent(value);
  return (
    <div className="rounded-xl p-4 border" style={{ background:'var(--bg-deep)', borderColor:'var(--border-color)' }}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-sm" style={{ color:'var(--text-secondary)' }}>{label}</span>
        <span className={`text-xs font-bold ${statusColors[status] || 'text-gray-400'}`}>{status}</span>
      </div>
      <div className="text-2xl font-bold mb-1">{display}</div>
      <div className="mono text-xs" style={{ color:'var(--text-muted)' }}>{formula}</div>
    </div>
  );
}

export default function ProfitabilityPanel({ profitability, t }: Props) {
  const p = profitability;
  const isArabic = !!t.grossMargin?.match(/[ا-ي]/);
  const s = (v: number, ex: number, gd: number) =>
    v === 0 ? '—' :
    v >= ex ? (isArabic ? 'ممتاز' : 'Excellent') :
    v >= gd ? (isArabic ? 'جيد'   : 'Good')      :
               (isArabic ? 'متوسط' : 'Moderate');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <RatioCard label={t.grossMargin     || 'هامش الربح الإجمالي'} value={p.grossMargin}     formula="Gross Profit / Revenue"       status={s(p.grossMargin,    40, 25)} />
      <RatioCard label={t.operatingMargin || 'هامش التشغيل'}        value={p.operatingMargin} formula="EBIT / Revenue"                status={s(p.operatingMargin,20, 10)} />
      <RatioCard label={t.ebitdaMargin    || 'هامش EBITDA'}         value={p.ebitdaMargin}    formula="EBITDA / Revenue"             status={s(p.ebitdaMargin,   25, 15)} />
      <RatioCard label={t.netMargin       || 'هامش الربح الصافي'}   value={p.netMargin}       formula="Net Income / Revenue"         status={s(p.netMargin,      15,  8)} />
      <RatioCard label={t.roa             || 'العائد على الأصول (ROA)'}         value={p.roa}             formula="Net Income / Total Assets"    status={s(p.roa,            10,  5)} />
      <RatioCard label={t.roe             || 'العائد على حقوق الملكية (ROE)'}   value={p.roe}             formula="Net Income / Equity"          status={s(p.roe,            15, 10)} />
      <RatioCard label={t.roce            || 'العائد على رأس المال المستثمر (ROCE)'} value={p.roce}       formula="EBIT / (Assets - CL)"         status={s(p.roce,           15, 10)} />
      <RatioCard label={t.roic            || 'العائد على الاستثمار (ROIC)'}     value={p.roic}            formula="NOPAT / Invested Capital"     status={s(p.roic,           12,  8)} />
    </div>
  );
}
