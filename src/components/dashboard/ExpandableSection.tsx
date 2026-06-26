import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface ExpandableSectionProps {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  defaultExpanded?: boolean;
}

export default function ExpandableSection({ title, icon: Icon, children, defaultExpanded = false }: ExpandableSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
      <div className="section-header" onClick={() => setExpanded(!expanded)}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(79, 106, 246, 0.15)' }}>
          <Icon className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
        </div>
        <span className="font-bold flex-1">{title}</span>
        <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} style={{ color: 'var(--text-secondary)' }} />
      </div>
      <div className={`section-content ${expanded ? 'expanded' : ''}`}>
        {children}
      </div>
    </div>
  );
}
