import { AlertTriangle, CheckCircle2, Info, AlertCircle, ChevronRight } from 'lucide-react';
import type { SmartAlert } from '@/lib/financialEngine';

interface SmartAlertsProps {
  alerts: SmartAlert[];
}

const config = {
  danger: { icon: AlertCircle, bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', badge: 'bg-red-500' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', badge: 'bg-amber-500' },
  info: { icon: Info, bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', badge: 'bg-blue-500' },
  success: { icon: CheckCircle2, bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', badge: 'bg-emerald-500' },
};

export default function SmartAlerts({ alerts }: SmartAlertsProps) {
  if (!alerts || alerts.length === 0) return null;

  const dangerCount = alerts.filter(a => a.type === 'danger').length;
  const warningCount = alerts.filter(a => a.type === 'warning').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-400" />
          التنبيهات الذكية
          {(dangerCount > 0 || warningCount > 0) && (
            <div className="flex gap-1">
              {dangerCount > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                  {dangerCount} خطر
                </span>
              )}
              {warningCount > 0 && (
                <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                  {warningCount} تحذير
                </span>
              )}
            </div>
          )}
        </h3>
        <span className="text-xs text-gray-500">{alerts.length} تنبيه</span>
      </div>

      {alerts.map(alert => {
        const c = config[alert.type];
        const Icon = c.icon;
        return (
          <div
            key={alert.id}
            className={`${c.bg} ${c.border} border rounded-xl p-4 flex items-start gap-3`}
          >
            <Icon size={18} className={`${c.text} flex-shrink-0 mt-0.5`} />
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm ${c.text}`}>{alert.title}</p>
              <p className="text-gray-300 text-sm mt-0.5 leading-relaxed">{alert.message}</p>
              {alert.actionLabel && (
                <button className={`${c.text} text-xs font-medium mt-2 flex items-center gap-1 hover:underline`}>
                  {alert.actionLabel}
                  <ChevronRight size={12} />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
