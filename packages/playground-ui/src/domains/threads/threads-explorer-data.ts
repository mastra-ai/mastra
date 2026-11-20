import type { GetObservabilityCapabilitiesResponse } from '@mastra/client-js';
import type { TraceQueryScalarPredicate } from '@mastra/core/storage';
import type { ThreadQueryArgs, ThreadRow } from '@mastra/react/hooks/traces';
import type { ObservabilityListFiltersState } from '@/domains/observability/hooks/use-observability-list-filters';
import type { TraceColumnPreferences } from '@/domains/traces/trace-list-columns';
import { withoutUnrecordedStreamingColumns } from '@/domains/traces/trace-list-columns';
import type { FilterBarField } from '@/ds/components/FilterBar';

/**
 * The data the threads explorer draws. The explorer never fetches: the host loads each piece (Studio:
 * `useThreadsSupport`, `useThreadsListQuery`, `useThreadsFilterBarFields`; an MCP app: its own tools)
 * and passes it down.
 */

/** What the store can do for the threads list. */
export type ThreadsExplorerSupport = {
  isLoading: boolean;
  /** The store lists threads (`queryTraceThreads()`). */
  withQuery: boolean;
  withTimeToFirstChunk: boolean;
  withTimeToFirstToken: boolean;
};

export type ThreadsExplorerThreads = {
  threads: readonly ThreadRow[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  isError: boolean;
  error?: unknown;
  /** Called when the end of the list scrolls into view and `hasNextPage` is set. */
  onLoadMore: () => void;
};

/** The filter bar's fields: the time range plus the fields `queryTraceThreads()` accepts. */
export type ThreadsExplorerFilterFields = FilterBarField[];

export function resolveThreadsSupport({
  data,
  isLoading,
}: {
  data?: GetObservabilityCapabilitiesResponse;
  isLoading: boolean;
}): ThreadsExplorerSupport {
  const capabilities = data?.capabilities;
  return {
    isLoading,
    withQuery: !isLoading && (capabilities?.threadQueryRows ?? false),
    withTimeToFirstChunk: capabilities?.traceQueryTimeToFirstChunk ?? false,
    withTimeToFirstToken: capabilities?.traceQueryTimeToFirstToken ?? false,
  };
}

/** Stored columns the store can't fill stay saved but aren't drawn, so they come back on a store that can. */
export function threadsDisplayedColumns(
  preferences: TraceColumnPreferences,
  support: ThreadsExplorerSupport,
): TraceColumnPreferences {
  return support.isLoading ? preferences : withoutUnrecordedStreamingColumns(preferences, support);
}

/** Threads with trace activity in the window, like the traces list for the same chip. Threads sort on start time only. */
export function buildThreadsListQuery(
  timeRange: ObservabilityListFiltersState['timeRange'],
  direction: 'asc' | 'desc',
  where: TraceQueryScalarPredicate | undefined,
): ThreadQueryArgs {
  return {
    timeRange: { traces: timeRange },
    orderBy: [{ field: 'startedAt', direction }],
    ...(where ? { where } : {}),
  };
}
