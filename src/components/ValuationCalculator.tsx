import { useState } from 'react';
import { Calculator, TrendingUp, DollarSign, BarChart3, Info } from 'lucide-react';

interface ValuationResult {
  dcf: number;
  evEbitda: number;
  priceToEarnings: number;
  priceToBook: number;
  revenueMultiple: number;
  avgValuation: number;
  range: { low: number; high: number };
}

export default function ValuationCalculator() {
  const [inputs, setInputs] = useState({
    revenue: '',
    ebitda: '',
    netIncome: '',
    bookValue: '',
    growthRate: '15',
    discountRate: '12',
    industry: 'general',
  });
  const [result, setResult] = useState<ValuationResult | null>(null);

  const industryMultiples: Record<string, { ev_ebitda: number; pe: number; ps: number }> = {
    general: { ev_ebitda: 8, pe: 15, ps: 1.5 },
    tech: { ev_ebitda: 15, pe: 25, ps: 4 },
    retail: { ev_ebitda: 7, pe: 12, ps: 0.8 },
    manufacturing: { ev_ebitda: 7, pe: 13, ps: 1.0 },
    services: { ev_ebitda: 9, pe: 16, ps: 1.8 },
    healthcare: { ev_ebitda: 12, pe: 20, ps: 2.5 },
    realestate: { ev_ebitda: 10, pe: 18, ps: 3 },
    food: { ev_ebitda: 8, pe: 14, ps: 1.2 },
  };

  const calculate = () => {
    const rev = parseFloat(inputs.revenue) || 0;
    const ebitda = parseFloat(inputs.ebitda) || 0;
    const netIncome = parseFloat(inputs.netIncome) || 0;
    const bookValue = parseFloat(inputs.bookValue) || 0;
    const g = parseFloat(inputs.growthRate) / 100;
    const r = parseFloat(inputs.discountRate) / 100;
    const mult = industryMultiples[inputs.industry] || industryMultiples.general;

    // DCF (simplified 5-year)
    let dcf = 0;
    if (netIncome > 0) {
      let cf = netIncome;
      for (let i = 1; i <= 5; i++) {
        cf *= (1 + g);
        dcf += cf / Math.pow(1 + r, i);
      }
      // Terminal value (Gordon Growth Model)
      const terminalValue = (cf * (1 + 0.03)) / (r - 0.03);
      dcf += terminalValue / Math.pow(1 + r, 5);
    }

    // EV/EBITDA
    const evEbitda = ebitda > 0 ? ebitda * mult.ev_ebitda : 0;

    // P/E
    const pe = netIncome > 0 ? netIncome * mult.pe : 0;

    // P/B
    const pb = bookValue > 0 ? bookValue * 1.5 : 0;

    // Revenue multiple
    const revMultiple = rev > 0 ? rev * mult.ps : 0;

    // Average (only non-zero)
    const vals = [dcf, evEbitda, pe, pb, revMultiple].filter(v => v > 0);
    const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;

    setResult({
      dcf,
      evEbitda,
      priceToEarnings: pe,
      priceToBook: pb,
      revenueMultiple: revMultiple,
      avgValuation: avg,
      range: { low: avg * 0.75, high: avg * 1.35 },
    });
  };

  const fmt = (n: number) => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toFixed(0);
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6" dir="rtl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-emerald-500/10 rounded-xl">
          <Calculator size={20} className="text-emerald-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">حاسبة تقييم الشركة</h2>
          <p className="text-gray-400 text-sm">احسب قيمة شركتك باستخدام 5 طرق تقييم مختلفة</p>
        </div>
        <div className="mr-auto">
          <span className="bg-emerald-500/10 text-emerald-400 text-xs border border-emerald-500/20 px-2 py-0.5 rounded-full">مجاناً</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">الإيرادات (ريال)</label>
          <input
            type="number"
            placeholder="1,000,000"
            value={inputs.revenue}
            onChange={e => setInputs(p => ({ ...p, revenue: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">EBITDA (ريال)</label>
          <input
            type="number"
            placeholder="200,000"
            value={inputs.ebitda}
            onChange={e => setInputs(p => ({ ...p, ebitda: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">صافي الربح (ريال)</label>
          <input
            type="number"
            placeholder="150,000"
            value={inputs.netIncome}
            onChange={e => setInputs(p => ({ ...p, netIncome: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">القيمة الدفترية</label>
          <input
            type="number"
            placeholder="500,000"
            value={inputs.bookValue}
            onChange={e => setInputs(p => ({ ...p, bookValue: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">معدل النمو المتوقع %</label>
          <input
            type="number"
            value={inputs.growthRate}
            onChange={e => setInputs(p => ({ ...p, growthRate: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">معدل الخصم (WACC) %</label>
          <input
            type="number"
            value={inputs.discountRate}
            onChange={e => setInputs(p => ({ ...p, discountRate: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-400 mb-1 block">القطاع الصناعي</label>
          <select
            value={inputs.industry}
            onChange={e => setInputs(p => ({ ...p, industry: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="general">عام</option>
            <option value="tech">تقنية</option>
            <option value="retail">تجزئة</option>
            <option value="manufacturing">تصنيع</option>
            <option value="services">خدمات</option>
            <option value="healthcare">صحة</option>
            <option value="realestate">عقارات</option>
            <option value="food">غذاء وأغذية</option>
          </select>
        </div>
      </div>

      <button
        onClick={calculate}
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        <Calculator size={18} />
        احسب التقييم
      </button>

      {result && (
        <div className="mt-6 space-y-4">
          {/* Main result */}
          <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-2xl p-6 text-center">
            <p className="text-gray-400 text-sm mb-1">متوسط قيمة الشركة المقدّرة</p>
            <p className="text-4xl font-black text-emerald-400">{fmt(result.avgValuation)} ريال</p>
            <p className="text-gray-400 text-sm mt-1">
              نطاق: {fmt(result.range.low)} — {fmt(result.range.high)} ريال
            </p>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: 'DCF (التدفقات المخصومة)', value: result.dcf, icon: TrendingUp },
              { label: 'EV/EBITDA', value: result.evEbitda, icon: BarChart3 },
              { label: 'مضاعف الأرباح P/E', value: result.priceToEarnings, icon: DollarSign },
              { label: 'القيمة الدفترية P/B', value: result.priceToBook, icon: BarChart3 },
              { label: 'مضاعف الإيرادات', value: result.revenueMultiple, icon: TrendingUp },
            ].filter(m => m.value > 0).map((m, i) => {
              const Icon = m.icon;
              return (
                <div key={i} className="bg-gray-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={14} className="text-blue-400" />
                    <span className="text-xs text-gray-400">{m.label}</span>
                  </div>
                  <p className="text-lg font-bold text-white">{fmt(m.value)}</p>
                  <p className="text-xs text-gray-500">ريال</p>
                </div>
              );
            })}
          </div>

          <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-800/50 rounded-xl p-3">
            <Info size={12} className="mt-0.5 flex-shrink-0 text-gray-400" />
            <span>هذا تقدير تعليمي بناءً على معايير السوق. للتقييم الرسمي، يُنصح بتوظيف محلل مالي معتمد.</span>
          </div>
        </div>
      )}
    </div>
  );
}
