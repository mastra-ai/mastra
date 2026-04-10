import type { EntityOptions, PropertyFilterOption, PropertyFilterToken, TraceDatePreset } from '@mastra/playground-ui';
import {
  EntityListPageLayout,
  MainHeader,
  ButtonWithTooltip,
  TracesList,
  tracesListColumns,
  TraceDialog,
  TracesToolbar,
  parseError,
  EntryListSkeleton,
  groupTracesByThread,
  ROOT_ENTITY_TYPE_OPTIONS,
  useEntityNames,
  useScorers,
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
import { useTrace } from '@/domains/observability/hooks/use-trace';
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

const TRACE_ID_PARAM = 'traceId';
const SPAN_ID_PARAM = 'spanId';
const TAB_PARAM = 'tab';
const SCORE_ID_PARAM = 'scoreId';
const INITIAL_SUGGESTION_LIMIT = 5;
const FILTERED_SUGGESTION_LIMIT = 20;

function buildSelectionPath(params: URLSearchParams) {
  const query = params.toString();
  return query ? `/observability?${query}` : '/observability';
}

function setSelectionParam(params: URLSearchParams, key: string, value: string | null | undefined) {
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
}

export default function Observability() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDateFrom, setSelectedDateFrom] = useState<Date | undefined>(
    () => new Date(Date.now() - 24 * 60 * 60 * 1000),
  );
  const [selectedDateTo, setSelectedDateTo] = useState<Date | undefined>(undefined);
  const [groupByThread, setGroupByThread] = useState<boolean>(false);
  const [datePreset, setDatePreset] = useState<TraceDatePreset>('last-24h');
  const { data: systemPackages, isLoading: isLoadingSystemPackages } = useMastraPackages();

  const selectedTraceId = searchParams.get(TRACE_ID_PARAM) || undefined;
  const spanId = searchParams.get(SPAN_ID_PARAM) || undefined;
  const tab = searchParams.get(TAB_PARAM) || undefined;
  const scoreId = searchParams.get(SCORE_ID_PARAM) || undefined;

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

  const { data: scorers = {}, isLoading: isLoadingScorers } = useScorers();
  const { data: availableTags = [] } = useTags();
  const { data: rootEntityNameSuggestions = [] } = useEntityNames({
    entityType: selectedEntityOption?.entityType,
    rootOnly: true,
  });
  const { data: discoveredEnvironments = [] } = useEnvironments();
  const { data: discoveredServiceNames = [] } = useServiceNames();
  const { data: trace, isLoading: isLoadingTrace } = useTrace(selectedTraceId, { enabled: !!selectedTraceId });

  const propertyFilterFields = useMemo(() => createTracePropertyFilterFields(availableTags), [availableTags]);
  const entityOptions: EntityOptions[] = useMemo(() => [...ROOT_ENTITY_TYPE_OPTIONS], []);

  const loadSuggestions = useCallback(
    async (fieldId: string, query: string): Promise<PropertyFilterOption[]> => {
      const normalizedQuery = query.trim().toLowerCase();

      const source =
        fieldId === 'entityName'
          ? rootEntityNameSuggestions
          : fieldId === 'serviceName'
            ? discoveredServiceNames
            : fieldId === 'environment'
              ? discoveredEnvironments
              : [];

      const values = normalizedQuery
        ? source.filter(value => value.toLowerCase().includes(normalizedQuery)).slice(0, FILTERED_SUGGESTION_LIMIT)
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
    error: tracesError,
    isError: isTracesError,
  } = useTraces({
    filters: traceFilters,
  });

  const traces = useMemo(() => tracesData?.spans ?? [], [tracesData?.spans]);
  const threadTitles = tracesData?.threadTitles ?? {};

  const orderedTraceEntries = useMemo(() => {
    if (!groupByThread) {
      return traces.map(item => ({ id: item.traceId }));
    }

    const { groups, ungrouped } = groupTracesByThread(traces);
    return [
      ...groups.flatMap(group => group.traces.map(trace => ({ id: trace.traceId }))),
      ...ungrouped.map(trace => ({ id: trace.traceId })),
    ];
  }, [groupByThread, traces]);

  const selectedTraceIndex = useMemo(
    () => orderedTraceEntries.findIndex(entry => entry.id === selectedTraceId),
    [orderedTraceEntries, selectedTraceId],
  );

  const buildTraceSelectionParams = useCallback(
    (overrides?: { traceId?: string | null; spanId?: string | null; tab?: string | null; scoreId?: string | null }) => {
      const params = getPreservedTraceFilterParams(searchParams);

      setSelectionParam(params, TRACE_ID_PARAM, overrides?.traceId === undefined ? selectedTraceId : overrides.traceId);
      setSelectionParam(params, SPAN_ID_PARAM, overrides?.spanId === undefined ? spanId : overrides.spanId);
      setSelectionParam(params, TAB_PARAM, overrides?.tab === undefined ? tab : overrides.tab);
      setSelectionParam(params, SCORE_ID_PARAM, overrides?.scoreId === undefined ? scoreId : overrides.scoreId);

      return params;
    },
    [scoreId, searchParams, selectedTraceId, spanId, tab],
  );

  const handleTraceClick = useCallback(
    (traceId: string) => {
      const params =
        traceId === selectedTraceId
          ? getPreservedTraceFilterParams(searchParams)
          : buildTraceSelectionParams({ traceId, spanId: null, tab: null, scoreId: null });

      setSearchParams(params, { replace: true });
    },
    [buildTraceSelectionParams, searchParams, selectedTraceId, setSearchParams],
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

  const handleDateChange = useCallback((value: Date | undefined, type: 'from' | 'to') => {
    if (type === 'from') {
      setSelectedDateFrom(value);
      return;
    }

    setSelectedDateTo(value);
  }, []);

  const handleNextTrace = useCallback(() => {
    if (selectedTraceIndex < 0 || selectedTraceIndex >= orderedTraceEntries.length - 1) return;

    const nextTraceId = orderedTraceEntries[selectedTraceIndex + 1]?.id;
    if (!nextTraceId) return;

    setSearchParams(buildTraceSelectionParams({ traceId: nextTraceId, spanId: null, tab: null, scoreId: null }), {
      replace: true,
    });
  }, [buildTraceSelectionParams, orderedTraceEntries, selectedTraceIndex, setSearchParams]);

  const handlePreviousTrace = useCallback(() => {
    if (selectedTraceIndex <= 0) return;

    const previousTraceId = orderedTraceEntries[selectedTraceIndex - 1]?.id;
    if (!previousTraceId) return;

    setSearchParams(buildTraceSelectionParams({ traceId: previousTraceId, spanId: null, tab: null, scoreId: null }), {
      replace: true,
    });
  }, [buildTraceSelectionParams, orderedTraceEntries, selectedTraceIndex, setSearchParams]);

  const computeTraceLink = useCallback(
    (traceId: string, spanId?: string, tab?: string) => {
      const params = getPreservedTraceFilterParams(searchParams);
      setSelectionParam(params, TRACE_ID_PARAM, traceId);
      setSelectionParam(params, SPAN_ID_PARAM, spanId ?? null);
      setSelectionParam(params, TAB_PARAM, tab ?? null);
      params.delete(SCORE_ID_PARAM);
      return buildSelectionPath(params);
    },
    [searchParams],
  );

  const error = isTracesError ? parseError(tracesError) : undefined;
  const filtersApplied =
    !!selectedEntityOption ||
    !!selectedStatus ||
    filterTokens.length > 0 ||
    datePreset !== 'last-24h' ||
    !!selectedDateTo;

  if (tracesError && is401UnauthorizedError(tracesError)) {
    return (
      <EntityListPageLayout>
        <EntityListPageLayout.Top>
          <MainHeader withMargins={false}>
            <MainHeader.Column>
              <MainHeader.Title>
                <EyeIcon /> Observability
              </MainHeader.Title>
              <MainHeader.Description>Explore observability traces for your entities</MainHeader.Description>
            </MainHeader.Column>
            <MainHeader.Column className="flex justify-end gap-2">
              <ButtonWithTooltip
                as="a"
                href="https://mastra.ai/en/docs/observability/tracing/overview"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Observability documentation"
                tooltipContent="Go to Observability documentation"
              >
                <BookIcon />
              </ButtonWithTooltip>
            </MainHeader.Column>
          </MainHeader>
        </EntityListPageLayout.Top>
        <div className="flex h-full items-center justify-center">
          <SessionExpired />
        </div>
      </EntityListPageLayout>
    );
  }

  if (tracesError && is403ForbiddenError(tracesError)) {
    return (
      <EntityListPageLayout>
        <EntityListPageLayout.Top>
          <MainHeader withMargins={false}>
            <MainHeader.Column>
              <MainHeader.Title>
                <EyeIcon /> Observability
              </MainHeader.Title>
              <MainHeader.Description>Explore observability traces for your entities</MainHeader.Description>
            </MainHeader.Column>
            <MainHeader.Column className="flex justify-end gap-2">
              <ButtonWithTooltip
                as="a"
                href="https://mastra.ai/en/docs/observability/tracing/overview"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Observability documentation"
                tooltipContent="Go to Observability documentation"
              >
                <BookIcon />
              </ButtonWithTooltip>
            </MainHeader.Column>
          </MainHeader>
        </EntityListPageLayout.Top>
        <div className="flex h-full items-center justify-center">
          <PermissionDenied resource="traces" />
        </div>
      </EntityListPageLayout>
    );
  }

  return (
    <>
      <EntityListPageLayout className="grid-rows-[auto_1fr] overflow-y-auto">
        <EntityListPageLayout.Top>
          <MainHeader withMargins={false}>
            <MainHeader.Column>
              <MainHeader.Title isLoading={isTracesLoading}>
                <EyeIcon /> Observability
              </MainHeader.Title>
              <MainHeader.Description>Explore observability traces for your entities</MainHeader.Description>
            </MainHeader.Column>
            <MainHeader.Column className="flex justify-end gap-2">
              <ButtonWithTooltip
                as="a"
                href="https://mastra.ai/en/docs/observability/tracing/overview"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Observability documentation"
                tooltipContent="Go to Observability documentation"
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
            onDateChange={handleDateChange}
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

        {isTracesLoading ? (
          <EntryListSkeleton columns={tracesListColumns} />
        ) : (
          <TracesList
            traces={traces}
            selectedTraceId={selectedTraceId}
            onTraceClick={handleTraceClick}
            errorMsg={error?.error}
            setEndOfListElement={setEndOfListElement}
            filtersApplied={Boolean(filtersApplied)}
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={hasNextPage}
            groupByThread={groupByThread}
            threadTitles={threadTitles}
          />
        )}
      </EntityListPageLayout>

      <TraceDialog
        traceSpans={trace?.spans}
        traceId={selectedTraceId}
        initialSpanId={spanId}
        initialSpanTab={tab === 'scores' ? 'scores' : 'details'}
        initialScoreId={scoreId}
        traceDetails={traces.find(item => item.traceId === selectedTraceId)}
        isOpen={!!selectedTraceId}
        onClose={() => {
          setSearchParams(getPreservedTraceFilterParams(searchParams), { replace: true });
        }}
        onNext={handleNextTrace}
        onPrevious={handlePreviousTrace}
        isLoadingSpans={isLoadingTrace}
        computeTraceLink={computeTraceLink}
        scorers={scorers}
        isLoadingScorers={isLoadingScorers}
      />
    </>
  );
}
