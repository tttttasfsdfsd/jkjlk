import { useState } from 'react';
import { X, Mail, Lock, User, Sparkles } from 'lucide-react';
import { signIn, signUp, type User as AuthUser } from '@/lib/authStore';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
  defaultMode?: 'login' | 'signup';
}

export default function AuthModal({ isOpen, onClose, onSuccess, defaultMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>(defaultMode);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setError('');
    if (!email || !password) { setError('يرجى تعبئة جميع الحقول'); return; }
    if (mode === 'signup' && !name) { setError('يرجى إدخال اسمك'); return; }
    if (password.length < 6) { setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }

    setLoading(true);
    try {
      const user = mode === 'signup' ? signUp(email, name, password) : signIn(email, password);
      onSuccess(user);
      onClose();
    } catch (e: unknown) {
      setError((e as Error).message || 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-8">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
          <X size={20} />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm px-3 py-1 rounded-full mb-3">
            <Sparkles size={14} />
            <span>منصة EEXA المالية</span>
          </div>
          <h2 className="text-2xl font-bold text-white">
            {mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب'}
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {mode === 'login' ? 'أهلاً بعودتك' : '3 تقارير مجانية شهرياً'}
          </p>
        </div>

        <div className="space-y-4">
          {mode === 'signup' && (
            <div className="relative">
              <User size={16} className="absolute right-3 top-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="الاسم الكامل"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 pr-10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-right"
                dir="rtl"
              />
            </div>
          )}

          <div className="relative">
            <Mail size={16} className="absolute right-3 top-3.5 text-gray-400" />
            <input
              type="email"
              placeholder="البريد الإلكتروني"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 pr-10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-right"
              dir="rtl"
            />
          </div>

          <div className="relative">
            <Lock size={16} className="absolute right-3 top-3.5 text-gray-400" />
            <input
              type="password"
              placeholder="كلمة المرور"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 pr-10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-right"
              dir="rtl"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-2 rounded-xl text-right">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {loading ? '...' : mode === 'login' ? 'دخول' : 'إنشاء الحساب'}
          </button>
        </div>

        <p className="text-center text-gray-400 text-sm mt-4">
          {mode === 'login' ? 'ليس لديك حساب؟ ' : 'لديك حساب؟ '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
            className="text-blue-400 hover:text-blue-300 font-medium"
          >
            {mode === 'login' ? 'سجّل الآن' : 'ادخل هنا'}
          </button>
        </p>

        {mode === 'signup' && (
          <div className="mt-4 pt-4 border-t border-gray-800">
            <p className="text-xs text-gray-500 text-center">
              ✅ 3 تقارير مجانية/شهر &nbsp;·&nbsp; 🔒 بياناتك آمنة &nbsp;·&nbsp; 🚫 لا بطاقة مطلوبة
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
