import type { ThreadQueryArgs, ThreadRow } from '@mastra/react/hooks/traces';
import { useCallback, useMemo, useRef } from 'react';
import { buildThreadQueryWhere } from '../thread-filters';
import { buildThreadsListQuery, resolveThreadsSupport } from '../threads-explorer-data';
import type { ThreadsExplorerSupport, ThreadsExplorerThreads } from '../threads-explorer-data';
import { useThreadsFilterBarFields } from './use-threads-filter-bar';
import { useThreadsListSource } from './use-threads-list-source';
import { useObservabilityCapabilities } from '@/domains/capabilities';
import { useObservabilityListFilters } from '@/domains/observability/hooks/use-observability-list-filters';
import type { ObservabilityListUrlState } from '@/domains/observability/hooks/use-observability-list-filters';
import { useTraceColumnPreferences } from '@/domains/traces/hooks/use-trace-column-preferences';

const NO_THREADS: readonly ThreadRow[] = [];

/** Studio's capabilities, read for the threads list. */
export function useThreadsSupport(): ThreadsExplorerSupport {
  const { data, isLoading } = useObservabilityCapabilities();
  return useMemo(() => resolveThreadsSupport({ data, isLoading }), [data, isLoading]);
}

export type UseThreadsListQueryArgs = {
  query: ThreadQueryArgs;
  /** The window ends at "now": only then can new threads show up. */
  rolling: boolean;
  /** The user picked the start: polls and reloads keep it rather than sliding it. */
  fixedStart?: boolean;
  enabled?: boolean;
};

/** Studio's threads list, through the Mastra client, polled for new threads. Pass it as the explorer's `threads`. */
export function useThreadsListQuery({
  query,
  rolling,
  fixedStart,
  enabled,
}: UseThreadsListQueryArgs): ThreadsExplorerThreads {
  const list = useThreadsListSource({ query, rolling, fixedStart, enabled });

  // The list hands back a new `fetchNextPage` every render; keep `onLoadMore` stable for the list's effect.
  const fetchNextPage = useRef(list.fetchNextPage);
  fetchNextPage.current = list.fetchNextPage;
  const onLoadMore = useCallback(() => fetchNextPage.current(), []);

  return {
    threads: list.threads ?? NO_THREADS,
    isLoading: list.isLoading,
    isFetchingNextPage: list.isFetchingNextPage,
    hasNextPage: list.hasNextPage,
    isError: list.isError,
    error: list.error ?? undefined,
    onLoadMore,
  };
}

/**
 * Everything Studio's threads explorer draws, through the Mastra client: capabilities, the URL-backed
 * filters, stored columns, the list and the filter bar's fields. Spread the result into
 * `ThreadsExplorerBody`. Another host (e.g. an MCP app) builds the same props from its own data.
 */
export function useThreadsExplorer(urlState?: ObservabilityListUrlState) {
  const support = useThreadsSupport();
  const filters = useObservabilityListFilters(urlState);
  const columns = useTraceColumnPreferences({ scope: 'threads' });
  const { timeRange, tokens, groups, sort } = filters;

  const query = useMemo(
    () => buildThreadsListQuery(timeRange, sort.direction, buildThreadQueryWhere(tokens, groups, support)),
    [timeRange, sort.direction, tokens, groups, support],
  );
  const threads = useThreadsListQuery({
    query,
    rolling: filters.rolling,
    fixedStart: filters.datePreset === 'custom',
  });
  const filterFields = useThreadsFilterBarFields();

  return { support, filters, columns, threads, filterFields, urlState };
}
