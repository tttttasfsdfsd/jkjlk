import type { EfficiencyRatios } from '@/types/financial';
import { formatRatio, formatDays } from '@/lib/formatters';

interface Props { efficiency: EfficiencyRatios; t: Record<string, string>; isRTL: boolean; }

function RatioCard({ label, value, target, days }: { label: string; value: number; target: string; days?: boolean }) {
  const display = value === 0 ? '—' : days ? `${formatDays(value)} يوم` : formatRatio(value);
  return (
    <div className="rounded-xl p-4 border" style={{ background:'var(--bg-deep)', borderColor:'var(--border-color)' }}>
      <span className="text-sm block mb-2" style={{ color:'var(--text-secondary)' }}>{label}</span>
      <div className="text-2xl font-bold mb-1">{display}</div>
      <div className="text-xs" style={{ color:'var(--text-muted)' }}>{target}</div>
    </div>
  );
}

export default function EfficiencyPanel({ efficiency, t }: Props) {
  const e = efficiency;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <RatioCard label={t.assetTurnover      || 'دوران الأصول'}          value={e.assetTurnover}      target="المستهدف: أكثر من 0.5" />
      <RatioCard label={t.fixedAssetTurnover || 'دوران الأصول الثابتة'}  value={e.fixedAssetTurnover} target="المستهدف: أكثر من 2.0" />
      <RatioCard label={t.inventoryTurnover  || 'دوران المخزون'}          value={e.inventoryTurnover}  target="المستهدف: أكثر من 6" />
      <RatioCard label={t.dio                || 'أيام المخزون (DIO)'}     value={e.dio}                target="المستهدف: أقل من 60 يوم"  days />
      <RatioCard label={t.arTurnover         || 'دوران المدينين'}          value={e.arTurnover}         target="المستهدف: أكثر من 8" />
      <RatioCard label={t.dso                || 'أيام المبيعات (DSO)'}    value={e.dso}                target="المستهدف: أقل من 45 يوم"  days />
      <RatioCard label={t.apTurnover         || 'دوران الدائنين'}          value={e.apTurnover}         target="المستهدف: أكثر من 6" />
      <RatioCard label={t.dpo                || 'أيام المشتريات (DPO)'}   value={e.dpo}                target="المستهدف: 30-60 يوم"       days />
      <RatioCard label={t.ccc                || 'دورة التحويل النقدي'}     value={e.ccc}                target="المستهدف: أقل من 60 يوم"  days />
    </div>
  );
}
