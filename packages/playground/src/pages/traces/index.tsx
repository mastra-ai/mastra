import type { PropertyFilterToken } from '@mastra/playground-ui';
import {
  ButtonWithTooltip,
  DateTimeRangePicker,
  ErrorState,
  NoDataPageLayout,
  PageHeader,
  PageLayout,
  PermissionDenied,
  PropertyFilterCreator,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
  parseError,
  toast,
} from '@mastra/playground-ui';
import { BookIcon, EyeIcon, ListIcon, ListTreeIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useEntityNames } from '@/domains/observability/hooks/use-entity-names';
import { useEnvironments } from '@/domains/observability/hooks/use-environments';
import { useServiceNames } from '@/domains/observability/hooks/use-service-names';
import { useTags } from '@/domains/observability/hooks/use-tags';
import { useTraces } from '@/domains/observability/hooks/use-traces';
import { ObservabilityTracesList } from '@/domains/traces/components/observability-traces-list';
import type { SpanTab } from '@/domains/traces/components/observability-traces-list';
import { TracesToolbar } from '@/domains/traces/components/traces-toolbar';
import {
  applyTracePropertyFilterTokens,
  buildTraceListFilters,
  clearSavedTraceFilters,
  createTracePropertyFilterFields,
  getTracePropertyFilterTokens,
  hasAnyTraceFilterParams,
  loadTraceFiltersFromStorage,
  ROOT_ENTITY_TYPE_OPTIONS,
  saveTraceFiltersToStorage,
  TRACE_DATE_FROM_PARAM,
  TRACE_DATE_PRESET_PARAM,
  TRACE_DATE_PRESET_VALUES,
  TRACE_DATE_TO_PARAM,
  TRACE_PROPERTY_FILTER_FIELD_IDS,
  TRACE_PROPERTY_FILTER_PARAM_BY_FIELD,
  TRACE_ROOT_ENTITY_TYPE_PARAM,
  TRACE_STATUS_PARAM,
  TRACE_STATUS_VALUES,
} from '@/domains/traces/trace-filters';
import type { TraceStatusFilter } from '@/domains/traces/trace-filters';
import type { TraceDatePreset } from '@/domains/traces/types';

const TRACE_ID_PARAM = 'traceId';
const SPAN_ID_PARAM = 'spanId';
const TAB_PARAM = 'tab';
const SCORE_ID_PARAM = 'scoreId';

const DAY_MS = 24 * 60 * 60 * 1000;
const PRESET_MS: Partial<Record<TraceDatePreset, number>> = {
  'last-24h': DAY_MS,
  'last-3d': 3 * DAY_MS,
  'last-7d': 7 * DAY_MS,
  'last-14d': 14 * DAY_MS,
  'last-30d': 30 * DAY_MS,
};

/** Clear the featured trace/span/tab/score selection from URL params (used when filters change). */
function clearSelectionParams(params: URLSearchParams) {
  params.delete(TRACE_ID_PARAM);
  params.delete(SPAN_ID_PARAM);
  params.delete(TAB_PARAM);
  params.delete(SCORE_ID_PARAM);
}

