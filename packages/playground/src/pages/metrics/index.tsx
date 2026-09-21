import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { MetricsFlexGrid } from '@mastra/playground-ui/components/MetricsFlexGrid';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { NoDataPageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import type { PropertyFilterToken } from '@mastra/playground-ui/components/PropertyFilter';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { useAgentRunsKpiMetrics } from '@mastra/playground-ui/domains/metrics/hooks/use-agent-runs-kpi-metrics';
import { MetricsProvider, isValidPreset } from '@mastra/playground-ui/domains/metrics/hooks/use-metrics';
import type { DatePreset, DateRange } from '@mastra/playground-ui/domains/metrics/hooks/use-metrics';
import {
  applyMetricsPropertyFilterTokens,
  createMetricsPropertyFilterFields,
  getMetricsPropertyFilterTokens,
  hasAnyMetricsFilterParams,
  loadMetricsFiltersFromStorage,
} from '@mastra/playground-ui/domains/metrics/metrics-filters';
import { useEntityNames } from '@mastra/playground-ui/domains/traces/hooks/use-entity-names';
import { useEnvironments } from '@mastra/playground-ui/domains/traces/hooks/use-environments';
import { useServiceNames } from '@mastra/playground-ui/domains/traces/hooks/use-service-names';
import { useTags } from '@mastra/playground-ui/domains/traces/hooks/use-tags';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { pageHeaderProps } from '@/components/ui/page-header-props';
import { useObservabilityStorageCapabilities } from '@/domains/configuration/hooks/use-observability-storage-capabilities';
import { LatencyCard } from '@/domains/metrics/components/latency-card';
import { MemoryCard } from '@/domains/metrics/components/memory-card';
import {
  ActiveResourcesKpiCard,
  ActiveThreadsKpiCard,
  AgentRunsKpiCard,
  ModelCostKpiCard,
  TotalTokensKpiCard,
} from '@/domains/metrics/components/metrics-kpi-cards';
import { MetricsPageLayout } from '@/domains/metrics/components/metrics-page-layout';
import { MetricsStorageGate } from '@/domains/metrics/components/metrics-storage-gate';
import { ModelUsageCostCard } from '@/domains/metrics/components/model-usage-cost-card';
import { TokenUsageByAgentCard } from '@/domains/metrics/components/token-usage-by-agent-card';
import { TokenUsageTimelineCard } from '@/domains/metrics/components/token-usage-timeline-card';
import { TracesVolumeCard } from '@/domains/metrics/components/traces-volume-card';
import { metricsCrumbs } from '@/domains/metrics/metrics-crumbs';

const PERIOD_PARAM = 'period';
const DATE_FROM_PARAM = 'dateFrom';
const DATE_TO_PARAM = 'dateTo';

/** Keeps date and filter state in the URL and gates dashboard access on storage capabilities. */
export default function Metrics() {
  const [searchParams, setSearchParams] = useSearchParams();

  const urlPreset = searchParams.get(PERIOD_PARAM);
  const preset: DatePreset = isValidPreset(urlPreset) ? urlPreset : '24h';

  // Concrete from/to bounds only apply to the 'custom' preset; relative presets
  // derive their window from the preset alone.
  const customRange = useMemo<DateRange | undefined>(() => {
    if (preset !== 'custom') return undefined;
    const parseBound = (raw: string | null) => {
      if (!raw) return undefined;
      const date = new Date(raw);
      return Number.isNaN(date.getTime()) ? undefined : date;
    };
    const from = parseBound(searchParams.get(DATE_FROM_PARAM));
    const to = parseBound(searchParams.get(DATE_TO_PARAM));
    if (!from && !to) return undefined;
    return { from, to };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, searchParams.toString()]);

  // Derive tokens straight from the URL. Memoized on a stable digest so the
  // array identity only changes when the URL actually changes — this prevents
  // a feedback loop where `searchParams` is mutated and immediately parsed
  // back into a new tokens reference.
  const filterTokens = useMemo(
    () => getMetricsPropertyFilterTokens(searchParams),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams.toString()],
  );

  const handlePresetChange = useCallback(
    (next: DatePreset) => {
      setSearchParams(
        prev => {
          const params = new URLSearchParams(prev);
          if (next === '24h') {
            params.delete(PERIOD_PARAM);
          } else {
            params.set(PERIOD_PARAM, next);
          }
          if (next !== 'custom') {
            params.delete(DATE_FROM_PARAM);
            params.delete(DATE_TO_PARAM);
          }
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleCustomRangeChange = useCallback(
    (range: DateRange | undefined) => {
      setSearchParams(
        prev => {
          const params = new URLSearchParams(prev);
          if (range?.from) {
            params.set(DATE_FROM_PARAM, range.from.toISOString());
          } else {
            params.delete(DATE_FROM_PARAM);
          }
          if (range?.to) {
            params.set(DATE_TO_PARAM, range.to.toISOString());
          } else {
            params.delete(DATE_TO_PARAM);
          }
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleFilterTokensChange = useCallback(
    (nextTokens: PropertyFilterToken[]) => {
      setSearchParams(
        prev => {
          const params = new URLSearchParams(prev);
          applyMetricsPropertyFilterTokens(params, nextTokens);
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // Hydrate saved filters on first mount if URL is filter-clean.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    if (hasAnyMetricsFilterParams(searchParams)) return;
    const saved = loadMetricsFiltersFromStorage();
    if (!saved) return;
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of saved) {
          next.append(key, value);
        }
        return next;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <MetricsProvider
      preset={preset}
      filterTokens={filterTokens}
      onPresetChange={handlePresetChange}
      onFilterTokensChange={handleFilterTokensChange}
      customRange={customRange}
      onCustomRangeChange={handleCustomRangeChange}
    >
      <MetricsStorageGate>
        <MetricsContent />
      </MetricsStorageGate>
    </MetricsProvider>
  );
}

/** Fetches and renders dashboard data only after the storage gate confirms metrics support. */
function MetricsContent() {
  const { error, isLoading: isMetricsLoading } = useAgentRunsKpiMetrics();

  const { isInMemory } = useObservabilityStorageCapabilities();

  const { data: tagsData, isLoading: isTagsLoading } = useTags();
  const { data: entityNamesData, isLoading: isEntityNamesLoading } = useEntityNames();
  const { data: serviceNamesData, isLoading: isServiceNamesLoading } = useServiceNames();
  const { data: environmentsData, isLoading: isEnvironmentsLoading } = useEnvironments();

  const filterFields = useMemo(
    () =>
      createMetricsPropertyFilterFields({
        availableTags: tagsData ?? [],
        availableEntityNames: entityNamesData ?? [],
        availableServiceNames: serviceNamesData ?? [],
        availableEnvironments: environmentsData ?? [],
        loading: {
          tags: isTagsLoading,
          entityNames: isEntityNamesLoading,
          serviceNames: isServiceNamesLoading,
          environments: isEnvironmentsLoading,
        },
      }),
    [
      tagsData,
      entityNamesData,
      serviceNamesData,
      environmentsData,
      isTagsLoading,
      isEntityNamesLoading,
      isServiceNamesLoading,
      isEnvironmentsLoading,
    ],
  );

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout {...pageHeaderProps(metricsCrumbs)}>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout {...pageHeaderProps(metricsCrumbs)}>
        <PermissionDenied resource="metrics" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout {...pageHeaderProps(metricsCrumbs)}>
        <ErrorState title="Failed to load metrics" message={error.message} />
      </NoDataPageLayout>
    );
  }

  return (
    <MetricsPageLayout filterFields={filterFields} isLoading={isMetricsLoading}>
      <div className="grid content-start gap-4 pb-6">
        {isInMemory && (
          <Notice variant="info" title="Metrics are not persisted">
            <Notice.Message>
              This project uses in-memory storage for observability. Metrics will be lost on every server restart. For
              persistent metrics, switch the observability storage to ClickHouse, DuckDB, Postgres v-next, or Spanner.
            </Notice.Message>
          </Notice>
        )}

        <MetricsFlexGrid>
          <AgentRunsKpiCard />
          <ModelCostKpiCard />
          <TotalTokensKpiCard />
          <ActiveThreadsKpiCard />
          <ActiveResourcesKpiCard />
        </MetricsFlexGrid>

        <MetricsFlexGrid>
          <ModelUsageCostCard />
          <TokenUsageByAgentCard />
          <TokenUsageTimelineCard />
          <MemoryCard />
          <TracesVolumeCard />
          <LatencyCard />
        </MetricsFlexGrid>
      </div>
    </MetricsPageLayout>
  );
}
