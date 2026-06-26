/**
 * FileUploader — P2-11 extraction from Home.tsx
 * Handles drag-and-drop, file selection, company name input, and sample data.
 */
import { useRef, useCallback } from 'react';
import { Upload, FileSpreadsheet, FileText, Sparkles } from 'lucide-react';

interface FileUploaderProps {
  fileName: string;
  companyName: string;
  loading: boolean;
  loadingStep: number;
  isRTL: boolean;
  t: Record<string, string>;
  onFile: (file: File) => void;
  onCompanyNameChange: (name: string) => void;
  onLoadSample: () => void;
}

const LOADING_STEPS = [
  'جارٍ تحليل الملف...',
  'استخراج البيانات المالية...',
  'تشغيل محركات الذكاء الاصطناعي...',
  'إعداد التقرير...',
];

export default function FileUploader({
  fileName, companyName, loading, loadingStep,
  isRTL, t, onFile, onCompanyNameChange, onLoadSample,
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }, [onFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = '';
  }, [onFile]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center animate-pulse">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <p className="text-lg font-semibold text-white">
          {LOADING_STEPS[Math.min(loadingStep, LOADING_STEPS.length - 1)]}
        </p>
        <div className="w-64 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full gradient-primary transition-all duration-700"
            style={{ width: `${Math.min((loadingStep / 4) * 100, 95)}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Company name */}
      <input
        type="text"
        value={companyName}
        onChange={e => onCompanyNameChange(e.target.value)}
        placeholder={isRTL ? 'اسم الشركة (اختياري)' : 'Company name (optional)'}
        className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10
          text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500"
        dir={isRTL ? 'rtl' : 'ltr'}
      />

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="relative flex flex-col items-center justify-center gap-3 py-10 px-6
          rounded-2xl border-2 border-dashed border-white/15 hover:border-indigo-500/60
          cursor-pointer transition-all group"
        style={{ background: 'rgba(79,106,246,0.04)' }}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
        aria-label={isRTL ? 'رفع ملف' : 'Upload file'}
      >
        <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center
          group-hover:scale-110 transition-transform">
          <Upload className="w-7 h-7 text-white" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-white mb-1">
            {fileName || (isRTL ? 'اسحب وأفلت الملف هنا' : 'Drag & drop your file here')}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {isRTL ? 'أو انقر للاختيار • Excel / PDF' : 'or click to browse • Excel / PDF'}
          </p>
        </div>
        <div className="flex gap-2">
          <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-white/5 text-emerald-400">
            <FileSpreadsheet className="w-3 h-3" /> XLSX
          </span>
          <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-white/5 text-red-400">
            <FileText className="w-3 h-3" /> PDF
          </span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.xlsm,.pdf,.csv"
          className="hidden"
          onChange={handleChange}
        />
      </div>

      {/* Sample data button */}
      <button
        onClick={onLoadSample}
        className="text-xs py-2 px-4 rounded-lg border border-white/10 text-white/50
          hover:text-white hover:border-white/30 transition-all"
      >
        {isRTL ? '📊 تحميل بيانات تجريبية' : '📊 Load sample data'}
      </button>
    </div>
  );
}
