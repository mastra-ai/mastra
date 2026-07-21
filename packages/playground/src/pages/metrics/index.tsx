import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { MetricsFlexGrid } from '@mastra/playground-ui/components/MetricsFlexGrid';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { NoDataPageLayout, PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { PropertyFilterCreator } from '@mastra/playground-ui/components/PropertyFilter';
import type { PropertyFilterToken } from '@mastra/playground-ui/components/PropertyFilter';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { DateRangeSelector } from '@mastra/playground-ui/domains/metrics/components/date-range-selector';
import { useAgentRunsKpiMetrics } from '@mastra/playground-ui/domains/metrics/hooks/use-agent-runs-kpi-metrics';
import { MetricsProvider, isValidPreset, useMetrics } from '@mastra/playground-ui/domains/metrics/hooks/use-metrics';
import type { DatePreset, DateRange } from '@mastra/playground-ui/domains/metrics/hooks/use-metrics';
import {
  applyMetricsPropertyFilterTokens,
  clearSavedMetricsFilters,
  createMetricsPropertyFilterFields,
  getMetricsPropertyFilterTokens,
  hasAnyMetricsFilterParams,
  loadMetricsFiltersFromStorage,
  saveMetricsFiltersToStorage,
} from '@mastra/playground-ui/domains/metrics/metrics-filters';
import { useEntityNames } from '@mastra/playground-ui/domains/traces/hooks/use-entity-names';
import { useEnvironments } from '@mastra/playground-ui/domains/traces/hooks/use-environments';
import { useServiceNames } from '@mastra/playground-ui/domains/traces/hooks/use-service-names';
import { useTags } from '@mastra/playground-ui/domains/traces/hooks/use-tags';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { toast } from '@mastra/playground-ui/utils/toast';
import { CircleSlashIcon, ExternalLinkIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
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
import { MetricsToolbar } from '@/domains/metrics/components/metrics-toolbar';
import { ModelUsageCostCard } from '@/domains/metrics/components/model-usage-cost-card';
import { TokenUsageByAgentCard } from '@/domains/metrics/components/token-usage-by-agent-card';
import { TokenUsageTimelineCard } from '@/domains/metrics/components/token-usage-timeline-card';
import { TracesVolumeCard } from '@/domains/metrics/components/traces-volume-card';

const PERIOD_PARAM = 'period';
const DATE_FROM_PARAM = 'dateFrom';
const DATE_TO_PARAM = 'dateTo';

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
      <MetricsContent />
    </MetricsProvider>
  );
}

function MetricsContent() {
  const [searchParams] = useSearchParams();
  const { error, isLoading: isMetricsLoading } = useAgentRunsKpiMetrics();
  const { filterTokens, setFilterTokens } = useMetrics();
  const [autoFocusFilterFieldId, setAutoFocusFilterFieldId] = useState<string | undefined>();

  const { supportsMetrics, isInMemory, isLoading: isPackagesLoading } = useObservabilityStorageCapabilities();

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

  const [hasSavedFilters, setHasSavedFilters] = useState(() => loadMetricsFiltersFromStorage() !== null);

  const handleSave = useCallback(() => {
    saveMetricsFiltersToStorage(searchParams);
    setHasSavedFilters(true);
    toast.success('Filters setting for Metrics saved');
  }, [searchParams]);

  const handleRemoveSaved = useCallback(() => {
    clearSavedMetricsFilters();
    setHasSavedFilters(false);
    toast.success('Filters setting for Metrics cleared up');
  }, []);

  const handleRemoveAll = useCallback(() => {
    setFilterTokens([]);
  }, [setFilterTokens]);

  const handleClear = useCallback(() => {
    const neutralTokens: PropertyFilterToken[] = filterTokens.map(token => {
      const field = filterFields.find(f => f.id === token.fieldId);
      if (!field) return token;
      if (field.kind === 'text') return { fieldId: token.fieldId, value: '' };
      if (field.kind === 'pick-multi') {
        return field.multi ? { fieldId: token.fieldId, value: [] } : { fieldId: token.fieldId, value: 'Any' };
      }
      if (field.kind === 'multi-select') return { fieldId: token.fieldId, value: [] };
      return token;
    });
    setFilterTokens(neutralTokens);
  }, [filterFields, filterTokens, setFilterTokens]);

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout>
        <PermissionDenied resource="metrics" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout>
        <ErrorState title="Failed to load metrics" message={error.message} />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout width="wide" height="full">
      <PageLayout.TopArea>
        <PageLayout.Row>
          <PageLayout.Column className="flex flex-wrap items-start justify-start gap-2">
            <DateRangeSelector />
            <PropertyFilterCreator
              fields={filterFields}
              tokens={filterTokens}
              onTokensChange={setFilterTokens}
              disabled={isMetricsLoading}
              onStartTextFilter={setAutoFocusFilterFieldId}
            />
          </PageLayout.Column>
        </PageLayout.Row>

        <MetricsToolbar
          isLoading={isMetricsLoading}
          filterFields={filterFields}
          filterTokens={filterTokens}
          onFilterTokensChange={setFilterTokens}
          onClear={handleClear}
          onRemoveAll={handleRemoveAll}
          onSave={handleSave}
          onRemoveSaved={hasSavedFilters ? handleRemoveSaved : undefined}
          autoFocusFilterFieldId={autoFocusFilterFieldId}
        />
      </PageLayout.TopArea>

      {isPackagesLoading ? null : !supportsMetrics ? (
        <div className="flex h-full items-center justify-center">
          <EmptyState
            iconSlot={<CircleSlashIcon />}
            titleSlot="Metrics are not available with your current storage"
            descriptionSlot="Metrics require ClickHouse, DuckDB, Postgres v-next, Spanner, or in-memory storage for observability. Other relational databases (LibSQL, MSSQL) and document stores (MongoDB) do not support metrics collection. To enable metrics on an existing project, switch the observability storage in the Mastra configuration."
            actionSlot={
              <Button
                variant="ghost"
                as="a"
                href="https://mastra.ai/docs/observability/metrics/overview"
                target="_blank"
                rel="noopener noreferrer"
              >
                Metrics Documentation <ExternalLinkIcon />
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-8 content-start pb-10">
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
      )}
    </PageLayout>
  );
}
