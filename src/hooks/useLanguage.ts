import { useState, useCallback } from 'react';
import type { Language } from '@/types/financial';
import { getTranslation } from '@/lib/translations';

export function useLanguage() {
  const [language, setLanguage] = useState<Language>('ar');

  const toggleLanguage = useCallback(() => {
    setLanguage(prev => prev === 'ar' ? 'en' : 'ar');
  }, []);

  const t = getTranslation(language);
  const isRTL = language === 'ar';

  return { language, toggleLanguage, t, isRTL };
}
