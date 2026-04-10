import type {
  EntityOptions,
  TraceDatePreset,
  SpanTab,
  PropertyFilterOption,
  PropertyFilterToken,
} from '@mastra/playground-ui';
import {
  EntityListPageLayout,
  MainHeader,
  TracesToolbar,
  ButtonWithTooltip,
  parseError,
  ObservabilityTracesList,
  ROOT_ENTITY_TYPE_OPTIONS,
  useEntityNames,
  useTags,
  useEnvironments,
  useServiceNames,
  PermissionDenied,
  SessionExpired,
  is403ForbiddenError,
  is401UnauthorizedError,
  TRACE_STATUS_OPTIONS,
  useMastraPackages,
} from '@mastra/playground-ui';

import { BookIcon, EyeIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTraces } from '@/domains/observability/hooks/use-traces';
import {
  applyTracePropertyFilterTokens,
  buildTraceListFilters,
  createTracePropertyFilterFields,
  getPreservedTraceFilterParams,
  getTracePropertyFilterTokens,
  TRACE_PROPERTY_FILTER_FIELD_IDS,
  TRACE_PROPERTY_FILTER_PARAM_BY_FIELD,
  TRACE_ROOT_ENTITY_TYPE_PARAM,
  TRACE_STATUS_PARAM,
  TRACE_STATUS_VALUES,
} from '@/domains/observability/trace-filters';

const INITIAL_SUGGESTION_LIMIT = 5;
const FILTERED_SUGGESTION_LIMIT = 20;

