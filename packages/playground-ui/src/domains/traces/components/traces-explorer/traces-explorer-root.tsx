import { EntityType } from '@mastra/core/observability';
import { useMastraClient } from '@mastra/react';
import {
  createTraceQueryValuesResolver,
  useEntityNames,
  useEnvironments,
  useTraceMetadataFilterFields,
} from '@mastra/react/hooks/traces';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTraceColumnPreferences } from '../../hooks/use-trace-column-preferences';
import { useTracesListSource } from '../../hooks/use-traces-list-source';
import {
  buildTraceListFilters,
  createTraceFilterBarFields,
  filterBarExpressionToTraceFilters,
  filterBarItemsToTraceTokens,
  traceFiltersToFilterBarExpression,
  traceTokensToFilterBarItems,
} from '../../trace-filters';
import { buildTraceQueryRequest } from '../../trace-query-filters';
import type { TraceQueryRelatedScope } from '../../trace-query-filters';
import { TRACE_TIME_RANGE_FIELD, TRACE_TIME_RANGE_FIELD_ID, TRACE_TIME_RANGE_ITEM } from '../trace-time-range-chip';
import {
  applyDate,
  applyDatePreset,
  applyDateRange,
  applyFilterTokens,
  clearSelection,
  DEFAULT_TRACES_FILTERS,
  getSelectedEntityOption,
  getSelectedStatus,
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
import {
  TracesColumnsContext,
  TracesConfigContext,
  TracesFiltersContext,
  TracesListContext,
  TracesSelectionContext,
} from './traces-explorer-context';
import type {
  TracesConfigContextValue,
  TracesExplorerFeatures,
  TracesExplorerScope,
  TracesFiltersActions,
  TracesFiltersContextValue,
  TracesListContextValue,
  TracesMetricsSupport,
  TracesSelectionActions,
  TracesSelectionContextValue,
} from './traces-explorer-context';
import {
  useFeedbackAvailable,
  useTraceQueryAvailable,
  useTraceQueryDiscoveryAvailable,
  useTraceQueryRootDurationAvailable,
} from '@/domains/capabilities';
import { isFilterBarGroup } from '@/ds/components/FilterBar';
import type { FilterBarExpression, FilterBarItem } from '@/ds/components/FilterBar';

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

const ROOT_DURATION_FIELD_IDS: ReadonlySet<string> = new Set(['durationMs']);
const SCOPED_FIELD_IDS: ReadonlySet<string> = new Set(['rootEntityType', 'entityId']);
const HIDDEN_SCOPED_FIELD_IDS: readonly string[] = ['rootEntityType', 'entityId', 'entityName'];
const NO_FIELD_IDS: ReadonlySet<string> = new Set();
const NO_HIDDEN_FIELD_IDS: readonly string[] = [];
const NO_SUGGESTIONS: string[] = [];

const listIdForScope = (scope?: TracesExplorerScope) =>
  scope?.entityType === EntityType.AGENT
    ? 'agent-traces'
    : scope?.entityType === EntityType.WORKFLOW_RUN
      ? 'workflows-traces'
      : 'all-traces';

type Latest = Pick<
  TracesExplorerRootProps,
  'selection' | 'filters' | 'onSelectionChange' | 'onFiltersChange' | 'onSortDirectionChange'
>;

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
  const { enabled: withDiscovery } = useTraceQueryDiscoveryAvailable();

  // Entries the server can't query are ignored, never written back: the host keeps its raw value.
  const filters = useMemo(() => sanitizeTracesFilters(rawFilters, withRootDuration), [rawFilters, withRootDuration]);
  const selectedEntityOption = useMemo(() => getSelectedEntityOption(filters.tokens), [filters.tokens]);
  const selectedStatus = useMemo(() => getSelectedStatus(filters.tokens), [filters.tokens]);

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
  const current: Latest = { selection, filters: rawFilters, onSelectionChange, onFiltersChange, onSortDirectionChange };
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

  const allFilterBarItems = useMemo(() => traceTokensToFilterBarItems(filters.tokens), [filters.tokens]);
  const filterBarItems = useMemo(
    () => allFilterBarItems.filter(item => !scopedFieldIds.has(item.fieldId)),
    [allFilterBarItems, scopedFieldIds],
  );
  // The time-range chip is a synthetic, always-present item so it takes part in keyboard
  // navigation; it never round-trips to filter tokens. Expression mode so root-level AND/OR
  // groups render as "Advanced filter" chips.
  const filterBarValue = useMemo<FilterBarExpression>(() => {
    const expression = traceFiltersToFilterBarExpression([], filters.groups);
    return { ...expression, nodes: [TRACE_TIME_RANGE_ITEM, ...filterBarItems, ...expression.nodes] };
  }, [filterBarItems, filters.groups]);
  // Legacy mode: the list endpoint can't express AND/OR groups, so the bar runs flat.
  const flatFilterBarValue = useMemo(() => [TRACE_TIME_RANGE_ITEM, ...filterBarItems], [filterBarItems]);

  // The filter-bar handlers close over the derived bar state; route them through a ref so the
  // action object stays stable.
  const currentBarState = { allFilterBarItems, filterBarItems, filterBarValue, scopedFieldIds };
  const barState = useRef(currentBarState);
  barState.current = currentBarState;

  const filtersActions = useMemo<TracesFiltersActions>(() => {
    // Re-inject the hidden scope items so "Clear filters" (which drops every removable item)
    // and any other edit can never drop the scope.
    const onFilterBarChange = (expression: FilterBarExpression) => {
      const { allFilterBarItems: all, scopedFieldIds: scoped } = barState.current;
      const { tokens, groups } = filterBarExpressionToTraceFilters({
        ...expression,
        nodes: expression.nodes.filter(node => isFilterBarGroup(node) || node.fieldId !== TRACE_TIME_RANGE_FIELD_ID),
      });
      const scopeTokens = filterBarItemsToTraceTokens(all.filter(item => scoped.has(item.fieldId)));
      updateFilters(applyFilterTokens(latest.current.filters, [...scopeTokens, ...tokens], groups));
    };
    return {
      onFilterBarChange,
      onFlatFilterBarChange: (items: FilterBarItem[]) =>
        onFilterBarChange({ ...traceFiltersToFilterBarExpression([], []), nodes: items }),
      onFilterByField: (fieldId, value) => {
        const { filterBarItems: items, filterBarValue: value_ } = barState.current;
        const withoutField = items.filter(item => item.fieldId !== fieldId);
        const item: FilterBarItem = { id: `${fieldId}:${value}`, fieldId, operatorId: 'is', value };
        const groups = value_.nodes.filter(isFilterBarGroup);
        onFilterBarChange({ ...value_, nodes: [...withoutField, item, ...groups] });
      },
      setDatePreset: preset => updateFilters(applyDatePreset(latest.current.filters, preset)),
      setDate: (value, end) => updateFilters(applyDate(latest.current.filters, value, end)),
      setDateRange: (from, to) => updateFilters(applyDateRange(latest.current.filters, from, to)),
    };
  }, [updateFilters]);

  const onSortChange = useCallback((direction: TracesSortDirection) => {
    latest.current.onSortDirectionChange(direction);
  }, []);

  const { data: rootEntityNameSuggestions = NO_SUGGESTIONS } = useEntityNames({
    entityType: selectedEntityOption?.entityType as EntityType | undefined,
    rootOnly: true,
  });
  const { data: discoveredEnvironments = NO_SUGGESTIONS } = useEnvironments();

  // Discovery is keyed off the date window with a mount-time `now`, not the list's rolling one,
  // so its query key (and the skeleton) doesn't churn on every auto-refresh tick.
  const [discoveryNow] = useState(() => new Date());
  const discoveryTimeRange = useMemo(
    () => buildTraceQueryRequest({ dateFrom, dateTo, tokens: [], now: discoveryNow }).timeRange,
    [dateFrom, dateTo, discoveryNow],
  );
  const {
    fields: metadataFields,
    canonicalFields: canonicalTraceFields,
    isLoading: isDiscoveryLoading,
  } = useTraceMetadataFilterFields({
    timeRange: discoveryTimeRange,
    queryOptions: { enabled: withQueryTrace && withDiscovery },
  });
  const client = useMastraClient();
  const valueSuggestions = useCallback(
    (relatedScope: TraceQueryRelatedScope | 'trace', path: string) =>
      createTraceQueryValuesResolver(client, discoveryTimeRange, relatedScope, path),
    [client, discoveryTimeRange],
  );

  const filterBarFields = useMemo(
    () => [
      TRACE_TIME_RANGE_FIELD,
      ...createTraceFilterBarFields({
        availableRootEntityNames: rootEntityNameSuggestions,
        availableEnvironments: discoveredEnvironments,
        hiddenFieldIds,
        metadataFields,
        canonicalTraceFields,
        valueSuggestions: withQueryTrace ? valueSuggestions : undefined,
        withQueryTrace,
        withRootDuration,
      }),
    ],
    [
      withRootDuration,
      rootEntityNameSuggestions,
      discoveredEnvironments,
      hiddenFieldIds,
      metadataFields,
      canonicalTraceFields,
      valueSuggestions,
      withQueryTrace,
    ],
  );
  // Metadata columns read top-level keys only, so nested paths collapse to their first segment.
  const availableMetadataKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const field of metadataFields) {
      const key = field.path.replace(/^metadata\./, '').split('.')[0];
      if (key) keys.add(key);
    }
    return [...keys].sort();
  }, [metadataFields]);

  const list = useTracesListSource({
    rolling: !dateTo,
    query: now =>
      buildTraceQueryRequest({
        rootEntityType: selectedEntityOption?.entityType,
        status: selectedStatus,
        dateFrom,
        dateTo,
        tokens: filters.tokens,
        groups: filters.groups,
        excludedFieldIds: withRootDuration ? undefined : ROOT_DURATION_FIELD_IDS,
        now,
      }),
    orderBy: [{ field: 'startedAt', direction: sortDirection }],
    withQueryTrace,
    enabled: !traceQuery.isLoading,
    legacyFilters: buildTraceListFilters({
      rootEntityType: selectedEntityOption?.entityType,
      status: selectedStatus,
      dateFrom,
      dateTo,
      tokens: filters.tokens,
    }),
  });

  const listId = listIdForScope(scope);
  const configValue = useMemo<TracesConfigContextValue>(
    () => ({
      listId,
      scopedFieldIds,
      hiddenFieldIds,
      withQueryTrace,
      withFeedback,
      withRootDuration,
      isCapabilitiesLoading: traceQuery.isLoading,
      metricsSupport,
      filterBarFields,
      availableMetadataKeys,
      isDiscoveryLoading,
    }),
    [
      listId,
      scopedFieldIds,
      hiddenFieldIds,
      withQueryTrace,
      withFeedback,
      withRootDuration,
      traceQuery.isLoading,
      metricsSupport,
      filterBarFields,
      availableMetadataKeys,
      isDiscoveryLoading,
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
      filterBarValue,
      flatFilterBarValue,
    }),
    [
      filtersActions,
      filters,
      dateFrom,
      dateTo,
      filtersApplied,
      contentFiltersApplied,
      filterBarValue,
      flatFilterBarValue,
    ],
  );

  const selectionValue = useMemo<TracesSelectionContextValue>(
    () => ({ ...selectionActions, selection, selectedTraceId: selection.traceId }),
    [selectionActions, selection],
  );

  const { rows, isLoading, isFetchingNextPage, hasNextPage, setEndOfListElement, error, autoRefetch, setAutoRefetch } =
    list;
  const listValue = useMemo<TracesListContextValue>(
    () => ({
      rows,
      isLoading,
      isFetchingNextPage,
      hasNextPage,
      setEndOfListElement,
      error,
      autoRefetch,
      setAutoRefetch,
      sortDirection,
      onSortChange,
    }),
    [
      rows,
      isLoading,
      isFetchingNextPage,
      hasNextPage,
      setEndOfListElement,
      error,
      autoRefetch,
      setAutoRefetch,
      sortDirection,
      onSortChange,
    ],
  );

  return (
    <TracesConfigContext.Provider value={configValue}>
      <TracesFiltersContext.Provider value={filtersValue}>
        <TracesSelectionContext.Provider value={selectionValue}>
          <TracesListContext.Provider value={listValue}>
            <TracesColumnsProvider>{children}</TracesColumnsProvider>
          </TracesListContext.Provider>
        </TracesSelectionContext.Provider>
      </TracesFiltersContext.Provider>
    </TracesConfigContext.Provider>
  );
}

/**
 * Its own memoized component so toggling a column doesn't re-run the root's hooks, and a root
 * render (e.g. a list poll tick) doesn't hand column consumers a fresh preferences object.
 */
const TracesColumnsProvider = memo(function TracesColumnsProvider({ children }: { children: ReactNode }) {
  const columns = useTraceColumnPreferences();
  return <TracesColumnsContext.Provider value={columns}>{children}</TracesColumnsContext.Provider>;
});
