import { EntityType } from '@mastra/core/observability';
import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { resolveTraceQueryTimeRange } from '../../trace-query-filters';
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
import type {
  TracesExplorerState,
  TracesFilters,
  TracesSelection,
  TracesSortDirection,
} from './traces-explorer-actions';
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
  useTraceQueryDeltaPollingAvailable,
  useTraceQueryDiscoveryAvailable,
  useTraceQueryRootDurationAvailable,
} from '@/domains/capabilities';

export type TracesExplorerRootProps = {
  selection: TracesSelection;
  filters: TracesFilters;
  /** Receives the full next state once per user action, so a filter edit and the selection it clears land together. */
  onChange: (next: TracesExplorerState) => void;
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

type Latest = Pick<TracesExplorerRootProps, 'selection' | 'filters' | 'onChange' | 'onSortDirectionChange'> & {
  scopedFieldIds: ReadonlySet<string>;
};

export function TracesExplorerRoot({
  selection,
  filters: rawFilters,
  onChange,
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
  const { enabled: withDeltaPolling } = useTraceQueryDeltaPollingAvailable();
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

  // Actions read the latest props when they run, so the host doesn't need stable callbacks.
  // `latest` is written as soon as a change is emitted, so a second action in the same tick
  // (the date picker fires a preset then its dates) builds on the first instead of the stale props.
  const current: Latest = { selection, filters: rawFilters, onChange, onSortDirectionChange, scopedFieldIds };
  const latest = useRef(current);
  latest.current = current;

  const actions = useMemo(() => {
    const emit = (next: TracesExplorerState) => {
      latest.current.selection = next.selection;
      latest.current.filters = next.filters;
      latest.current.onChange(next);
    };
    const updateSelection = (next: TracesSelection) => {
      if (next === latest.current.selection) return;
      emit({ selection: next, filters: latest.current.filters });
    };
    // A filter change invalidates whatever is selected: the selected row may no longer be listed.
    const updateFilters = (next: TracesFilters) => {
      const { selection: currentSelection, filters: currentFilters } = latest.current;
      if (next === currentFilters) return;
      emit({
        filters: next,
        selection: isSelectionEmpty(currentSelection) ? currentSelection : clearSelection(currentSelection),
      });
    };

    const selectionActions: TracesSelectionActions = {
      selectTrace: traceId => updateSelection(selectTrace(latest.current.selection, traceId)),
      closeTrace: () => updateSelection(selectTrace(latest.current.selection, null)),
      selectSpan: spanId => updateSelection(selectSpan(latest.current.selection, spanId)),
      setSpanTab: tab => updateSelection(setSpanTab(latest.current.selection, tab)),
      setSpanView: view => updateSelection(setSpanView(latest.current.selection, view)),
      selectScore: scoreId => updateSelection(selectScore(latest.current.selection, scoreId)),
      highlightSpans: spanIds => updateSelection(highlightSpans(latest.current.selection, spanIds)),
    };
    const filtersActions: TracesFiltersActions = {
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
    };
    const onSortChange = (direction: TracesSortDirection) => latest.current.onSortDirectionChange(direction);
    return { selectionActions, filtersActions, onSortChange };
  }, []);
  const { selectionActions, filtersActions, onSortChange } = actions;

  // Discovery is keyed off the date window with a mount-time `now`, not the list's rolling one,
  // so its query key (and the skeleton) doesn't churn on every auto-refresh tick.
  const [discoveryNow] = useState(() => new Date());
  const discoveryTimeRange = useMemo(
    () => resolveTraceQueryTimeRange(dateFrom, dateTo, discoveryNow),
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
      withDeltaPolling,
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
      withDeltaPolling,
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

  // Not memoized: the selection consumers (Layout, List, Panel) also re-render on filter and list
  // changes, which are what re-render Root while the selection stays the same.
  const selectionValue: TracesSelectionContextValue = {
    ...selectionActions,
    selection,
    selectedTraceId: selection.traceId,
  };

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
