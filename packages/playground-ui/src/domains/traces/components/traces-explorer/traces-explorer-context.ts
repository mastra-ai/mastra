import type { EntityType } from '@mastra/core/observability';
import type { TraceQueryDiscoveryTimeRange } from '@mastra/react/hooks/traces';
import { createContext, useContext } from 'react';
import type { useTraceColumnPreferences } from '../../hooks/use-trace-column-preferences';
import type { useTracesListSource } from '../../hooks/use-traces-list-source';
import { hasTraceUsageColumn, isTraceUsageColumn } from '../../trace-list-columns';
import type { TraceColumnPreferences } from '../../trace-list-columns';
import type { SpanTab, TraceDatePreset } from '../../types';
import type { TraceSpanView } from '../trace-data-panel-view';
import type { TracesFilters, TracesSelection, TracesSort } from './traces-explorer-actions';

export type TracesExplorerScope = { entityId: string; entityType?: EntityType };

export type TracesMetricsSupport = { supported: boolean; isLoading: boolean };

/**
 * Host switches (e.g. feature flags), combined with what the server supports.
 * `traceQuery` and `feedback` default to on and can only turn their feature off.
 * `spanQuery` and `threadQuery` default to off: each view is offered only when its flag is `true`
 * and the server supports it.
 */
export type TracesExplorerFeatures = {
  traceQuery?: boolean;
  feedback?: boolean;
  spanQuery?: boolean;
  threadQuery?: boolean;
};

export type TracesConfigContextValue = {
  listId: string;
  scopedFieldIds: ReadonlySet<string>;
  hiddenFieldIds: readonly string[];
  withQueryTrace: boolean;
  withFeedback: boolean;
  /** The span query API is on, so the host can offer a spans view next to the traces list. */
  withSpanQuery: boolean;
  /** The thread rows API is on, so the host can offer a threads view next to the traces list. */
  withThreadQuery: boolean;
  withRootDuration: boolean;
  /** Trace rows carry the root span's time to first chunk, so the TTFC column can be shown. */
  withTimeToFirstChunk: boolean;
  /** Trace queries can be ordered by the root span's time to first chunk. */
  withTimeToFirstChunkSort: boolean;
  /** The server supports delta polling, so auto-refresh merges new traces instead of reloading pages. */
  withDeltaPolling: boolean;
  /** Whether field discovery should run: the server supports it and the trace query API is on. */
  withDiscovery: boolean;
  isCapabilitiesLoading: boolean;
  metricsSupport: TracesMetricsSupport;
  /** Shared by every discovery consumer so they hit the same cached query. */
  discoveryTimeRange: TraceQueryDiscoveryTimeRange;
};

export type TracesFiltersActions = {
  /** Replaces the filter tokens and groups. The scope tokens are always kept. */
  setFilterTokens: (tokens: TracesFilters['tokens'], groups: TracesFilters['groups']) => void;
  setDatePreset: (preset: TraceDatePreset) => void;
  setDate: (value: Date | undefined, end: 'from' | 'to') => void;
  setDateRange: (from: Date | undefined, to: Date | undefined) => void;
};

export type TracesFiltersContextValue = TracesFiltersActions & {
  /** The host's filters with the entries this server can't query dropped. */
  filters: TracesFilters;
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

type ListSource = ReturnType<typeof useTracesListSource>;

export type TracesListContextValue = Pick<
  ListSource,
  | 'rows'
  | 'isLoading'
  | 'isFetchingNextPage'
  | 'hasNextPage'
  | 'setEndOfListElement'
  | 'error'
  | 'refetch'
  | 'autoRefetch'
> & {
  sort: TracesSort;
  onSortChange: (next: TracesSort) => void;
};

export type TracesColumnsContextValue = ReturnType<typeof useTraceColumnPreferences>;

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
/** Whether the list query is fetching, including background refetches and retries. */
export const useTracesListFetching = () => {
  const value = useContext(TracesListFetchingContext);
  if (value === null) throw new Error('useTracesListFetching must be used inside <TracesExplorer>');
  return value;
};
export const useTracesColumns = () => useRequired(TracesColumnsContext, 'useTracesColumns');

export const CHECKING_USAGE_REASON = 'Checking whether this storage supports usage data.';
export const UNSUPPORTED_USAGE_REASON = 'This observability store does not support token and cost metrics.';

export type TraceUsageColumns = {
  /** Column preferences without the columns the store can't serve (usage, time to first chunk). */
  displayedPreferences: TraceColumnPreferences;
  /** Whether usage should be fetched: metrics are supported and a usage column is visible. */
  usageEnabled: boolean;
  usageDisabledReason?: string;
};

export const useTraceUsageColumns = (): TraceUsageColumns => {
  const { preferences } = useTracesColumns();
  const { metricsSupport, withTimeToFirstChunk, isCapabilitiesLoading } = useTracesConfig();
  const unavailable = !metricsSupport.isLoading && !metricsSupport.supported;
  const timeToFirstChunkUnavailable = !isCapabilitiesLoading && !withTimeToFirstChunk;
  const displayedPreferences =
    unavailable || timeToFirstChunkUnavailable
      ? {
          ...preferences,
          visibleColumns: preferences.visibleColumns.filter(
            column =>
              !(unavailable && isTraceUsageColumn(column)) &&
              !(timeToFirstChunkUnavailable && column === 'timeToFirstChunk'),
          ),
        }
      : preferences;
  return {
    displayedPreferences,
    usageEnabled: !unavailable && !metricsSupport.isLoading && hasTraceUsageColumn(displayedPreferences),
    usageDisabledReason: metricsSupport.isLoading
      ? CHECKING_USAGE_REASON
      : !metricsSupport.supported
        ? UNSUPPORTED_USAGE_REASON
        : undefined,
  };
};
