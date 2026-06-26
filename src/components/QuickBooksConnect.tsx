import { useState } from 'react';
import { Link2, CheckCircle2, RefreshCw, AlertCircle, ExternalLink } from 'lucide-react';

interface QBData {
  revenue: number;
  expenses: number;
  netIncome: number;
  assets: number;
  liabilities: number;
  cash: number;
  accountsReceivable: number;
  accountsPayable: number;
  inventory: number;
  equity: number;
}

interface QuickBooksConnectProps {
  onDataImported: (data: QBData[]) => void;
  isProfessional: boolean;
}

export default function QuickBooksConnect({ onDataImported, isProfessional }: QuickBooksConnectProps) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [companyInfo, setCompanyInfo] = useState<{ name: string; lastSync: string } | null>(null);

  const handleConnect = () => {
    if (!isProfessional) {
      alert('هذه الميزة متاحة لمشتركي Professional فقط. قم بالترقية للاستمتاع بتكامل QuickBooks.');
      return;
    }

    setStatus('connecting');

    // Simulate OAuth flow — in production, redirect to QB OAuth endpoint
    // window.location.href = '/api/quickbooks/auth';
    setTimeout(() => {
      setStatus('connected');
      setCompanyInfo({
        name: 'شركة المثال للتجارة',
        lastSync: new Date().toLocaleDateString('ar-SA'),
      });

      // Simulate imported data (12 months)
      const mockData: QBData[] = Array.from({ length: 12 }, (_, i) => ({
        revenue: 180000 + i * 8000 + Math.random() * 20000,
        expenses: 140000 + i * 5000 + Math.random() * 10000,
        netIncome: 40000 + i * 3000 + Math.random() * 5000,
        assets: 600000 + i * 15000,
        liabilities: 200000 - i * 2000,
        cash: 150000 + i * 8000,
        accountsReceivable: 60000 + i * 2000,
        accountsPayable: 30000,
        inventory: 80000 + i * 1000,
        equity: 400000 + i * 12000,
      }));

      onDataImported(mockData);
    }, 2000);
  };

  const handleSync = () => {
    setStatus('connecting');
    setTimeout(() => {
      setStatus('connected');
      setCompanyInfo(prev => prev ? { ...prev, lastSync: new Date().toLocaleDateString('ar-SA') } : null);
    }, 1500);
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5" dir="rtl">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-green-500/10 rounded-xl">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Intuit_QuickBooks_logo.svg/200px-Intuit_QuickBooks_logo.svg.png"
            alt="QuickBooks"
            className="h-5 w-auto"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
        <div>
          <h3 className="font-bold text-white text-sm">تكامل QuickBooks</h3>
          <p className="text-gray-400 text-xs">استيراد البيانات تلقائياً</p>
        </div>
        {!isProfessional && (
          <span className="mr-auto bg-purple-500/20 text-purple-400 text-xs border border-purple-500/30 px-2 py-0.5 rounded-full">
            Professional
          </span>
        )}
      </div>

      {status === 'idle' && (
        <div>
          <p className="text-gray-400 text-xs mb-3">
            ربط حسابك في QuickBooks يتيح استيراد البيانات المالية تلقائياً بدون رفع ملفات.
          </p>
          <button
            onClick={handleConnect}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all ${
              isProfessional
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-60'
            }`}
          >
            <Link2 size={16} />
            ربط QuickBooks
          </button>
          {!isProfessional && (
            <p className="text-xs text-gray-500 text-center mt-2">يتطلب خطة Professional</p>
          )}
        </div>
      )}

      {status === 'connecting' && (
        <div className="text-center py-4">
          <RefreshCw size={24} className="text-green-400 animate-spin mx-auto mb-2" />
          <p className="text-gray-300 text-sm">جاري الاتصال بـ QuickBooks...</p>
        </div>
      )}

      {status === 'connected' && companyInfo && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl p-3">
            <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
            <div>
              <p className="text-green-400 font-semibold text-sm">{companyInfo.name}</p>
              <p className="text-gray-400 text-xs">آخر مزامنة: {companyInfo.lastSync}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSync}
              className="flex-1 flex items-center justify-center gap-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm py-2 rounded-xl transition-colors"
            >
              <RefreshCw size={14} />
              مزامنة الآن
            </button>
            <button
              onClick={() => { setStatus('idle'); setCompanyInfo(null); }}
              className="px-3 bg-gray-700 hover:bg-red-500/20 text-gray-400 hover:text-red-400 text-sm py-2 rounded-xl transition-colors"
            >
              فصل
            </button>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle size={16} />
          <span>فشل الاتصال. حاول مرة أخرى.</span>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-gray-700">
        <a
          href="https://developer.intuit.com/app/developer/qbo/docs/get-started"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300"
        >
          <ExternalLink size={10} />
          QuickBooks Developer Docs
        </a>
      </div>
    </div>
  );
}
