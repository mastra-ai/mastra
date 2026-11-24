import { createContext, useContext } from 'react';
import type { TraceColumnPreferences } from '../../trace-list-columns';
import type { SpanTab, TraceDatePreset } from '../../types';
import type { FeedbackOptions } from '../feedback-options';
import type { TraceSpanView } from '../trace-panel';
import type { TracesListViewTrace } from '../traces-list-view';
import type { TracesFilters, TracesSelection, TracesSort } from './traces-explorer-actions';
import type { TracesExplorerDiscovery } from './traces-explorer-data';
import { resolveTraceUsageColumns } from './traces-explorer-support';
import type {
  TraceUsageColumns,
  TracesMetricsSupport,
  TracesRootSource,
  TracesSupport,
} from './traces-explorer-support';

export type {
  TracesExplorerFeatures,
  TracesExplorerScope,
  TracesMetricsSupport,
  TraceUsageColumns,
} from './traces-explorer-support';
export { CHECKING_USAGE_REASON, UNSUPPORTED_USAGE_REASON } from './traces-explorer-support';

/** The resolved support flags the parts read. Delta polling is the list query's concern, so only the host's hook reads it. */
export type TracesConfigContextValue = Omit<TracesSupport, 'withDeltaPolling'> & {
  listId: string;
  rootSource?: TracesRootSource;
  scopedFieldIds: ReadonlySet<string>;
  hiddenFieldIds: readonly string[];
  feedbackOptions?: FeedbackOptions;
  metricsSupport: TracesMetricsSupport;
  /** The metadata fields observed in the explorer's window, shared by the filter bar and the columns menu. */
  discovery: TracesExplorerDiscovery;
};

export type TracesFiltersActions = {
  /** Replaces the filter tokens and groups. The scope tokens are always kept. */
  setFilterTokens: (tokens: TracesFilters['tokens'], groups: TracesFilters['groups']) => void;
  setDatePreset: (preset: TraceDatePreset) => void;
  setDate: (value: Date | undefined, end: 'from' | 'to') => void;
  setDateRange: (from: Date | undefined, to: Date | undefined) => void;
  /** Narrows the range to a histogram selection, remembering the range to return to on reset. */
  zoomDateRange: (from: Date, to: Date) => void;
  /** Undoes the last histogram zoom, or switches to `defaultPreset` when there is none to undo. */
  resetDateRange: (defaultPreset: TraceDatePreset) => void;
};

export type TracesFiltersContextValue = TracesFiltersActions & {
  /** The host's filters with the entries this server can't query dropped. */
  filters: TracesFilters;
  hasTokenSearch: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  filtersApplied: boolean;
  contentFiltersApplied: boolean;
  /** The host's filters ask for `running` traces, which `filters` (and so the query) can't express. */
  runningSelected: boolean;
};

export type TracesSelectionActions = {
  selectTrace: (traceId: string) => void;
  closeTrace: () => void;
  selectSpan: (spanId: string | null) => void;
  setSpanTab: (tab: SpanTab) => void;
  setSpanView: (view: TraceSpanView) => void;
  selectScore: (scoreId: string | null) => void;
  highlightSpans: (spanIds: string[]) => void;
};

export type TracesSelectionContextValue = TracesSelectionActions & {
  selection: TracesSelection;
  selectedTraceId?: string;
};

export type TracesListContextValue = {
  rows: TracesListViewTrace[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  error?: Error;
  onLoadMore: () => void;
  onRetry: () => void;
  /** The order the list runs (the host's sort, unless the store can't run it). */
  sort: TracesSort;
  onSortChange: (next: TracesSort) => void;
};

/** The host's column selection, and the writers its pickers (and saved views) call. */
export type TracesColumnsContextValue = {
  preferences: TraceColumnPreferences;
  setPreferences: (next: TraceColumnPreferences) => void;
  /** Back to the list's default columns. */
  resetColumns: () => void;
};

export const TracesConfigContext = createContext<TracesConfigContextValue | null>(null);
export const TracesFiltersContext = createContext<TracesFiltersContextValue | null>(null);
export const TracesSelectionContext = createContext<TracesSelectionContextValue | null>(null);
export const TracesListContext = createContext<TracesListContextValue | null>(null);
/** Kept out of `TracesListContext` so a poll tick doesn't re-render every list consumer. */
export const TracesListFetchingContext = createContext<boolean | null>(null);
export const TracesColumnsContext = createContext<TracesColumnsContextValue | null>(null);

const useRequired = <T>(context: React.Context<T | null>, name: string): T => {
  const value = useContext(context);
  if (!value) throw new Error(`${name} must be used inside <TracesExplorer>`);
  return value;
};

export const useTracesConfig = () => useRequired(TracesConfigContext, 'useTracesConfig');
export const useTracesFilters = () => useRequired(TracesFiltersContext, 'useTracesFilters');
export const useTracesSelection = () => useRequired(TracesSelectionContext, 'useTracesSelection');
export const useTracesList = () => useRequired(TracesListContext, 'useTracesList');
/** Whether the list is fetching, including background refetches and retries. */
export const useTracesListFetching = () => {
  const value = useContext(TracesListFetchingContext);
  if (value === null) throw new Error('useTracesListFetching must be used inside <TracesExplorer>');
  return value;
};
export const useTracesColumns = () => useRequired(TracesColumnsContext, 'useTracesColumns');

export const useTraceUsageColumns = (): TraceUsageColumns => {
  const { preferences } = useTracesColumns();
  const { metricsSupport, withTimeToFirstChunk, withTimeToFirstToken, isCapabilitiesLoading } = useTracesConfig();
  return resolveTraceUsageColumns(preferences, metricsSupport, {
    withTimeToFirstChunk,
    withTimeToFirstToken,
    isCapabilitiesLoading,
  });
};
