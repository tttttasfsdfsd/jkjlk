import { useState, useRef, useCallback, useEffect } from 'react';
import {
  TrendingUp, Globe, Upload, CheckCircle, Play, Brain, RotateCcw,
  MessageCircle, Send, ChevronDown, ChevronUp, Wallet, Coins, Percent,
  Shield, Flame, PieChart, BarChart3, Activity, AlertTriangle, Lightbulb,
  CheckCircle2, ClipboardList, FileDown, DollarSign, Droplets, Building2,
  FileText, FileSpreadsheet, Zap, GitBranch, Award, Banknote, Telescope,
  Timer, Layers, Search, X
} from 'lucide-react';
import {
  Chart as ChartJS, ArcElement, BarElement, LineElement, PointElement,
  CategoryScale, LinearScale, Tooltip, Legend, Filler
} from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useLanguage } from '@/hooks/useLanguage';
import { formatCurrency, formatNumber, formatPercent, formatRatio, getScoreColor } from '@/lib/formatters';
import { trpc } from '@/providers/trpc';
import type { AnalysisResult, ChatMessage, Language } from '@/types/financial';
import ScoreRing from '@/components/dashboard/ScoreRing';

ChartJS.register(ArcElement, BarElement, LineElement, PointElement,
  CategoryScale, LinearScale, Tooltip, Legend, Filler);
import AuthModal from '@/components/AuthModal';
import PricingModal from '@/components/PricingModal';
import ValuationCalculator from '@/components/ValuationCalculator';
import SmartAlerts from '@/components/SmartAlerts';
import SavedReports from '@/components/SavedReports';
import QuickBooksConnect from '@/components/QuickBooksConnect';
import { getCurrentUser, setCurrentUser as setStoredUser, saveReport, type User, consumeReport, signOut } from '@/lib/authStore';
import type { SavedReport } from '@/lib/authStore';
// P2-11: Extracted components
import ReportViewer from '@/components/home/ReportViewer';
import InsightsPanel from '@/components/home/InsightsPanel';
import ChatWidget from '@/components/home/ChatWidget';

const C = {
  primary: '#4F6AF6',
  secondary: '#06B6D4',
  tertiary: '#8B5CF6',
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
};

