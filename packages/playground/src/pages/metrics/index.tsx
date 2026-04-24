import type { PropertyFilterToken } from '@mastra/playground-ui';
import {
  ButtonWithTooltip,
  ErrorState,
  NoDataPageLayout,
  PageHeader,
  PageLayout,
  PermissionDenied,
  PropertyFilterCreator,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
  toast,
} from '@mastra/playground-ui';
import { BarChart3Icon, BookIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { MetricsProvider, useAgentRunsKpiMetrics, isValidPreset, useMetrics } from '@/domains/metrics/components';
import { DateRangeSelector } from '@/domains/metrics/components/date-range-selector';
import { MetricsDashboard } from '@/domains/metrics/components/metrics-dashboard';
import { MetricsToolbar } from '@/domains/metrics/components/metrics-toolbar';
import type { DatePreset } from '@/domains/metrics/hooks/use-metrics';
import {
  applyMetricsPropertyFilterTokens,
  clearSavedMetricsFilters,
  createMetricsPropertyFilterFields,
  getMetricsPropertyFilterTokens,
  hasAnyMetricsFilterParams,
  loadMetricsFiltersFromStorage,
  saveMetricsFiltersToStorage,
} from '@/domains/metrics/metrics-filters';
import { useEntityNames } from '@/domains/observability/hooks/use-entity-names';
import { useEnvironments } from '@/domains/observability/hooks/use-environments';
import { useServiceNames } from '@/domains/observability/hooks/use-service-names';
import { useTags } from '@/domains/observability/hooks/use-tags';

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
    (preset: DatePreset) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (preset === '24h') {
            next.delete(PERIOD_PARAM);
          } else {
            next.set(PERIOD_PARAM, preset);
          }
          return next;
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
          const next = new URLSearchParams(prev);
          applyMetricsPropertyFilterTokens(next, nextTokens);
          return next;
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { error, isLoading: isMetricsLoading } = useAgentRunsKpiMetrics();
  const { filterTokens, setFilterTokens } = useMetrics();
  const [autoFocusFilterFieldId, setAutoFocusFilterFieldId] = useState<string | undefined>();

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
      return token;
    });
    setFilterTokens(neutralTokens);
  }, [filterFields, filterTokens, setFilterTokens]);

  // Synthesize a `replace` for page-level params when toolbar actions fire.
  // Use setSearchParams to also ensure replace semantics instead of push.
  useEffect(() => {
    // no-op — provider already pushes via onFilterTokensChange. Reference
    // setSearchParams to satisfy the lint rule and keep intent explicit.
    void setSearchParams;
  }, [setSearchParams]);

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

      <MetricsDashboard />
    </PageLayout>
  );
}
