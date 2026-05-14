import type { DatePreset, PropertyFilterToken } from '@mastra/playground-ui';
import {
  Notice,
  Button,
  ButtonWithTooltip,
  DateRangeSelector,
  EmptyState,
  ErrorState,
  MetricsFlexGrid,
  MetricsProvider,
  NoDataPageLayout,
  PageHeader,
  PageLayout,
  PermissionDenied,
  PropertyFilterCreator,
  SessionExpired,
  applyMetricsPropertyFilterTokens,
  clearSavedMetricsFilters,
  createMetricsPropertyFilterFields,
  getMetricsPropertyFilterTokens,
  hasAnyMetricsFilterParams,
  is401UnauthorizedError,
  is403ForbiddenError,
  isValidPreset,
  loadMetricsFiltersFromStorage,
  saveMetricsFiltersToStorage,
  toast,
  useAgentRunsKpiMetrics,
  useMetrics,
  useEntityNames,
  useEnvironments,
  useServiceNames,
  useTags,
} from '@mastra/playground-ui';
import { BarChart3Icon, BookIcon, CircleSlashIcon, ExternalLinkIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useMastraPackages } from '@/domains/configuration/hooks/use-mastra-packages';
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
import { TracesVolumeCard } from '@/domains/metrics/components/traces-volume-card';

const ANALYTICS_OBSERVABILITY_TYPES = new Set([
  'ObservabilityStorageClickhouseVNext',
  'ObservabilityStorageDuckDB',
  'ObservabilityInMemory',
]);

const PERIOD_PARAM = 'period';

export default function Metrics() {
  const [searchParams, setSearchParams] = useSearchParams();

  const urlPreset = searchParams.get(PERIOD_PARAM);
  const preset: DatePreset = isValidPreset(urlPreset) ? urlPreset : '24h';

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

  const { data: packagesData, isLoading: isPackagesLoading } = useMastraPackages();
  const observabilityType = packagesData?.observabilityStorageType;
  const supportsMetrics = observabilityType ? ANALYTICS_OBSERVABILITY_TYPES.has(observabilityType) : false;
  const isInMemory = observabilityType === 'ObservabilityInMemory';

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
      <NoDataPageLayout title="Metrics" icon={<BarChart3Icon />}>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout title="Metrics" icon={<BarChart3Icon />}>
        <PermissionDenied resource="metrics" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout title="Metrics" icon={<BarChart3Icon />}>
        <ErrorState title="Failed to load metrics" message={error.message} />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout width="wide" height="full">
      <PageLayout.TopArea>
        <PageLayout.Row>
          <PageLayout.Column>
            <PageHeader>
              <PageHeader.Title>
                <BarChart3Icon /> Metrics
              </PageHeader.Title>
            </PageHeader>
          </PageLayout.Column>
          <PageLayout.Column className="flex justify-end items-center gap-2">
            <DateRangeSelector />
            <PropertyFilterCreator
              fields={filterFields}
              tokens={filterTokens}
              onTokensChange={setFilterTokens}
              disabled={isMetricsLoading}
              onStartTextFilter={setAutoFocusFilterFieldId}
            />
            <ButtonWithTooltip
              as="a"
              href="https://mastra.ai/en/docs/observability/overview"
              target="_blank"
              rel="noopener noreferrer"
              tooltipContent="Go to Metrics documentation"
            >
              <BookIcon />
            </ButtonWithTooltip>
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
            descriptionSlot="Metrics require ClickHouse, DuckDB, or in-memory storage for observability. Relational databases (PostgreSQL, LibSQL) do not support metrics collection. To enable metrics on an existing project, switch the observability storage in the Mastra configuration."
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
                persistent metrics, switch the observability storage to ClickHouse or DuckDB.
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
            <MemoryCard />
            <TracesVolumeCard />
            <LatencyCard />
          </MetricsFlexGrid>
        </div>
      )}
    </PageLayout>
  );
}
