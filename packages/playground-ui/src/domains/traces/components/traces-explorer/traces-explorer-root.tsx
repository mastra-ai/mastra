import { useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { TRACE_COLUMN_CATALOGS } from '../../trace-list-columns';
import type { TraceColumnPreferences } from '../../trace-list-columns';
import type { FeedbackOptions } from '../feedback-options';
import {
  applyDate,
  applyDatePreset,
  applyDateRange,
  applyFilterTokens,
  clearSelection,
  DEFAULT_TRACES_FILTERS,
  highlightSpans,
  isSelectionEmpty,
  selectsRunningStatus,
  selectScore,
  selectSpan,
  selectTrace,
  setSpanTab,
  setSpanView,
} from './traces-explorer-actions';
import type { TracesExplorerState, TracesFilters, TracesSelection, TracesSort } from './traces-explorer-actions';
import { TracesColumnsProvider } from './traces-explorer-columns-provider';
import { TracesConfigContext, TracesFiltersContext, TracesSelectionContext } from './traces-explorer-context';
import type {
  TracesConfigContextValue,
  TracesFiltersActions,
  TracesFiltersContextValue,
  TracesSelectionActions,
  TracesSelectionContextValue,
} from './traces-explorer-context';
import { NO_TRACES_DISCOVERY } from './traces-explorer-data';
import type { TracesExplorerCapabilities, TracesExplorerDiscovery, TracesExplorerTraces } from './traces-explorer-data';
import { TracesListProvider } from './traces-explorer-list-provider';
import { resolveTracesSupport, sanitizeTracesFiltersFor, tracesListIdForScope } from './traces-explorer-support';
import type {
  TracesExplorerFeatures,
  TracesExplorerScope,
  TracesMetricsSupport,
  TracesRootSource,
} from './traces-explorer-support';
import { useTracesDateWindow } from './use-traces-date-window';
import { hasTokenSearchFilter } from '@/domains/observability/lib/token-search-predicate';
import { rangeBeforeZoom, rememberZoom } from '@/domains/observability/lib/zoom-memory';
import type { ZoomMemory } from '@/domains/observability/lib/zoom-memory';

export type TracesExplorerRootProps = {
  selection: TracesSelection;
  filters: TracesFilters;
  /** Receives the full next state once per user action, so a filter edit and the selection it clears land together. */
  onChange: (next: TracesExplorerState) => void;
  sort: TracesSort;
  onSortChange: (next: TracesSort) => void;
  /** The visible columns. The host owns them (and their persistence, e.g. `useTraceColumnPreferences`). */
  columns: TraceColumnPreferences;
  /** Receives the whole next column selection on every change. */
  onColumnsChange: (next: TraceColumnPreferences) => void;
  /** What the store supports. The explorer never fetches: the host loads them (Studio: `useObservabilityCapabilities`). */
  capabilities: TracesExplorerCapabilities;
  /** The traces list, loaded by the host for these filters and this sort (Studio: `useTracesListQuery`). */
  traces: TracesExplorerTraces;
  /** The metadata fields observed in the window, for the filter bar and the columns menu (Studio: `useTracesDiscoveryQuery`). */
  discovery?: TracesExplorerDiscovery;
  /** Pins the explorer to one entity: its fields stay in the filters but never surface as chips. */
  scope?: TracesExplorerScope;
  /** Resolved by the host, which may know better than the storage capabilities (e.g. hosted deployments). */
  metricsSupport: TracesMetricsSupport;
  /** Host switches combined with the server capabilities; a feature runs only when both allow it. */
  features?: TracesExplorerFeatures;
  /** Host-selected root projection. Hosts should offer aggregated roots only when the server advertises support. */
  rootSource?: TracesRootSource;
  /**
   * Write context and action support for feedback in trace, span and thread panels. The panel hands it to
   * its feedback and thread views (`renderFeedback`, `renderSpanFeedback`, `renderThread`).
   */
  feedbackOptions?: FeedbackOptions;
  /** The host's default filters. Filters matching them don't count as applied (e.g. in empty states). */
  initialFilters?: TracesFilters;
  children: ReactNode;
};

const SCOPED_FIELD_IDS: ReadonlySet<string> = new Set(['rootEntityType', 'entityId']);
const HIDDEN_SCOPED_FIELD_IDS: readonly string[] = ['rootEntityType', 'entityId', 'entityName'];
const NO_FIELD_IDS: ReadonlySet<string> = new Set();
const NO_HIDDEN_FIELD_IDS: readonly string[] = [];

type Latest = Pick<
  TracesExplorerRootProps,
  'selection' | 'filters' | 'onChange' | 'onSortChange' | 'onColumnsChange'
> & {
  scopedFieldIds: ReadonlySet<string>;
};

export function TracesExplorerRoot({
  selection,
  filters: rawFilters,
  onChange,
  sort,
  onSortChange: onHostSortChange,
  columns,
  onColumnsChange,
  capabilities,
  traces,
  discovery = NO_TRACES_DISCOVERY,
  scope,
  metricsSupport,
  features,
  rootSource,
  feedbackOptions,
  initialFilters = DEFAULT_TRACES_FILTERS,
  children,
}: TracesExplorerRootProps) {
  const {
    withQueryTrace,
    withTokenSearch,
    withFeedback,
    withSpanQuery,
    withThreadQuery,
    withRootDuration,
    withOutcomeFields,
    withTimeToFirstChunk,
    withTimeToFirstChunkSort,
    withTimeToFirstToken,
    withTimeToFirstTokenSort,
    withDiscovery,
    withTraceAggregate,
    isCapabilitiesLoading,
  } = resolveTracesSupport(capabilities, features);

  // Sanitize for display without rewriting host state. A later filter edit replaces the displayed token list.
  const filters = useMemo(
    () =>
      sanitizeTracesFiltersFor(rawFilters, {
        withTokenSearch,
        withRootDuration,
        withTimeToFirstChunk,
        withTimeToFirstToken,
        withOutcomeFields,
      }),
    [rawFilters, withRootDuration, withTimeToFirstChunk, withTimeToFirstToken, withOutcomeFields, withTokenSearch],
  );

  const isScoped = !!scope;
  const scopedFieldIds = isScoped ? SCOPED_FIELD_IDS : NO_FIELD_IDS;
  const hiddenFieldIds = isScoped ? HIDDEN_SCOPED_FIELD_IDS : NO_HIDDEN_FIELD_IDS;

  const { dateFrom, dateTo } = useTracesDateWindow(rawFilters);

  // Actions read the latest props when they run, so the host doesn't need stable callbacks.
  // `latest` is written as soon as a change is emitted, so a second action in the same tick
  // (the date picker fires a preset then its dates) builds on the first instead of the stale props.
  const current: Latest = {
    selection,
    filters: rawFilters,
    onChange,
    onSortChange: onHostSortChange,
    onColumnsChange,
    scopedFieldIds,
  };
  const latest = useRef(current);
  latest.current = current;
  // Not part of the host's filters: a shared or reloaded link has no zoom to undo.
  const zoomMemory = useRef<ZoomMemory | undefined>(undefined);

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
    // A range picked by hand drops the zoom memory, even one that matches the zoomed bounds.
    const pickRange = (next: TracesFilters) => {
      zoomMemory.current = undefined;
      updateFilters(next);
    };
    const filtersActions: TracesFiltersActions = {
      // Re-inject the scope tokens so "Clear filters" (which drops every removable item) and any
      // other edit can never drop the scope.
      setFilterTokens: (tokens, groups) => {
        const { filters: base, scopedFieldIds: scoped } = latest.current;
        const scopeTokens = base.tokens.filter(token => scoped.has(token.fieldId));
        updateFilters(applyFilterTokens(base, [...scopeTokens, ...tokens], groups));
      },
      setDatePreset: preset => pickRange(applyDatePreset(latest.current.filters, preset)),
      setDate: (value, end) => pickRange(applyDate(latest.current.filters, value, end)),
      setDateRange: (from, to) => pickRange(applyDateRange(latest.current.filters, from, to)),
      zoomDateRange: (from, to) => {
        const base = latest.current.filters;
        zoomMemory.current = rememberZoom(zoomMemory.current, base, from, to);
        updateFilters({ ...base, datePreset: 'custom', dateFrom: from, dateTo: to });
      },
      resetDateRange: defaultPreset => {
        const base = latest.current.filters;
        const before = rangeBeforeZoom(zoomMemory.current, base);
        zoomMemory.current = undefined;
        updateFilters({
          tokens: base.tokens,
          groups: base.groups,
          ...(before ?? { datePreset: defaultPreset }),
        });
      },
    };
    const onSortChange = (next: TracesSort) => latest.current.onSortChange(next);
    const setColumns = (next: TraceColumnPreferences) => latest.current.onColumnsChange(next);
    return { selectionActions, filtersActions, onSortChange, setColumns };
  }, []);
  const { selectionActions, filtersActions, onSortChange, setColumns } = actions;

  const listId = tracesListIdForScope(scope);
  // Keyed on its fields, so a host handing a fresh discovery object each render doesn't re-render every part.
  const { fields: discoveryFields, canonicalFields, isLoading: isDiscoveryLoading } = discovery;
  const hasFeedbackOptions = feedbackOptions !== undefined;
  const { contextMode, feedbackUserId, allowDelete, allowReview } = feedbackOptions ?? {};
  const configValue = useMemo<TracesConfigContextValue>(
    () => ({
      withQueryTrace,
      withTokenSearch,
      withFeedback,
      withSpanQuery,
      withThreadQuery,
      withRootDuration,
      withOutcomeFields,
      withTimeToFirstChunk,
      withTimeToFirstChunkSort,
      withTimeToFirstToken,
      withTimeToFirstTokenSort,
      withDiscovery,
      withTraceAggregate,
      isCapabilitiesLoading,
      listId,
      rootSource,
      scopedFieldIds,
      hiddenFieldIds,
      feedbackOptions: hasFeedbackOptions ? { contextMode, feedbackUserId, allowDelete, allowReview } : undefined,
      metricsSupport,
      discovery: { fields: discoveryFields, canonicalFields, isLoading: isDiscoveryLoading },
    }),
    [
      withQueryTrace,
      withTokenSearch,
      withFeedback,
      withSpanQuery,
      withThreadQuery,
      withRootDuration,
      withOutcomeFields,
      withTimeToFirstChunk,
      withTimeToFirstChunkSort,
      withTimeToFirstToken,
      withTimeToFirstTokenSort,
      withDiscovery,
      withTraceAggregate,
      isCapabilitiesLoading,
      listId,
      rootSource,
      scopedFieldIds,
      hiddenFieldIds,
      hasFeedbackOptions,
      contextMode,
      feedbackUserId,
      allowDelete,
      allowReview,
      metricsSupport,
      discoveryFields,
      canonicalFields,
      isDiscoveryLoading,
    ],
  );

  const tokenSearchApplied = withTokenSearch && [...filters.tokens, ...filters.groups].some(hasTokenSearchFilter);
  const contentFiltersApplied = filters.tokens.length > 0 || filters.groups.length > 0;
  const filtersApplied = contentFiltersApplied || filters.datePreset !== initialFilters.datePreset || !!dateTo;
  const runningSelected = useMemo(() => selectsRunningStatus(rawFilters), [rawFilters]);
  const filtersValue = useMemo<TracesFiltersContextValue>(
    () => ({
      ...filtersActions,
      filters,
      hasTokenSearch: tokenSearchApplied,
      dateFrom,
      dateTo,
      filtersApplied,
      contentFiltersApplied,
      runningSelected,
    }),
    [
      filtersActions,
      filters,
      tokenSearchApplied,
      dateFrom,
      dateTo,
      filtersApplied,
      contentFiltersApplied,
      runningSelected,
    ],
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
          <TracesColumnsProvider
            preferences={columns}
            setPreferences={setColumns}
            defaults={TRACE_COLUMN_CATALOGS.traces.defaults}
          >
            <TracesListProvider traces={traces} sort={sort} onSortChange={onSortChange}>
              {children}
            </TracesListProvider>
          </TracesColumnsProvider>
        </TracesSelectionContext.Provider>
      </TracesFiltersContext.Provider>
    </TracesConfigContext.Provider>
  );
}
