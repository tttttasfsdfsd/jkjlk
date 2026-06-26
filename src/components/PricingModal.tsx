import { X, Check, Zap, Shield, Crown } from 'lucide-react';
import { upgradeplan, type User } from '@/lib/authStore';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: (user: User) => void;
  currentPlan?: string;
}

const plans = [
  {
    id: 'free',
    name: 'مجاني',
    price: '0',
    period: 'ريال/شهر',
    icon: Zap,
    color: 'gray',
    features: [
      '3 تقارير شهرية',
      'تحليل Excel و PDF',
      'المؤشرات المالية الأساسية',
      'تصدير PDF',
    ],
    cta: 'حسابك الحالي',
    disabled: true,
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '199',
    period: 'ريال/شهر',
    icon: Shield,
    color: 'blue',
    badge: 'الأكثر شعبية',
    features: [
      '30 تقرير شهرياً',
      'كل مؤشرات الخطة المجانية',
      'تحليل Altman Z & Beneish M',
      'تنبيهات ذكية فورية',
      'حفظ التقارير التاريخية',
      'مساعد AI مالي متقدم',
      'تصدير تقارير PDF عربية',
    ],
    cta: 'ابدأ Starter',
    disabled: false,
  },
  {
    id: 'professional',
    name: 'Professional',
    price: '499',
    period: 'ريال/شهر',
    icon: Crown,
    color: 'purple',
    features: [
      'تقارير غير محدودة',
      'كل مزايا Starter',
      'تكامل QuickBooks',
      'حاسبة تقييم متقدمة',
      'تحليل السيناريوهات المتقدم',
      'تنبيهات مخصصة',
      'دعم أولوية',
      'API Access',
    ],
    cta: 'ابدأ Professional',
    disabled: false,
  },
];

export default function PricingModal({ isOpen, onClose, onUpgrade, currentPlan = 'free' }: PricingModalProps) {
  if (!isOpen) return null;

  const handleUpgrade = (planId: string) => {
    if (planId === 'free' || planId === currentPlan) return;
    try {
      const user = upgradeplan(planId as 'starter' | 'professional');
      onUpgrade(user);
      onClose();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8">
      <div className="relative w-full max-w-4xl mx-4 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-8">
        <button onClick={onClose} className="absolute top-4 left-4 text-gray-400 hover:text-white">
          <X size={20} />
        </button>

        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white">اختر خطتك</h2>
          <p className="text-gray-400 mt-2">ابدأ مجاناً — لا بطاقة ائتمانية مطلوبة</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map(plan => {
            const Icon = plan.icon;
            const isCurrentPlan = plan.id === currentPlan;
            const isBest = plan.badge;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border p-6 flex flex-col ${
                  isBest
                    ? 'border-blue-500 bg-blue-500/5'
                    : plan.id === 'professional'
                    ? 'border-purple-500/50 bg-purple-500/5'
                    : 'border-gray-700 bg-gray-800/50'
                }`}
              >
                {isBest && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-bold px-4 py-1 rounded-full">
                    {plan.badge}
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 rounded-xl ${
                    plan.id === 'starter' ? 'bg-blue-500/20 text-blue-400' :
                    plan.id === 'professional' ? 'bg-purple-500/20 text-purple-400' :
                    'bg-gray-700 text-gray-400'
                  }`}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{plan.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-2xl font-black ${
                        plan.id === 'starter' ? 'text-blue-400' :
                        plan.id === 'professional' ? 'text-purple-400' :
                        'text-gray-300'
                      }`}>{plan.price}</span>
                      <span className="text-gray-400 text-sm">{plan.period}</span>
                    </div>
                  </div>
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <Check size={14} className={`mt-0.5 flex-shrink-0 ${
                        plan.id === 'starter' ? 'text-blue-400' :
                        plan.id === 'professional' ? 'text-purple-400' :
                        'text-gray-500'
                      }`} />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={plan.disabled || isCurrentPlan}
                  className={`w-full py-3 rounded-xl font-semibold transition-all ${
                    isCurrentPlan
                      ? 'bg-gray-700 text-gray-400 cursor-default'
                      : plan.id === 'starter'
                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                      : plan.id === 'professional'
                      ? 'bg-purple-600 hover:bg-purple-500 text-white'
                      : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isCurrentPlan ? '✓ خطتك الحالية' : plan.cta}
                </button>
              </div>
            );
          })}
        </div>

        <p className="text-center text-gray-500 text-xs mt-6">
          🔒 بياناتك محمية &nbsp;·&nbsp; يمكن إلغاء الاشتراك في أي وقت &nbsp;·&nbsp; دعم 24/7
        </p>
      </div>
    </div>
  );
}