export default function Home() {
  const { language, toggleLanguage, t, isRTL } = useLanguage();
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState<'excel' | 'pdf'>('excel');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.chat.send.useMutation();
  const [currentUser, setCurrentUser] = useState<User | null>(getCurrentUser());
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [showPricing, setShowPricing] = useState(false);
  const [showValuation, setShowValuation] = useState(false);
  const [showSavedReports, setShowSavedReports] = useState(false);
  const [showQB, setShowQB] = useState(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatLoading]);

  const processFile = useCallback(async (file: File) => {
    // Freemium gate
    const check = consumeReport();
    if (!check.allowed) {
      if (!check.user) {
        setAuthMode('signup');
        setShowAuth(true);
        return;
      }
      setShowPricing(true);
      return;
    }
    setLoading(true);
    setLoadingStep(1);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('companyName', companyName || (isRTL ? 'شركتي' : 'My Company'));
    formData.append('fileType', file.name?.endsWith('.pdf') ? 'pdf' : 'excel');

    setTimeout(() => setLoadingStep(2), 800);
    setTimeout(() => setLoadingStep(3), 1800);

    try {
      const res = await fetch('/api/analyze', { method: 'POST', body: formData });
      const data = await res.json();

      if (data.success) {
        setLoadingStep(4);
        setTimeout(() => {
          setResult(data);
          // Auto-save report
          try {
            saveReport({
              companyName: data.companyName || companyName || 'My Company',
              score: data.financials?.score?.overall ?? 0,
              revenue: data.financials?.totalRevenue ?? 0,
              netProfit: data.financials?.netProfit ?? 0,
              netMargin: data.financials?.netMargin ?? 0,
              data: data,
            });
          } catch {}
          setLoading(false);
          setChatMessages([{
            role: 'assistant',
            content: t.chatWelcome,
            time: new Date().toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })
          }]);
        }, 500);
      } else {
        alert(data.error || (isRTL ? 'حدث خطأ' : 'An error occurred'));
        setLoading(false);
      }
    } catch (err) {
      alert((isRTL ? 'خطأ في الاتصال: ' : 'Connection error: ') + (err instanceof Error ? err.message : ''));
      setLoading(false);
    }
  }, [companyName, isRTL, t.chatWelcome]);

  const handleFile = useCallback(async (file: File) => {
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const isPDF = file.name.endsWith('.pdf');
    if (!isExcel && !isPDF) {
      alert(isRTL ? 'يرجى رفع ملف Excel أو PDF فقط' : 'Please upload Excel or PDF files only');
      return;
    }
    setFileName(file.name);
    setFileType(isPDF ? 'pdf' : 'excel');
    await processFile(file);
  }, [isRTL, processFile]);

  const loadSampleData = useCallback(async () => {
    const sampleData = [
      { month: 'Jan', revenue: 150000, expenses: 120000, assets: 500000, liabilities: 200000, cash: 180000, inventory: 80000, equity: 300000, cogs: 90000, operatingExpenses: 25000, depreciation: 5000 },
      { month: 'Feb', revenue: 165000, expenses: 125000, assets: 520000, liabilities: 190000, cash: 200000, inventory: 85000, equity: 330000, cogs: 99000, operatingExpenses: 22000, depreciation: 5000 },
      { month: 'Mar', revenue: 180000, expenses: 130000, assets: 550000, liabilities: 180000, cash: 220000, inventory: 90000, equity: 370000, cogs: 108000, operatingExpenses: 17000, depreciation: 5000 },
      { month: 'Apr', revenue: 175000, expenses: 135000, assets: 540000, liabilities: 175000, cash: 210000, inventory: 88000, equity: 365000, cogs: 105000, operatingExpenses: 25000, depreciation: 5000 },
      { month: 'May', revenue: 190000, expenses: 140000, assets: 580000, liabilities: 170000, cash: 240000, inventory: 95000, equity: 410000, cogs: 114000, operatingExpenses: 21000, depreciation: 5000 },
      { month: 'Jun', revenue: 210000, expenses: 145000, assets: 620000, liabilities: 160000, cash: 280000, inventory: 100000, equity: 460000, cogs: 126000, operatingExpenses: 14000, depreciation: 5000 },
      { month: 'Jul', revenue: 200000, expenses: 150000, assets: 600000, liabilities: 155000, cash: 260000, inventory: 98000, equity: 445000, cogs: 120000, operatingExpenses: 25000, depreciation: 5000 },
      { month: 'Aug', revenue: 220000, expenses: 155000, assets: 650000, liabilities: 150000, cash: 300000, inventory: 105000, equity: 500000, cogs: 132000, operatingExpenses: 18000, depreciation: 5000 },
      { month: 'Sep', revenue: 215000, expenses: 152000, assets: 640000, liabilities: 145000, cash: 290000, inventory: 102000, equity: 495000, cogs: 129000, operatingExpenses: 18000, depreciation: 5000 },
      { month: 'Oct', revenue: 230000, expenses: 158000, assets: 680000, liabilities: 140000, cash: 320000, inventory: 110000, equity: 540000, cogs: 138000, operatingExpenses: 15000, depreciation: 5000 },
      { month: 'Nov', revenue: 240000, expenses: 160000, assets: 700000, liabilities: 135000, cash: 340000, inventory: 115000, equity: 565000, cogs: 144000, operatingExpenses: 11000, depreciation: 5000 },
      { month: 'Dec', revenue: 250000, expenses: 165000, assets: 720000, liabilities: 130000, cash: 360000, inventory: 120000, equity: 590000, cogs: 150000, operatingExpenses: 10000, depreciation: 5000 },
    ];

    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const file = new File([blob], 'sample_data.xlsx');
    setFileName('sample_data.xlsx');
    setCompanyName(companyName || (isRTL ? 'شركة النماذج للتجارة' : 'Sample Trading Co.'));
    await processFile(file);
  }, [companyName, isRTL, processFile]);

  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || !result) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: chatInput,
      time: new Date().toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages(prev => [...prev, userMsg]);
    const inputCopy = chatInput;
    setChatInput('');
    setIsChatLoading(true);

    try {
      const data = await chatMutation.mutateAsync({
        message: inputCopy,
        financials: result.financials as Record<string, unknown>,
        companyName: result.companyName,
        history: chatMessages.map(m => ({ role: m.role, content: m.content })),
        language: language as Language,
      });

      if (data.success) {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: data.reply,
          time: new Date().toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })
        }]);
      }
    } catch (err) {
      console.error(err);
    }
    setIsChatLoading(false);
  }, [chatInput, result, chatMessages, language, isRTL, chatMutation]);

  const exportPDF = useCallback(async () => {
    if (!dashboardRef.current) return;
    setExportLoading(true);
    try {
      const canvas = await html2canvas(dashboardRef.current, { scale: 1.5, useCORS: true, backgroundColor: '#050B14' });
      const imgData = canvas.toDataURL('image/jpeg', 0.85);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const W = 210;
      const H = (canvas.height * W) / canvas.width;
      const cname = result?.companyName || 'Company';
      const date = new Date().toLocaleDateString(isRTL ? 'ar-SA' : 'en-US');
      pdf.setFillColor(5, 11, 20);
      pdf.rect(0, 0, 210, 297, 'F');
      pdf.setTextColor(79, 106, 246);
      pdf.setFontSize(18);
      pdf.text('AI-CFO Pro - Financial Report', 105, 12, { align: 'center' });
      pdf.setTextColor(232, 237, 246);
      pdf.setFontSize(11);
      pdf.text(`${cname} | ${date}`, 105, 20, { align: 'center' });
      pdf.addImage(imgData, 'JPEG', 0, 25, W, Math.min(H, 260));
      pdf.save(`financial-report-${cname}-${date}.pdf`);
    } catch (e) { console.error(e); }
    setExportLoading(false);
  }, [result?.companyName, isRTL]);

  const newAnalysis = useCallback(() => {
    setResult(null);
    setFileName('');
    setChatMessages([]);
    setShowTable(false);
    setCompanyName('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const f = result?.financials;
  const score = f ? Math.min(Math.max(Math.round(f.score?.overall ?? 0), 0), 100) : 0;
  const scoreColors = getScoreColor(score);

  const scoreLabel = f?.score?.label
    ? (t.scoreLabelMap[f.score.label as keyof typeof t.scoreLabelMap] || f.score.label)
    : (score >= 80 ? t.scoreLabels[3] : score >= 60 ? t.scoreLabels[2] : score >= 40 ? t.scoreLabels[1] : t.scoreLabels[0]);

  const catScores = f ? [
    f.score.profitability,
    f.score.liquidity,
    f.score.solvency,
    f.score.efficiency,
  ] : [0, 0, 0, 0];

  const catColors = ['bg-emerald-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-amber-500'];

  const metrics = f ? [
    { icon: DollarSign, color: 'bg-primary-alpha text-[#4F6AF6]', label: t.metrics[0], value: formatCurrency(f.totalRevenue, t.currency), sub: `${f.revenueGrowth >= 0 ? '↑' : '↓'} ${formatNumber(Math.abs(f.revenueGrowth))}%`, subColor: f.revenueGrowth >= 0 ? 'text-emerald-400' : 'text-red-400' },
    { icon: Wallet, color: 'bg-danger-alpha text-red-400', label: t.metrics[1], value: formatCurrency(f.totalExpenses, t.currency), sub: `${f.expenseGrowth >= 0 ? '↑' : '↓'} ${formatNumber(Math.abs(f.expenseGrowth))}%`, subColor: f.expenseGrowth <= 0 ? 'text-emerald-400' : 'text-red-400' },
    { icon: Coins, color: (f.netProfit ?? 0) >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400', label: t.metrics[2], value: formatCurrency(f.netProfit, t.currency), sub: `${formatNumber(f.netMargin)}% ${isRTL ? 'هامش' : 'margin'}`, subColor: (f.netProfit ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400' },
    { icon: Percent, color: 'bg-warning-alpha text-amber-400', label: t.metrics[3], value: formatPercent(f.netMargin), sub: t.targets[0], subColor: 'text-[#5A6A82]' },
    { icon: Droplets, color: (f.liquidity?.currentRatio ?? 0) >= 1.5 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-warning-alpha text-amber-400', label: t.metrics[4], value: formatRatio(f.liquidity?.currentRatio), sub: t.targets[1], subColor: (f.liquidity?.currentRatio ?? 0) >= 1.5 ? 'text-emerald-400' : 'text-amber-400' },
    { icon: Shield, color: (f.solvency?.debtRatio ?? 1) < 0.5 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-danger-alpha text-red-400', label: t.metrics[5], value: formatPercent((f.solvency?.debtRatio ?? 0) * 100), sub: t.targets[2], subColor: (f.solvency?.debtRatio ?? 1) < 0.5 ? 'text-emerald-400' : 'text-red-400' },
    { icon: Flame, color: 'bg-secondary-alpha text-[#06B6D4]', label: t.metrics[6], value: formatCurrency(f.cashFlow?.burnRate, t.currency), sub: `${formatNumber(f.cashFlow?.monthsRunway)} ${t.months}`, subColor: (f.cashFlow?.monthsRunway ?? 0) > 6 ? 'text-emerald-400' : 'text-red-400' },
    { icon: TrendingUp, color: 'bg-primary-alpha text-[#4F6AF6]', label: t.metrics[7], value: formatPercent(f.profitability?.roa), sub: t.targets[3], subColor: 'text-[#5A6A82]' },
  ] : [];

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-deep)' }} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Ambient Orbs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="orb w-96 h-96 -top-24 -right-24" style={{ background: 'var(--accent-primary)', animation: 'float 20s infinite ease-in-out' }} />
        <div className="orb w-72 h-72 -bottom-12 -left-12" style={{ background: 'var(--accent-secondary)', animation: 'float 20s infinite ease-in-out', animationDelay: '-5s' }} />
        <div className="orb w-60 h-60 top-1/2 left-1/3" style={{ background: 'var(--accent-tertiary)', animation: 'float 20s infinite ease-in-out', animationDelay: '-10s' }} />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b backdrop-blur-xl" style={{ borderColor: 'var(--border-color)', background: 'rgba(5, 11, 20, 0.85)' }}>
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-16 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-lg font-extrabold gradient-text leading-none">{t.brand}</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t.tagline}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {result && (
              <>
                <button onClick={exportPDF} disabled={exportLoading} className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl gradient-primary text-white text-sm font-bold hover:shadow-lg transition-all disabled:opacity-60">
                  <FileDown className="w-4 h-4" />
                  {exportLoading ? '...' : t.exportPdf}
                </button>
                <button onClick={newAnalysis} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all border hover:border-[#4F6AF6]" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-color)' }}>
                  <RotateCcw className="w-4 h-4" /> {t.newAnalysis}
                </button>
              </>
            )}
            <button onClick={() => setShowSavedReports(!showSavedReports)} className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all border hover:border-[#4F6AF6]" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-color)' }}>
              <Layers className="w-4 h-4" />
            </button>
            <button onClick={() => setShowPricing(true)} className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-amber-400 border border-amber-500/30 hover:bg-amber-500/10 transition-all">
              {currentUser ? currentUser.plan.toUpperCase() : isRTL ? 'الأسعار' : 'Pricing'}
            </button>
            {currentUser ? (
              <button onClick={() => { if (confirm('تسجيل الخروج؟')) { signOut(); setCurrentUser(null); }}}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm border border-gray-600 text-gray-300 hover:border-red-500/50 hover:text-red-400 transition-all" style={{ background: 'var(--bg-elevated)' }}>
                {currentUser.name.split(' ')[0]}
              </button>
            ) : (
              <button onClick={() => { setAuthMode('login'); setShowAuth(true); }} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all">
                {isRTL ? 'دخول' : 'Sign in'}
              </button>
            )}
            <button onClick={toggleLanguage} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all border hover:border-[#4F6AF6]" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-color)' }}>
              <Globe className="w-4 h-4" />
              <span>{isRTL ? 'EN' : 'ع'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ background: 'rgba(5, 11, 20, 0.97)' }}>
          <div className="w-16 h-16 border-4 rounded-full animate-spin-loader" style={{ borderColor: 'var(--border-color)', borderTopColor: 'var(--accent-primary)' }} />
          <div className="text-xl font-bold mt-6 mb-1">{t.analyzing}</div>
          <div className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>{t.analyzingSub}</div>
          <div className="w-72 space-y-3">
            {t.steps.map((step, i) => (
              <div key={i} className={`flex items-center gap-3 transition-all duration-300 ${i < loadingStep ? 'opacity-100' : 'opacity-30'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i < loadingStep ? 'bg-emerald-500 text-white' : 'border'}`}
                  style={i >= loadingStep ? { borderColor: 'var(--border-color)', color: 'var(--text-secondary)' } : {}}>
                  {i < loadingStep ? '✓' : i + 1}
                </div>
                <span className="text-sm">{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
        {/* Upload Section */}
        {!result && (
          <>
            {/* Hero */}
            <section className="text-center py-14 sm:py-20">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm mb-6" style={{ background: 'rgba(79, 106, 246, 0.1)', border: '1px solid rgba(79, 106, 246, 0.3)', color: 'var(--accent-primary)' }}>
                <Brain className="w-4 h-4" />
                <span>{t.aiPowered}</span>
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black mb-5 gradient-text leading-tight" style={{ letterSpacing: '-0.04em' }}>
                {t.heroTitle}
              </h1>
              <p className="text-lg max-w-2xl mx-auto mb-10" style={{ color: 'var(--text-secondary)' }}>
                {t.heroSub}
              </p>
              <div className="flex justify-center gap-10 flex-wrap">
                {[[t.s1, '30+'], [t.s2, 'AI'], [t.s3, '100%']].map(([label, val], i) => (
                  <div key={i} className="text-center">
                    <div className="text-3xl font-extrabold gradient-text">{val}</div>
                    <div className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{label}</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-center mt-6">
                <button
                  onClick={() => setShowValuation(!showValuation)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-sm font-semibold transition-all"
                >
                  🧮 {isRTL ? 'حاسبة تقييم الشركة — مجاناً' : 'Free Company Valuation Calculator'}
                </button>
              </div>
            </section>

            {/* Upload Card */}
            <section className="max-w-2xl mx-auto mb-16">
              <div className="rounded-3xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                <div className="h-1 gradient-primary" />
                <div className="p-6 sm:p-8">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Upload className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} /> {t.uploadTitle}
                  </h2>

                  {/* Company Name */}
                  <div className="mb-5">
                    <div className="relative">
                      <Building2 className="absolute top-3 w-4 h-4" style={{ [isRTL ? 'right' : 'left']: '0.75rem', color: 'var(--text-secondary)' }} />
                      <input
                        type="text"
                        value={companyName}
                        onChange={e => setCompanyName(e.target.value)}
                        placeholder={t.companyPlaceholder}
                        className="w-full rounded-xl py-3 text-sm placeholder:text-[var(--text-muted)] focus:border-[#4F6AF6] focus:outline-none transition-all"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', paddingInline: '2.5rem 1rem' }}
                      />
                    </div>
                  </div>

                  {/* File Type Toggle */}
                  <div className="mb-5">
                    <div className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>{t.fileTypeLabel}</div>
                    <div className="flex gap-2">
                      {[{ id: 'excel' as const, label: t.excel, icon: FileSpreadsheet }, { id: 'pdf' as const, label: t.pdf, icon: FileText }].map(({ id, label, icon: Icon }) => (
                        <button
                          key={id}
                          onClick={() => setFileType(id)}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all"
                          style={fileType === id
                            ? { borderColor: 'var(--accent-primary)', background: 'rgba(79, 106, 246, 0.1)', color: 'var(--accent-primary)' }
                            : { borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }
                          }
                        >
                          <Icon className="w-4 h-4" /> {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Drop Zone */}
                  <div
                    className={`upload-area rounded-2xl p-10 text-center mb-4 ${isDragOver ? 'dragover' : ''}`}
                    onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={e => { e.preventDefault(); setIsDragOver(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
                    onClick={() => document.getElementById('fileInput')?.click()}
                  >
                    {fileType === 'excel'
                      ? <FileSpreadsheet className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--accent-primary)' }} />
                      : <FileText className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--accent-secondary)' }} />
                    }
                    <p className="font-semibold mb-1">{t.dragText}</p>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{fileType === 'excel' ? t.supportExcel : t.supportPDF}</p>
                    {fileName && (
                      <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-success)' }}>
                        <CheckCircle className="w-4 h-4" /> {fileName}
                      </div>
                    )}
                  </div>
                  <input type="file" id="fileInput" accept={fileType === 'excel' ? '.xlsx,.xls' : '.pdf'} className="hidden"
                    onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

                  <div className="flex gap-3">
                    <button onClick={() => document.getElementById('fileInput')?.click()}
                      className="flex-1 gradient-primary text-white py-3 rounded-xl font-bold hover:shadow-lg transition-all hover:-translate-y-0.5">
                      {t.chooseBtn}
                    </button>
                    <button onClick={loadSampleData}
                      className="flex items-center gap-2 px-5 py-3 rounded-xl border-2 border-dashed text-sm transition-all hover:border-[#4F6AF6]"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                      <Play className="w-4 h-4" /> {t.sampleBtn}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {/* Dashboard */}
        {result && f && (
          <div ref={dashboardRef} className="animate-fadeInUp">
            {/* Dashboard Header */}
            <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-extrabold">{t.dashboard}</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {result.companyName} · {new Date().toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}
                  {result.isPDF && <span className="px-2 py-0.5 rounded-full text-xs mr-2" style={{ background: 'rgba(6, 182, 212, 0.2)', color: 'var(--accent-secondary)' }}>PDF</span>}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap sm:hidden">
                <button onClick={exportPDF} disabled={exportLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-primary text-white text-sm font-bold hover:shadow-lg transition-all disabled:opacity-60">
                  <FileDown className="w-4 h-4" />
                  {exportLoading ? '...' : t.exportPdf}
                </button>
              </div>
            </div>

            {/* Score Card */}
            <div className="rounded-2xl p-6 mb-6 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <div className="flex flex-wrap justify-between items-center gap-4 mb-5">
                <h3 className="font-bold text-lg">{t.scoreTitle}</h3>
                <span className={`px-4 py-1.5 rounded-full text-sm font-bold border ${scoreColors.text} ${scoreColors.border} ${scoreColors.bg}`}>
                  {scoreLabel}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-8">
                <ScoreRing score={score} size={144} />
                <div className="flex-1 min-w-52 space-y-3">
                  {t.cats.map((cat, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: 'var(--text-secondary)' }}>{cat}</span>
                        <span className="font-bold">{Math.round(catScores[i])}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                        <div className={`h-full rounded-full bar-fill ${catColors[i]}`} style={{ width: `${Math.min(catScores[i], 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Smart Alerts */}
            {f.smartAlerts && f.smartAlerts.length > 0 && (
              <div className="rounded-2xl p-6 mb-6 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                <SmartAlerts alerts={f.smartAlerts} />
              </div>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {metrics.map((m, i) => (
                <div key={i} className="metric-card">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${m.color}`}>
                    <m.icon className="w-5 h-5" />
                  </div>
                  <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{m.label}</div>
                  <div className="text-xl font-extrabold mb-1" style={{ letterSpacing: '-0.02em' }}>{m.value}</div>
                  <div className={`text-xs ${m.subColor}`}>{m.sub}</div>
                </div>
              ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              {/* Donut */}
              <div className="rounded-2xl p-5 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                  <PieChart className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} /> {t.charts[0]}
                </h3>
                <div className="h-56">
                  <Doughnut
                    data={{
                      labels: t.chartLabels[0],
                      datasets: [{ data: [f.totalRevenue || 0, f.totalExpenses || 0, Math.max(f.netProfit || 0, 0)], backgroundColor: [C.primary, C.danger, C.success], borderWidth: 0, hoverOffset: 6 }]
                    }}
                    options={{ responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: '#8896AB', font: { size: 11 }, boxWidth: 12, padding: 16 } } } }}
                  />
                </div>
              </div>

              {/* Bar */}
              <div className="rounded-2xl p-5 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} /> {t.charts[1]}
                </h3>
                <div className="h-56">
                  <Bar
                    data={{
                      labels: t.chartLabels[1],
                      datasets: [{ data: [f.netMargin || 0, f.profitability?.roa || 0, f.profitability?.roe || 0, f.revenueGrowth || 0], backgroundColor: [C.primary, C.secondary, C.success, C.warning], borderRadius: 6 }]
                    }}
                    options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8896AB', font: { size: 10 } } }, x: { grid: { display: false }, ticks: { color: '#8896AB', font: { size: 10 } } } } }}
                  />
                </div>
              </div>

              {/* Line */}
              <div className="rounded-2xl p-5 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} /> {t.charts[2]}
                </h3>
                <div className="h-56">
                  <Line
                    data={{
                      labels: f.months || [],
                      datasets: [
                        { label: t.chartLabels[2][0], data: f.monthlyRevenue || [], borderColor: C.primary, backgroundColor: C.primary + '15', fill: true, tension: 0.4, pointRadius: 3 },
                        { label: t.chartLabels[2][1], data: f.monthlyExpenses || [], borderColor: C.danger, backgroundColor: C.danger + '15', fill: true, tension: 0.4, pointRadius: 3 },
                        { label: t.chartLabels[2][2], data: f.monthlyCash || [], borderColor: C.success, backgroundColor: C.success + '15', fill: true, tension: 0.4, pointRadius: 3 }
                      ]
                    }}
                    options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#8896AB', font: { size: 10 }, boxWidth: 10, padding: 12 } } }, scales: { y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8896AB', font: { size: 9 } } }, x: { grid: { display: false }, ticks: { color: '#8896AB', font: { size: 9 }, maxRotation: 45 } } } }}
                  />
                </div>
              </div>
            </div>

            {/* P2-11: Dashboard panels extracted to ReportViewer component */}
            <ReportViewer result={result} t={t} isRTL={isRTL} />

            {/* P2-11: Insights extracted to InsightsPanel component */}
            {result.insights?.length > 0 && (
              <InsightsPanel insights={result.insights} title={t.insights} />
            )}

            {/* P2-11: Chat extracted to ChatWidget component */}
            <div className="rounded-2xl p-6 mb-6 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245, 158, 11, 0.15)' }}>
                  <MessageCircle className="w-5 h-5 text-amber-400" />
                </div>
                <h2 className="font-bold text-lg">{t.advisor}</h2>
              </div>
              <ChatWidget
                messages={chatMessages}
                input={chatInput}
                isLoading={isChatLoading}
                isRTL={isRTL}
                disabled={!result}
                onInputChange={setChatInput}
                onSend={sendChat}
              />
            </div>

                        {/* Data Table */}
            {result.rawData?.length > 0 && (
              <div className="rounded-2xl p-6 mb-6 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                <button onClick={() => setShowTable(!showTable)} className="flex items-center gap-2 text-sm font-bold transition-colors hover:text-[#4F6AF6] w-full"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  <FileSpreadsheet className="w-4 h-4" />
                  {t.dataTable}
                  <span className={isRTL ? 'mr-auto' : 'ml-auto'}>{showTable ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
                </button>
                {showTable && (
                  <div className="overflow-x-auto mt-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                          {Object.keys(result.rawData[0]).map((h, i) => (
                            <th key={i} className="py-2 px-3 font-medium whitespace-nowrap" style={{ color: 'var(--text-secondary)', textAlign: isRTL ? 'right' : 'left' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.rawData.map((row, i) => (
                          <tr key={i} className="transition-colors hover:bg-[rgba(79,106,246,0.05)]" style={{ borderBottom: '1px solid rgba(30, 45, 69, 0.5)' }}>
                            {Object.values(row).map((v, j) => (
                              <td key={j} className="py-2 px-3 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{typeof v === 'number' ? v.toLocaleString() : String(v)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Valuation Calculator */}
      {showValuation && (
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pb-8">
          <ValuationCalculator />
        </div>
      )}

      {/* Saved Reports Sidebar */}
      {showSavedReports && (
        <div className="fixed inset-y-0 right-0 z-40 w-80 border-l shadow-2xl overflow-y-auto" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          <div className="p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-white">التقارير المحفوظة</h3>
              <button onClick={() => setShowSavedReports(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <SavedReports onLoad={(report) => {
              setResult(report.data as unknown as typeof result);
              setShowSavedReports(false);
            }} />
          </div>
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        onSuccess={(user) => setCurrentUser(user)}
        defaultMode={authMode}
      />

      {/* Pricing Modal */}
      <PricingModal
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
        onUpgrade={(user) => setCurrentUser(user)}
        currentPlan={currentUser?.plan || 'free'}
      />

      {/* Footer */}
      <footer className="text-center py-8 border-t" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-lg gradient-primary flex items-center justify-center">
            <TrendingUp className="w-3 h-3 text-white" />
          </div>
          <span className="font-bold gradient-text">{t.brand}</span>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t.footer}</p>
      </footer>
    </div>
  );
}
