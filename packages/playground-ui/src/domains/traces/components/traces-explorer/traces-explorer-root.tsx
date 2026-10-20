import { EntityType } from '@mastra/core/observability';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { buildTraceQueryRequest } from '../../trace-query-filters';
import {
  applyDate,
  applyDatePreset,
  applyDateRange,
  applyFilterTokens,
  clearSelection,
  DEFAULT_TRACES_FILTERS,
  highlightSpans,
  isSelectionEmpty,
  resolveTracesDateWindow,
  sanitizeTracesFilters,
  selectScore,
  selectSpan,
  selectTrace,
  setSpanTab,
  setSpanView,
} from './traces-explorer-actions';
import type { TracesFilters, TracesSelection, TracesSortDirection } from './traces-explorer-actions';
import { TracesColumnsProvider } from './traces-explorer-columns-provider';
import { TracesConfigContext, TracesFiltersContext, TracesSelectionContext } from './traces-explorer-context';
import type {
  TracesConfigContextValue,
  TracesExplorerFeatures,
  TracesExplorerScope,
  TracesFiltersActions,
  TracesFiltersContextValue,
  TracesMetricsSupport,
  TracesSelectionActions,
  TracesSelectionContextValue,
} from './traces-explorer-context';
import { TracesListProvider } from './traces-explorer-list-provider';
import {
  useFeedbackAvailable,
  useTraceQueryAvailable,
  useTraceQueryDiscoveryAvailable,
  useTraceQueryRootDurationAvailable,
} from '@/domains/capabilities';

export type TracesExplorerRootProps = {
  selection: TracesSelection;
  onSelectionChange: (next: TracesSelection) => void;
  filters: TracesFilters;
  onFiltersChange: (next: TracesFilters) => void;
  sortDirection: TracesSortDirection;
  onSortDirectionChange: (next: TracesSortDirection) => void;
  /** Pins the explorer to one entity: its fields stay in the filters but never surface as chips. */
  scope?: TracesExplorerScope;
  /** Resolved by the host, which may know better than the storage capabilities (e.g. hosted deployments). */
  metricsSupport: TracesMetricsSupport;
  /** Host switches combined with the server capabilities; a feature runs only when both allow it. */
  features?: TracesExplorerFeatures;
  /** The host's default filters. Filters matching them don't count as applied (e.g. in empty states). */
  initialFilters?: TracesFilters;
  children: ReactNode;
};

const SCOPED_FIELD_IDS: ReadonlySet<string> = new Set(['rootEntityType', 'entityId']);
const HIDDEN_SCOPED_FIELD_IDS: readonly string[] = ['rootEntityType', 'entityId', 'entityName'];
const NO_FIELD_IDS: ReadonlySet<string> = new Set();
const NO_HIDDEN_FIELD_IDS: readonly string[] = [];

const listIdForScope = (scope?: TracesExplorerScope) =>
  scope?.entityType === EntityType.AGENT
    ? 'agent-traces'
    : scope?.entityType === EntityType.WORKFLOW_RUN
      ? 'workflows-traces'
      : 'all-traces';

type Latest = Pick<
  TracesExplorerRootProps,
  'selection' | 'filters' | 'onSelectionChange' | 'onFiltersChange' | 'onSortDirectionChange'
> & { scopedFieldIds: ReadonlySet<string> };