export default function Traces() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [groupByThread, setGroupByThread] = useState<boolean>(false);
  const [autoFocusFilterFieldId, setAutoFocusFilterFieldId] = useState<string | undefined>();

  const datePreset = useMemo<TraceDatePreset>(() => {
    const value = searchParams.get(TRACE_DATE_PRESET_PARAM);
    return value && TRACE_DATE_PRESET_VALUES.has(value as TraceDatePreset) ? (value as TraceDatePreset) : 'last-24h';
  }, [searchParams]);

  const dateFromParamRaw = searchParams.get(TRACE_DATE_FROM_PARAM);
  const dateToParamRaw = searchParams.get(TRACE_DATE_TO_PARAM);

  const selectedDateFrom = useMemo(() => {
    if (datePreset === 'custom') {
      if (!dateFromParamRaw) return undefined;
      const parsed = new Date(dateFromParamRaw);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    }
    if (datePreset === 'all') return undefined;
    const ms = PRESET_MS[datePreset];
    return ms ? new Date(Date.now() - ms) : undefined;
  }, [datePreset, dateFromParamRaw]);

  const selectedDateTo = useMemo(() => {
    if (datePreset !== 'custom' || !dateToParamRaw) return undefined;
    const parsed = new Date(dateToParamRaw);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }, [datePreset, dateToParamRaw]);

  // Track the latest preset synchronously so onDateChange callbacks that follow
  // a non-custom preset switch can be ignored (react-router's setSearchParams
  // captures searchParams in its closure, so multiple synchronous calls would
  // otherwise clobber each other).
  const datePresetRef = useRef(datePreset);
  datePresetRef.current = datePreset;

  const traceIdParam = searchParams.get(TRACE_ID_PARAM) || undefined;
  const spanIdParam = searchParams.get(SPAN_ID_PARAM) || undefined;
  const tabParam = searchParams.get(TAB_PARAM);
  const spanTabParam: SpanTab | undefined =
    tabParam === 'scoring' ? 'scoring' : tabParam === 'details' ? 'details' : undefined;
  const scoreIdParam = searchParams.get(SCORE_ID_PARAM) || undefined;

  const selectedEntityOption = useMemo(
    () => ROOT_ENTITY_TYPE_OPTIONS.find(option => option.entityType === searchParams.get(TRACE_ROOT_ENTITY_TYPE_PARAM)),
    [searchParams],
  );
  const selectedStatus = useMemo<TraceStatusFilter | undefined>(() => {
    const value = searchParams.get(TRACE_STATUS_PARAM);
    return value && TRACE_STATUS_VALUES.has(value as TraceStatusFilter) ? (value as TraceStatusFilter) : undefined;
  }, [searchParams]);
  // Tokens come back in the order their URL params were first inserted, so
  // the PropertyFilterApplied pills render in filter-creation order. Synthetic tokens
  // (rootEntityType, status) are already interleaved by the helper.
  const filterTokens = useMemo(() => getTracePropertyFilterTokens(searchParams), [searchParams]);

  const { data: availableTags = [], isPending: isTagsLoading } = useTags();
  const { data: rootEntityNameSuggestions = [], isPending: isEntityNamesLoading } = useEntityNames({
    entityType: selectedEntityOption?.entityType,
    rootOnly: true,
  });
  const { data: discoveredEnvironments = [], isPending: isEnvironmentsLoading } = useEnvironments();
  const { data: discoveredServiceNames = [], isPending: isServiceNamesLoading } = useServiceNames();

  const filterFields = useMemo(
    () =>
      createTracePropertyFilterFields({
        availableTags,
        availableRootEntityNames: rootEntityNameSuggestions,
        availableServiceNames: discoveredServiceNames,
        availableEnvironments: discoveredEnvironments,
        loading: {
          tags: isTagsLoading,
          entityNames: isEntityNamesLoading,
          serviceNames: isServiceNamesLoading,
          environments: isEnvironmentsLoading,
        },
      }),
    [
      availableTags,
      rootEntityNameSuggestions,
      discoveredServiceNames,
      discoveredEnvironments,
      isTagsLoading,
      isEntityNamesLoading,
      isServiceNamesLoading,
      isEnvironmentsLoading,
    ],
  );

  const traceFilters = useMemo(
    () =>
      buildTraceListFilters({
        rootEntityType: selectedEntityOption?.entityType,
        status: selectedStatus,
        dateFrom: selectedDateFrom,
        dateTo: selectedDateTo,
        tokens: filterTokens,
      }),
    [filterTokens, selectedDateFrom, selectedDateTo, selectedEntityOption, selectedStatus],
  );

  const {
    data: tracesData,
    isLoading: isTracesLoading,
    isFetchingNextPage,
    hasNextPage,
    setEndOfListElement,
    error: TracesError,
    isError: isTracesError,
  } = useTraces({ filters: traceFilters });

  const traces = useMemo(() => tracesData?.spans ?? [], [tracesData?.spans]);
  const threadTitles = tracesData?.threadTitles ?? {};

  const handleTraceClick = useCallback(
    (traceId: string) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (traceId) {
            next.set(TRACE_ID_PARAM, traceId);
          } else {
            next.delete(TRACE_ID_PARAM);
          }
          next.delete(SPAN_ID_PARAM);
          next.delete(TAB_PARAM);
          next.delete(SCORE_ID_PARAM);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleSpanChange = useCallback(
    (spanId: string | null) => {
      const currentSpanId = searchParams.get(SPAN_ID_PARAM) || null;
      if (spanId === currentSpanId) return;

      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (spanId) {
            next.set(SPAN_ID_PARAM, spanId);
          } else {
            next.delete(SPAN_ID_PARAM);
          }
          return next;
        },
        { replace: true },
      );
    },
    [searchParams, setSearchParams],
  );

  const handleSpanTabChange = useCallback(
    (tab: SpanTab) => {
      const currentTab = searchParams.get(TAB_PARAM) || null;
      if (tab === currentTab) return;

      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (tab && tab !== 'details') {
            next.set(TAB_PARAM, tab);
          } else {
            next.delete(TAB_PARAM);
          }
          next.delete(SCORE_ID_PARAM);
          return next;
        },
        { replace: true },
      );
    },
    [searchParams, setSearchParams],
  );

  const handleScoreChange = useCallback(
    (scoreId: string | null) => {
      const currentScoreId = searchParams.get(SCORE_ID_PARAM) || null;
      if (scoreId === currentScoreId) return;

      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (scoreId) {
            next.set(SCORE_ID_PARAM, scoreId);
          } else {
            next.delete(SCORE_ID_PARAM);
          }
          return next;
        },
        { replace: true },
      );
    },
    [searchParams, setSearchParams],
  );

  const handleFilterTokensChange = useCallback(
    (nextTokens: PropertyFilterToken[]) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          // applyTracePropertyFilterTokens wipes all filter params (including
          // rootEntityType / status) and re-adds them in `nextTokens` order so
          // URL insertion order == filter creation order.
          applyTracePropertyFilterTokens(next, nextTokens);
          clearSelectionParams(next);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // Only relevant for 'custom' — the picker also fires onDateChange after a
  // non-custom preset switch, which we ignore to avoid racing URL updates.
  const handleDateChange = useCallback(
    (value: Date | undefined, type: 'from' | 'to') => {
      if (datePresetRef.current !== 'custom') return;
      const param = type === 'from' ? TRACE_DATE_FROM_PARAM : TRACE_DATE_TO_PARAM;
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (value) {
            next.set(param, value.toISOString());
          } else {
            next.delete(param);
          }
          clearSelectionParams(next);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleDatePresetChange = useCallback(
    (preset: TraceDatePreset) => {
      // Update ref synchronously so any onDateChange fired by the picker in the
      // same tick (for non-custom presets) sees the new value and skips.
      datePresetRef.current = preset;
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (preset === 'last-24h') {
            // Default — clear all date params.
            next.delete(TRACE_DATE_PRESET_PARAM);
            next.delete(TRACE_DATE_FROM_PARAM);
            next.delete(TRACE_DATE_TO_PARAM);
          } else if (preset === 'custom') {
            next.set(TRACE_DATE_PRESET_PARAM, 'custom');
            // Keep existing dateFrom/dateTo for the user to adjust.
          } else {
            // `last-*` or 'all' — only the preset is stored; dates are derived.
            next.set(TRACE_DATE_PRESET_PARAM, preset);
            next.delete(TRACE_DATE_FROM_PARAM);
            next.delete(TRACE_DATE_TO_PARAM);
          }
          clearSelectionParams(next);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const [hasSavedFilters, setHasSavedFilters] = useState(() => loadTraceFiltersFromStorage() !== null);

  const handleSave = useCallback(() => {
    saveTraceFiltersToStorage(searchParams);
    setHasSavedFilters(true);
    toast.success('Filters setting for Traces saved');
  }, [searchParams]);

  const handleRemoveSaved = useCallback(() => {
    clearSavedTraceFilters();
    setHasSavedFilters(false);
    toast.success('Filters setting for Traces cleared up');
  }, []);

  // Hydrate from the saved filter set on mount, but only when the URL is
  // filter-clean (user arrived via a plain sidebar nav). If the URL already
  // carries filters — e.g. a shared link — we leave it alone.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    if (hasAnyTraceFilterParams(searchParams)) return;
    const saved = loadTraceFiltersFromStorage();
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
    // Run once on mount — searchParams intentionally read at mount time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRemoveAll = useCallback(() => {
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        next.delete(TRACE_ROOT_ENTITY_TYPE_PARAM);
        next.delete(TRACE_STATUS_PARAM);
        for (const fieldId of TRACE_PROPERTY_FILTER_FIELD_IDS) {
          next.delete(TRACE_PROPERTY_FILTER_PARAM_BY_FIELD[fieldId]);
        }
        clearSelectionParams(next);
        return next;
      },
      { replace: true },
    );
    setGroupByThread(false);
  }, [setSearchParams]);

  // Clear = keep all pills, neutralize their values. '' for text, 'Any' for
  // single-select radios, [] for multi-select checkboxes. Date range is
  // preserved.
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
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        applyTracePropertyFilterTokens(next, neutralTokens);
        clearSelectionParams(next);
        return next;
      },
      { replace: true },
    );
  }, [filterFields, filterTokens, setSearchParams]);

  const error = isTracesError ? parseError(TracesError) : undefined;

  if (TracesError && is401UnauthorizedError(TracesError)) {
    return (
      <NoDataPageLayout title="Traces" icon={<EyeIcon />}>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (TracesError && is403ForbiddenError(TracesError)) {
    return (
      <NoDataPageLayout title="Traces" icon={<EyeIcon />}>
        <PermissionDenied resource="traces" />
      </NoDataPageLayout>
    );
  }

  if (TracesError) {
    return (
      <NoDataPageLayout title="Traces" icon={<EyeIcon />}>
        <ErrorState title="Failed to load traces" message={error?.error ?? 'Unknown error'} />
      </NoDataPageLayout>
    );
  }

  const filtersApplied =
    !!selectedEntityOption ||
    !!selectedStatus ||
    filterTokens.length > 0 ||
    datePreset !== 'last-24h' ||
    !!selectedDateTo;

  return (
    <PageLayout width="wide" height="full">
      <PageLayout.TopArea>
        <PageLayout.Row>
          <PageLayout.Column>
            <PageHeader>
              <PageHeader.Title isLoading={isTracesLoading}>
                <EyeIcon /> Traces
              </PageHeader.Title>
            </PageHeader>
          </PageLayout.Column>
          <PageLayout.Column className="flex justify-end items-center gap-2">
            <DateTimeRangePicker
              preset={datePreset}
              onPresetChange={handleDatePresetChange}
              dateFrom={selectedDateFrom}
              dateTo={selectedDateTo}
              onDateChange={handleDateChange}
              disabled={isTracesLoading}
              presets={['last-24h', 'last-3d', 'last-7d', 'last-14d', 'last-30d', 'custom']}
            />
            <PropertyFilterCreator
              fields={filterFields}
              tokens={filterTokens}
              onTokensChange={handleFilterTokensChange}
              disabled={isTracesLoading}
              onStartTextFilter={setAutoFocusFilterFieldId}
            />
            <ButtonWithTooltip
              disabled={isTracesLoading}
              aria-pressed={groupByThread}
              aria-label={groupByThread ? 'Ungroup traces' : 'Group traces by thread'}
              tooltipContent={groupByThread ? 'Ungroup traces' : 'Group traces by thread'}
              onClick={() => setGroupByThread(prev => !prev)}
            >
              {groupByThread ? <ListIcon /> : <ListTreeIcon />}
            </ButtonWithTooltip>
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
          </PageLayout.Column>
        </PageLayout.Row>

        <TracesToolbar
          isLoading={isTracesLoading}
          filterFields={filterFields}
          filterTokens={filterTokens}
          onFilterTokensChange={handleFilterTokensChange}
          onClear={handleClear}
          onRemoveAll={handleRemoveAll}
          onSave={handleSave}
          onRemoveSaved={hasSavedFilters ? handleRemoveSaved : undefined}
          autoFocusFilterFieldId={autoFocusFilterFieldId}
        />
      </PageLayout.TopArea>

      <ObservabilityTracesList
        traces={traces}
        isLoading={isTracesLoading}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        setEndOfListElement={setEndOfListElement}
        filtersApplied={filtersApplied}
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
    </PageLayout>
  );
}
