import { Clock, Trash2, ExternalLink, TrendingUp, TrendingDown } from 'lucide-react';
import { getSavedReports, deleteReport, type SavedReport } from '@/lib/authStore';
import { useState } from 'react';

interface SavedReportsProps {
  onLoad: (report: SavedReport) => void;
}

export default function SavedReports({ onLoad }: SavedReportsProps) {
  const [reports, setReports] = useState<SavedReport[]>(getSavedReports());

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteReport(id);
    setReports(getSavedReports());
  };

  if (reports.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Clock size={32} className="mx-auto mb-2 opacity-40" />
        <p className="text-sm">لا توجد تقارير محفوظة بعد</p>
        <p className="text-xs mt-1">ارفع ملفاً لتحليله وسيُحفظ تلقائياً</p>
      </div>
    );
  }

  const fmt = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toFixed(0);
  };

  return (
    <div className="space-y-3">
      {reports.map(report => (
        <div
          key={report.id}
          onClick={() => onLoad(report)}
          className="bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-blue-500/50 rounded-xl p-4 cursor-pointer transition-all group"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-white truncate">{report.companyName}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  report.score >= 80 ? 'bg-emerald-500/20 text-emerald-400' :
                  report.score >= 60 ? 'bg-blue-500/20 text-blue-400' :
                  report.score >= 40 ? 'bg-amber-500/20 text-amber-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {report.score}/100
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-gray-400">
                  {new Date(report.date).toLocaleDateString('ar-SA')}
                </span>
                <span className="text-xs text-gray-500">إيرادات: {fmt(report.revenue)} ريال</span>
                <span className={`text-xs flex items-center gap-1 ${report.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {report.netProfit >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {report.netMargin.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <ExternalLink size={14} className="text-blue-400" />
              <button
                onClick={e => handleDelete(report.id, e)}
                className="text-gray-500 hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