export function TracesExplorerRoot({
  selection,
  onSelectionChange,
  filters: rawFilters,
  onFiltersChange,
  sortDirection,
  onSortDirectionChange,
  scope,
  metricsSupport,
  features,
  initialFilters = DEFAULT_TRACES_FILTERS,
  children,
}: TracesExplorerRootProps) {
  // Servers without the trace-query API list through `listTracesLight` and don't expose feedback.
  const traceQuery = useTraceQueryAvailable();
  const withQueryTrace = traceQuery.enabled && features?.traceQuery !== false;
  const withFeedback = useFeedbackAvailable().enabled && features?.feedback !== false;
  const { enabled: withRootDuration } = useTraceQueryRootDurationAvailable();
  const withDiscovery = useTraceQueryDiscoveryAvailable().enabled && withQueryTrace;

  // Entries the server can't query are ignored, never written back: the host keeps its raw value.
  const filters = useMemo(() => sanitizeTracesFilters(rawFilters, withRootDuration), [rawFilters, withRootDuration]);

  const isScoped = !!scope;
  const scopedFieldIds = isScoped ? SCOPED_FIELD_IDS : NO_FIELD_IDS;
  const hiddenFieldIds = isScoped ? HIDDEN_SCOPED_FIELD_IDS : NO_HIDDEN_FIELD_IDS;

  // Rolling presets pin their start when the preset (or custom bound) changes, not on every render.
  const fromMs = rawFilters.dateFrom?.getTime();
  const toMs = rawFilters.dateTo?.getTime();
  const { dateFrom, dateTo } = useMemo(
    () =>
      resolveTracesDateWindow(
        rawFilters.datePreset,
        fromMs === undefined ? undefined : new Date(fromMs),
        toMs === undefined ? undefined : new Date(toMs),
      ),
    [rawFilters.datePreset, fromMs, toMs],
  );

  // Every action reads the latest props when it runs, so the host doesn't need stable callbacks.
  const current: Latest = {
    selection,
    filters: rawFilters,
    onSelectionChange,
    onFiltersChange,
    onSortDirectionChange,
    scopedFieldIds,
  };
  const latest = useRef(current);
  latest.current = current;

  const selectionActions = useMemo<TracesSelectionActions>(() => {
    const update = (next: TracesSelection) => {
      if (next === latest.current.selection) return;
      latest.current.selection = next;
      latest.current.onSelectionChange(next);
    };
    return {
      selectTrace: traceId => update(selectTrace(latest.current.selection, traceId)),
      closeTrace: () => update(selectTrace(latest.current.selection, null)),
      selectSpan: spanId => update(selectSpan(latest.current.selection, spanId)),
      setSpanTab: tab => update(setSpanTab(latest.current.selection, tab)),
      setSpanView: view => update(setSpanView(latest.current.selection, view)),
      selectScore: scoreId => update(selectScore(latest.current.selection, scoreId)),
      highlightSpans: spanIds => update(highlightSpans(latest.current.selection, spanIds)),
    };
  }, []);

  // A filter change invalidates whatever is selected: the selected row may no longer be listed.
  // Writing `latest` right away lets a second call in the same tick build on the first.
  const updateFilters = useCallback((next: TracesFilters) => {
    if (next === latest.current.filters) return;
    latest.current.filters = next;
    latest.current.onFiltersChange(next);
    const current = latest.current.selection;
    if (!isSelectionEmpty(current)) {
      const cleared = clearSelection(current);
      latest.current.selection = cleared;
      latest.current.onSelectionChange(cleared);
    }
  }, []);

  const filtersActions = useMemo<TracesFiltersActions>(
    () => ({
      // Re-inject the scope tokens so "Clear filters" (which drops every removable item) and any
      // other edit can never drop the scope.
      setFilterTokens: (tokens, groups) => {
        const { filters: base, scopedFieldIds: scoped } = latest.current;
        const scopeTokens = base.tokens.filter(token => scoped.has(token.fieldId));
        updateFilters(applyFilterTokens(base, [...scopeTokens, ...tokens], groups));
      },
      setDatePreset: preset => updateFilters(applyDatePreset(latest.current.filters, preset)),
      setDate: (value, end) => updateFilters(applyDate(latest.current.filters, value, end)),
      setDateRange: (from, to) => updateFilters(applyDateRange(latest.current.filters, from, to)),
    }),
    [updateFilters],
  );

  const onSortChange = useCallback((direction: TracesSortDirection) => {
    latest.current.onSortDirectionChange(direction);
  }, []);

  // Discovery is keyed off the date window with a mount-time `now`, not the list's rolling one,
  // so its query key (and the skeleton) doesn't churn on every auto-refresh tick.
  const [discoveryNow] = useState(() => new Date());
  const discoveryTimeRange = useMemo(
    () => buildTraceQueryRequest({ dateFrom, dateTo, tokens: [], now: discoveryNow }).timeRange,
    [dateFrom, dateTo, discoveryNow],
  );

  const listId = listIdForScope(scope);
  const configValue = useMemo<TracesConfigContextValue>(
    () => ({
      listId,
      scopedFieldIds,
      hiddenFieldIds,
      withQueryTrace,
      withFeedback,
      withRootDuration,
      withDiscovery,
      isCapabilitiesLoading: traceQuery.isLoading,
      metricsSupport,
      discoveryTimeRange,
    }),
    [
      listId,
      scopedFieldIds,
      hiddenFieldIds,
      withQueryTrace,
      withFeedback,
      withRootDuration,
      withDiscovery,
      traceQuery.isLoading,
      metricsSupport,
      discoveryTimeRange,
    ],
  );

  const contentFiltersApplied = filters.tokens.length > 0 || filters.groups.length > 0;
  const filtersApplied = contentFiltersApplied || filters.datePreset !== initialFilters.datePreset || !!dateTo;
  const filtersValue = useMemo<TracesFiltersContextValue>(
    () => ({
      ...filtersActions,
      filters,
      dateFrom,
      dateTo,
      filtersApplied,
      contentFiltersApplied,
    }),
    [filtersActions, filters, dateFrom, dateTo, filtersApplied, contentFiltersApplied],
  );

  const selectionValue = useMemo<TracesSelectionContextValue>(
    () => ({ ...selectionActions, selection, selectedTraceId: selection.traceId }),
    [selectionActions, selection],
  );

  return (
    <TracesConfigContext.Provider value={configValue}>
      <TracesFiltersContext.Provider value={filtersValue}>
        <TracesSelectionContext.Provider value={selectionValue}>
          <TracesListProvider sortDirection={sortDirection} onSortChange={onSortChange}>
            <TracesColumnsProvider>{children}</TracesColumnsProvider>
          </TracesListProvider>
        </TracesSelectionContext.Provider>
      </TracesFiltersContext.Provider>
    </TracesConfigContext.Provider>
  );
}