export default function Traces() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDateFrom, setSelectedDateFrom] = useState<Date | undefined>(
    () => new Date(Date.now() - 24 * 60 * 60 * 1000),
  );
  const [selectedDateTo, setSelectedDateTo] = useState<Date | undefined>(undefined);
  const [groupByThread, setGroupByThread] = useState<boolean>(false);
  const [datePreset, setDatePreset] = useState<TraceDatePreset>('last-24h');
  const { data: availableTags = [] } = useTags();
  const { data: systemPackages, isLoading: isLoadingSystemPackages } = useMastraPackages();

  const selectedEntityOption = useMemo(
    () => ROOT_ENTITY_TYPE_OPTIONS.find(option => option.entityType === searchParams.get(TRACE_ROOT_ENTITY_TYPE_PARAM)),
    [searchParams],
  );
  const selectedStatus = useMemo(() => {
    const value = searchParams.get(TRACE_STATUS_PARAM);
    return value && TRACE_STATUS_VALUES.has(value as 'running' | 'success' | 'error') ? value : undefined;
  }, [searchParams]);
  const filterTokens = useMemo(() => getTracePropertyFilterTokens(searchParams), [searchParams]);
  const supportsRealtimeStatus = systemPackages?.observabilityRuntimeStrategy === 'realtime';
  const statusOptions = useMemo(
    () =>
      isLoadingSystemPackages || supportsRealtimeStatus
        ? TRACE_STATUS_OPTIONS
        : TRACE_STATUS_OPTIONS.filter(option => option.value !== 'running'),
    [isLoadingSystemPackages, supportsRealtimeStatus],
  );
  const effectiveSelectedStatus = useMemo(
    () =>
      !isLoadingSystemPackages && !supportsRealtimeStatus && selectedStatus === 'running' ? undefined : selectedStatus,
    [isLoadingSystemPackages, selectedStatus, supportsRealtimeStatus],
  );

  const { data: rootEntityNameSuggestions = [] } = useEntityNames({
    entityType: selectedEntityOption?.entityType,
    rootOnly: true,
  });
  const { data: discoveredEnvironments = [] } = useEnvironments();
  const { data: discoveredServiceNames = [] } = useServiceNames();

  const traceIdParam = searchParams.get('traceId') || undefined;
  const spanIdParam = searchParams.get('spanId') || undefined;
  const tabParam = searchParams.get('tab');
  const spanTabParam: SpanTab | undefined =
    tabParam === 'scoring' ? 'scoring' : tabParam === 'details' ? 'details' : undefined;
  const scoreIdParam = searchParams.get('scoreId') || undefined;

  const propertyFilterFields = useMemo(() => createTracePropertyFilterFields(availableTags), [availableTags]);

  const loadSuggestions = useCallback(
    async (fieldId: string, query: string): Promise<PropertyFilterOption[]> => {
      const q = query.trim().toLowerCase();

      const source =
        fieldId === 'entityName'
          ? rootEntityNameSuggestions
          : fieldId === 'serviceName'
            ? discoveredServiceNames
            : fieldId === 'environment'
              ? discoveredEnvironments
              : [];

      const values = q
        ? source.filter(value => value.toLowerCase().includes(q)).slice(0, FILTERED_SUGGESTION_LIMIT)
        : source.slice(0, INITIAL_SUGGESTION_LIMIT);

      return values.map(value => ({ label: value, value }));
    },
    [discoveredEnvironments, discoveredServiceNames, rootEntityNameSuggestions],
  );

  const traceFilters = useMemo(
    () =>
      buildTraceListFilters({
        rootEntityType: selectedEntityOption?.entityType,
        status: effectiveSelectedStatus,
        dateFrom: selectedDateFrom,
        dateTo: selectedDateTo,
        tokens: filterTokens,
      }),
    [effectiveSelectedStatus, filterTokens, selectedDateFrom, selectedDateTo, selectedEntityOption],
  );

  useEffect(() => {
    if (isLoadingSystemPackages || supportsRealtimeStatus || selectedStatus !== 'running') {
      return;
    }

    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        next.delete(TRACE_STATUS_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [isLoadingSystemPackages, selectedStatus, setSearchParams, supportsRealtimeStatus]);

  const {
    data: tracesData,
    isLoading: isTracesLoading,
    isFetchingNextPage,
    hasNextPage,
    setEndOfListElement,
    error: TracesError,
    isError: isTracesError,
  } = useTraces({
    filters: traceFilters,
  });

  const traces = useMemo(() => tracesData?.spans ?? [], [tracesData?.spans]);
  const threadTitles = tracesData?.threadTitles ?? {};
  const entityOptions: EntityOptions[] = useMemo(() => [...ROOT_ENTITY_TYPE_OPTIONS], []);

  const handleTraceClick = useCallback(
    (traceId: string) => {
      const params = getPreservedTraceFilterParams(searchParams);
      if (traceId) {
        params.set('traceId', traceId);
      } else {
        params.delete('traceId');
      }
      params.delete('spanId');
      params.delete('tab');
      params.delete('scoreId');
      setSearchParams(params);
    },
    [searchParams, setSearchParams],
  );

  const buildParams = useCallback(() => {
    const params = getPreservedTraceFilterParams(searchParams);
    const traceId = searchParams.get('traceId');
    if (traceId) params.set('traceId', traceId);
    const spanId = searchParams.get('spanId');
    if (spanId) params.set('spanId', spanId);
    const tab = searchParams.get('tab');
    if (tab) params.set('tab', tab);
    const scoreId = searchParams.get('scoreId');
    if (scoreId) params.set('scoreId', scoreId);
    return params;
  }, [searchParams]);

  const handleSpanChange = useCallback(
    (spanId: string | null) => {
      const currentSpanId = searchParams.get('spanId') || null;
      if (spanId === currentSpanId) return;

      const params = buildParams();
      if (spanId) {
        params.set('spanId', spanId);
      } else {
        params.delete('spanId');
      }
      setSearchParams(params, { replace: true });
    },
    [buildParams, searchParams, setSearchParams],
  );

  const handleSpanTabChange = useCallback(
    (tab: SpanTab) => {
      const currentTab = searchParams.get('tab') || null;
      if (tab === currentTab) return;

      const params = buildParams();
      if (tab && tab !== 'details') {
        params.set('tab', tab);
      } else {
        params.delete('tab');
      }
      params.delete('scoreId');
      setSearchParams(params, { replace: true });
    },
    [buildParams, searchParams, setSearchParams],
  );

  const handleScoreChange = useCallback(
    (scoreId: string | null) => {
      const currentScoreId = searchParams.get('scoreId') || null;
      if (scoreId === currentScoreId) return;

      const params = buildParams();
      if (scoreId) {
        params.set('scoreId', scoreId);
      } else {
        params.delete('scoreId');
      }
      setSearchParams(params, { replace: true });
    },
    [buildParams, searchParams, setSearchParams],
  );

  const handleSelectedEntityChange = useCallback(
    (option: EntityOptions | undefined) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (option) {
            next.set(TRACE_ROOT_ENTITY_TYPE_PARAM, option.entityType);
          } else {
            next.delete(TRACE_ROOT_ENTITY_TYPE_PARAM);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleStatusChange = useCallback(
    (status?: 'running' | 'success' | 'error') => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (status) {
            next.set(TRACE_STATUS_PARAM, status);
          } else {
            next.delete(TRACE_STATUS_PARAM);
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
          applyTracePropertyFilterTokens(next, nextTokens);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleReset = useCallback(() => {
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        next.delete(TRACE_ROOT_ENTITY_TYPE_PARAM);
        next.delete(TRACE_STATUS_PARAM);
        for (const fieldId of TRACE_PROPERTY_FILTER_FIELD_IDS) {
          next.delete(TRACE_PROPERTY_FILTER_PARAM_BY_FIELD[fieldId]);
        }
        return next;
      },
      { replace: true },
    );
    setSelectedDateFrom(new Date(Date.now() - 24 * 60 * 60 * 1000));
    setSelectedDateTo(undefined);
    setDatePreset('last-24h');
    setGroupByThread(false);
  }, [setSearchParams]);

  const handleDataChange = useCallback((value: Date | undefined, type: 'from' | 'to') => {
    if (type === 'from') {
      setSelectedDateFrom(value);
      return;
    }
    setSelectedDateTo(value);
  }, []);

  const error = isTracesError ? parseError(TracesError) : undefined;

  if (TracesError && is401UnauthorizedError(TracesError)) {
    return (
      <EntityListPageLayout>
        <EntityListPageLayout.Top>
          <MainHeader withMargins={false}>
            <MainHeader.Column>
              <MainHeader.Title>
                <EyeIcon /> Traces
              </MainHeader.Title>
            </MainHeader.Column>
          </MainHeader>
        </EntityListPageLayout.Top>
        <div className="flex h-full items-center justify-center">
          <SessionExpired />
        </div>
      </EntityListPageLayout>
    );
  }

  if (TracesError && is403ForbiddenError(TracesError)) {
    return (
      <EntityListPageLayout>
        <EntityListPageLayout.Top>
          <MainHeader withMargins={false}>
            <MainHeader.Column>
              <MainHeader.Title>
                <EyeIcon /> Traces
              </MainHeader.Title>
            </MainHeader.Column>
          </MainHeader>
        </EntityListPageLayout.Top>
        <div className="flex h-full items-center justify-center">
          <PermissionDenied resource="traces" />
        </div>
      </EntityListPageLayout>
    );
  }

  const filtersApplied =
    !!selectedEntityOption ||
    !!selectedStatus ||
    filterTokens.length > 0 ||
    datePreset !== 'last-24h' ||
    !!selectedDateTo;

  return (
    <EntityListPageLayout className="max-w-none">
      <EntityListPageLayout.Top>
        <MainHeader withMargins={false}>
          <MainHeader.Column>
            <MainHeader.Title isLoading={isTracesLoading}>
              <EyeIcon /> Traces
            </MainHeader.Title>
          </MainHeader.Column>
          <MainHeader.Column className="flex justify-end gap-2">
            <ButtonWithTooltip
              as="a"
              href="https://mastra.ai/en/docs/observability/tracing/overview"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Traces documentation"
              tooltipContent="Go to Traces documentation"
            >
              <BookIcon />
            </ButtonWithTooltip>
          </MainHeader.Column>
        </MainHeader>

        <TracesToolbar
          onEntityChange={handleSelectedEntityChange}
          onReset={handleReset}
          selectedEntity={selectedEntityOption}
          entityOptions={entityOptions}
          selectedStatus={effectiveSelectedStatus}
          statusOptions={statusOptions}
          onStatusChange={handleStatusChange}
          onDateChange={handleDataChange}
          selectedDateFrom={selectedDateFrom}
          selectedDateTo={selectedDateTo}
          isLoading={isTracesLoading}
          groupByThread={groupByThread}
          onGroupByThreadChange={setGroupByThread}
          datePreset={datePreset}
          onDatePresetChange={setDatePreset}
          filterFields={propertyFilterFields}
          filterTokens={filterTokens}
          onFilterTokensChange={handleFilterTokensChange}
          loadSuggestions={loadSuggestions}
        />
      </EntityListPageLayout.Top>

      <ObservabilityTracesList
        traces={traces}
        isLoading={isTracesLoading}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        setEndOfListElement={setEndOfListElement}
        error={error?.error}
        filtersApplied={Boolean(filtersApplied)}
        selectedTraceId={traceIdParam}
        initialSpanId={spanIdParam}
        initialSpanTab={spanTabParam}
        initialScoreId={scoreIdParam}
        onTraceClick={handleTraceClick}
        onSpanChange={handleSpanChange}
        onSpanTabChange={handleSpanTabChange}
        onScoreChange={handleScoreChange}
        groupByThread={groupByThread}
        threadTitles={threadTitles}
      />
    </EntityListPageLayout>
  );
}
