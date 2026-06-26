// ==================== SAFE FORMATTERS ====================
// All formatters guard against: NaN, Infinity, overflow, unrealistic values

/** Cap for ratio/percentage display — anything beyond is "N/A" */
const MAX_PERCENT = 999.9;    // 999.9% max displayed
const MAX_RATIO   = 99999;    // for turnover ratios
const MAX_DAYS    = 9999;     // for DIO/DSO/DPO days

function isBad(v: unknown): v is undefined | null {
  return v === undefined || v === null || typeof v !== 'number' || isNaN(v) || !isFinite(v);
}

export function formatCurrency(value: number | undefined, currency = ' SAR'): string {
  if (isBad(value)) return `0${currency}`;
  const absVal = Math.abs(value as number);
  const sign = (value as number) < 0 ? '-' : '';
  if (absVal >= 1_000_000_000) return `${sign}${(absVal / 1_000_000_000).toFixed(1)}B${currency}`;
  if (absVal >= 1_000_000)     return `${sign}${(absVal / 1_000_000).toFixed(1)}M${currency}`;
  if (absVal >= 1_000)         return `${sign}${(absVal / 1_000).toFixed(1)}K${currency}`;
  return `${sign}${absVal.toFixed(0)}${currency}`;
}

export function formatNumber(value: number | undefined, decimals = 1): string {
  if (isBad(value)) return '—';
  if (Math.abs(value as number) > MAX_RATIO) return '—';
  return (value as number).toFixed(decimals);
}

export function formatPercent(value: number | undefined, decimals = 1): string {
  if (isBad(value)) return '—';
  const v = value as number;
  // Clamp to realistic range
  if (Math.abs(v) > MAX_PERCENT) return '—';
  return `${v.toFixed(decimals)}%`;
}

export function formatRatio(value: number | undefined, decimals = 2): string {
  if (isBad(value)) return '—';
  const v = value as number;
  if (Math.abs(v) > MAX_RATIO) return '—';
  return v.toFixed(decimals);
}

export function formatDays(value: number | undefined, decimals = 1): string {
  if (isBad(value)) return '—';
  const v = value as number;
  if (v < 0 || v > MAX_DAYS) return '—';
  return `${v.toFixed(decimals)}`;
}

export function getScoreColor(score: number): { text: string; border: string; bg: string } {
  if (score >= 80) return { text: 'text-emerald-400', border: 'border-emerald-400', bg: 'bg-emerald-400/20' };
  if (score >= 60) return { text: 'text-cyan-400',    border: 'border-cyan-400',    bg: 'bg-cyan-400/20' };
  if (score >= 40) return { text: 'text-amber-400',   border: 'border-amber-400',   bg: 'bg-amber-400/20' };
  return              { text: 'text-red-400',     border: 'border-red-400',     bg: 'bg-red-400/20' };
}

export function getStatusBadge(
  value: number,
  thresholds: { excellent: number; good: number; moderate: number },
  labels: { excellent: string; good: string; moderate: string; weak: string }
): { text: string; color: string } {
  if (value >= thresholds.excellent) return { text: labels.excellent, color: 'text-emerald-400' };
  if (value >= thresholds.good)      return { text: labels.good,      color: 'text-cyan-400' };
  if (value >= thresholds.moderate)  return { text: labels.moderate,  color: 'text-amber-400' };
  return                                    { text: labels.weak,      color: 'text-red-400' };
}

export function getAltmanZoneColor(zone: 'safe' | 'grey' | 'distress'): string {
  switch (zone) {
    case 'safe':     return 'text-emerald-400';
    case 'grey':     return 'text-amber-400';
    case 'distress': return 'text-red-400';
  }
}

export function getBeneishStatusColor(isManipulator: boolean): string {
  return isManipulator ? 'text-red-400' : 'text-emerald-400';
}

export function getLiquidityRiskColor(risk: 'safe' | 'caution' | 'danger'): string {
  switch (risk) {
    case 'safe':    return 'text-emerald-400';
    case 'caution': return 'text-amber-400';
    case 'danger':  return 'text-red-400';
  }
}
