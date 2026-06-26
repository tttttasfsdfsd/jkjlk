/**
 * ReportViewer — P2-11 extraction from Home.tsx
 * Lazy-renders the full results dashboard with all financial panels.
 * Uses React.lazy for each heavy panel to avoid upfront bundle cost.
 */
import { lazy, Suspense } from 'react';
import type { AnalysisResult } from '@/types/financial';
import ExpandableSection from '@/components/dashboard/ExpandableSection';

// Lazy-load heavy dashboard panels — P3-17
const ProfitabilityPanel  = lazy(() => import('@/components/dashboard/ProfitabilityPanel'));
const LiquidityPanel      = lazy(() => import('@/components/dashboard/LiquidityPanel'));
const SolvencyPanel       = lazy(() => import('@/components/dashboard/SolvencyPanel'));
const EfficiencyPanel     = lazy(() => import('@/components/dashboard/EfficiencyPanel'));
const DuPontPanel         = lazy(() => import('@/components/dashboard/DuPontPanel'));
const EarningsQualityPanel = lazy(() => import('@/components/dashboard/EarningsQualityPanel'));
const CashFlowPanel       = lazy(() => import('@/components/dashboard/CashFlowPanel'));
const ForecastPanel       = lazy(() => import('@/components/dashboard/ForecastPanel'));
const ScenarioPanel       = lazy(() => import('@/components/dashboard/ScenarioPanel'));
const AltmanZPanel        = lazy(() => import('@/components/dashboard/AltmanZPanel'));
const BeneishMPanel       = lazy(() => import('@/components/dashboard/BeneishMPanel'));
const BenchmarkPanel      = lazy(() => import('@/components/dashboard/BenchmarkPanel'));

const PanelFallback = () => (
  <div className="h-24 rounded-2xl animate-pulse" style={{ background: 'var(--bg-elevated)' }} />
);

interface ReportViewerProps {
  result: AnalysisResult;
  t:      Record<string, string>;
  isRTL:  boolean;
}

export default function ReportViewer({ result, t, isRTL }: ReportViewerProps) {
  const f = result.financials;
  if (!f) return null;

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <Suspense fallback={<PanelFallback />}>
        <ExpandableSection title={t.profitabilityTitle} defaultExpanded>
          <ProfitabilityPanel profitability={f.profitability} t={t} isRTL={isRTL} />
        </ExpandableSection>
      </Suspense>

      <Suspense fallback={<PanelFallback />}>
        <ExpandableSection title={t.liquidityTitle} defaultExpanded>
          <LiquidityPanel liquidity={f.liquidity} t={t} isRTL={isRTL} />
        </ExpandableSection>
      </Suspense>

      <Suspense fallback={<PanelFallback />}>
        <ExpandableSection title={t.solvencyTitle} defaultExpanded>
          <SolvencyPanel solvency={f.solvency} t={t} isRTL={isRTL} />
        </ExpandableSection>
      </Suspense>

      <Suspense fallback={<PanelFallback />}>
        <ExpandableSection title={t.efficiencyTitle} defaultExpanded>
          <EfficiencyPanel efficiency={f.efficiency} t={t} isRTL={isRTL} />
        </ExpandableSection>
      </Suspense>

      <Suspense fallback={<PanelFallback />}>
        <ExpandableSection title={t.dupontTitle} defaultExpanded={false}>
          <DuPontPanel dupont={f.dupont} t={t} isRTL={isRTL} />
        </ExpandableSection>
      </Suspense>

      <Suspense fallback={<PanelFallback />}>
        <ExpandableSection title={t.earningsQualityTitle} defaultExpanded={false}>
          <EarningsQualityPanel earningsQuality={f.earningsQuality} t={t} isRTL={isRTL} />
        </ExpandableSection>
      </Suspense>

      <Suspense fallback={<PanelFallback />}>
        <ExpandableSection title={t.cashFlowTitle} defaultExpanded={false}>
          <CashFlowPanel cashFlow={f.cashFlow} t={t} isRTL={isRTL} />
        </ExpandableSection>
      </Suspense>

      <Suspense fallback={<PanelFallback />}>
        <ExpandableSection title={t.forecastTitle} defaultExpanded={false}>
          <ForecastPanel forecast={f.forecast} t={t} isRTL={isRTL} />
        </ExpandableSection>
      </Suspense>

      <Suspense fallback={<PanelFallback />}>
        <ExpandableSection title={t.scenarioTitle} defaultExpanded={false}>
          <ScenarioPanel scenarios={f.scenarios} t={t} isRTL={isRTL} />
        </ExpandableSection>
      </Suspense>

      <Suspense fallback={<PanelFallback />}>
        <ExpandableSection title={t.altmanZTitle} defaultExpanded={false}>
          <AltmanZPanel altmanZ={f.altmanZ} t={t} isRTL={isRTL} />
        </ExpandableSection>
      </Suspense>

      <Suspense fallback={<PanelFallback />}>
        <ExpandableSection title={t.beneishTitle} defaultExpanded={false}>
          <BeneishMPanel beneish={f.beneish} t={t} isRTL={isRTL} />
        </ExpandableSection>
      </Suspense>

      <Suspense fallback={<PanelFallback />}>
        <ExpandableSection title={t.benchmarkTitle} defaultExpanded={false}>
          <BenchmarkPanel benchmarks={f.benchmarks} t={t} isRTL={isRTL} />
        </ExpandableSection>
      </Suspense>
    </div>
  );
}
