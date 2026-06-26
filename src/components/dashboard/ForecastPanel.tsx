import { useState } from 'react';
import { Line } from 'react-chartjs-2';
import type { Forecasts } from '@/types/financial';

interface Props {
  forecasts: Forecasts;
  months: string[];
  monthlyRevenue: number[];
  monthlyNetIncome: number[];
  monthlyCash: number[];
  t: Record<string, string>;
  isRTL: boolean;
}

const C = { primary: '#4F6AF6', secondary: '#06B6D4', tertiary: '#8B5CF6', success: '#10B981' };

export default function ForecastPanel({ forecasts, months, monthlyRevenue, monthlyNetIncome, monthlyCash, t, isRTL }: Props) {
  const [period, setPeriod] = useState<3 | 6 | 12 | 24>(12);
  const isArabic = isRTL;

  const periods = [
    { value: 3 as const, label: isArabic ? '3 أشهر' : '3M' },
    { value: 6 as const, label: isArabic ? '6 أشهر' : '6M' },
    { value: 12 as const, label: isArabic ? '12 شهر' : '12M' },
    { value: 24 as const, label: isArabic ? '24 شهر' : '24M' },
  ];

  const sliceForecast = (arr: typeof forecasts.revenue) => arr.slice(0, period);
  const forecastMonths = sliceForecast(forecasts.revenue).map((_, i) => `F${i + 1}`);

  const allLabels = [...months, ...forecastMonths];

  const createChartData = (hist: number[], forecast: typeof forecasts.revenue, color: string) => ({
    labels: allLabels,
    datasets: [
      {
        label: isArabic ? 'تاريخي' : 'Historical',
        data: [...hist, ...Array(period).fill(null)],
        borderColor: color,
        backgroundColor: color + '15',
        fill: true,
        tension: 0.4,
        pointRadius: 2,
        borderWidth: 2,
      },
      {
        label: isArabic ? 'توقع' : 'Forecast',
        data: [...Array(hist.length).fill(null), ...sliceForecast(forecast).map(f => f.value)],
        borderColor: color,
        backgroundColor: color + '10',
        borderDash: [5, 5],
        fill: true,
        tension: 0.4,
        pointRadius: 2,
        borderWidth: 2,
      },
      {
        label: isArabic ? 'نطاق الثقة' : 'Confidence',
        data: [...Array(hist.length).fill(null), ...sliceForecast(forecast).map(f => f.upperBound)],
        borderColor: 'transparent',
        backgroundColor: 'transparent',
        pointRadius: 0,
        fill: false,
      },
      {
        label: '',
        data: [...Array(hist.length).fill(null), ...sliceForecast(forecast).map(f => f.lowerBound)],
        borderColor: 'transparent',
        backgroundColor: color + '08',
        pointRadius: 0,
        fill: '-1',
      },
    ],
  });

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' as const, labels: { color: '#8896AB', font: { size: 10 }, boxWidth: 8 } } },
    scales: { y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8896AB', font: { size: 9 } } }, x: { grid: { display: false }, ticks: { color: '#8896AB', font: { size: 8 }, maxRotation: 45 } } },
  };

  return (
    <div className="space-y-4">
      {/* Period Selector */}
      <div className="flex gap-2 flex-wrap">
        {periods.map(p => (
          <button key={p.value} onClick={() => setPeriod(p.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${period === p.value ? 'border-[#4F6AF6] text-[#4F6AF6]' : 'border-[#1E2D45] text-[#8896AB] hover:border-[#4F6AF6]/50'}`}
            style={{ background: period === p.value ? 'rgba(79,106,246,0.1)' : 'var(--bg-deep)' }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Forecast Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl p-4 border" style={{ background: 'var(--bg-deep)', borderColor: 'var(--border-color)' }}>
          <h4 className="text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>{isArabic ? 'توقع الإيرادات' : 'Revenue Forecast'}</h4>
          <div className="h-48">
            <Line data={createChartData(monthlyRevenue, forecasts.revenue, C.primary)} options={chartOptions} />
          </div>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: 'var(--bg-deep)', borderColor: 'var(--border-color)' }}>
          <h4 className="text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>{isArabic ? 'توقع الأرباح' : 'Profit Forecast'}</h4>
          <div className="h-48">
            <Line data={createChartData(monthlyNetIncome, forecasts.profit, C.success)} options={chartOptions} />
          </div>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: 'var(--bg-deep)', borderColor: 'var(--border-color)' }}>
          <h4 className="text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>{isArabic ? 'توقع EBITDA' : 'EBITDA Forecast'}</h4>
          <div className="h-48">
            <Line data={createChartData(monthlyNetIncome, forecasts.ebitda, C.secondary)} options={chartOptions} />
          </div>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: 'var(--bg-deep)', borderColor: 'var(--border-color)' }}>
          <h4 className="text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>{isArabic ? 'توقع الرصيد النقدي' : 'Cash Balance Forecast'}</h4>
          <div className="h-48">
            <Line data={createChartData(monthlyCash, forecasts.cashBalance, C.tertiary)} options={chartOptions} />
          </div>
        </div>
      </div>
    </div>
  );
}
