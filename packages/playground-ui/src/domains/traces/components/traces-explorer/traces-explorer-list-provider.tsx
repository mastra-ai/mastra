import { memo, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useTracesListSource } from '../../hooks/use-traces-list-source';
import { hasTraceColumn } from '../../trace-list-columns';
import { buildTracesLegacyFilters, buildTracesQueryRequest, DEFAULT_TRACES_SORT } from './traces-explorer-actions';
import type { TracesSort } from './traces-explorer-actions';
import {
  TracesListContext,
  TracesListFetchingContext,
  useTraceUsageColumns,
  useTracesConfig,
  useTracesFilters,
} from './traces-explorer-context';
import type { TracesListContextValue } from './traces-explorer-context';
import { hasWordSearch, searchesInChunks } from '@/domains/observability/lib/progressive-search';

const NOOP = () => {};

type TracesListProviderProps = {
  sort: TracesSort;
  onSortChange: (next: TracesSort) => void;
  children: ReactNode;
};

/**
 * Owns the list query and its poll clock. Its own memoized component so a poll tick re-renders
 * only list consumers, and a selection change doesn't re-run the list query hooks.
 */
export const TracesListProvider = memo(function TracesListProvider({
  sort: hostSort,
  onSortChange,
  children,
}: TracesListProviderProps) {
  const {
    rootSource,
    withQueryTrace,
    withTokenSearch,
    withRootDuration,
    withTimeToFirstChunk,
    withTimeToFirstToken,
    withTimeToFirstChunkSort,
    withTimeToFirstTokenSort,
    withOutcomeFields,
    withDeltaPolling,
    withProgressiveSearch,
    isCapabilitiesLoading,
  } = useTracesConfig();
  const { filters, hasTokenSearch, dateFrom, dateTo } = useTracesFilters();
  const { displayedPreferences } = useTraceUsageColumns();
  // A TTFC/TTFT sort the store can't run, or on a column that isn't shown, lists newest first instead.
  // The host keeps its raw value, like filters the server can't query.
  const sortable =
    hostSort.field === 'startedAt' ||
    (hostSort.field === 'timeToFirstChunkMs' &&
      withTimeToFirstChunkSort &&
      hasTraceColumn(displayedPreferences, 'timeToFirstChunk')) ||
    (hostSort.field === 'timeToFirstTokenMs' &&
      withTimeToFirstTokenSort &&
      hasTraceColumn(displayedPreferences, 'timeToFirstToken'));
  const sort = sortable ? hostSort : DEFAULT_TRACES_SORT;
  const list = useTracesListSource({
    rolling: !dateTo,
    query: now => {
      const query = buildTracesQueryRequest({
        filters,
        dateFrom,
        dateTo,
        withTokenSearch,
        withRootDuration,
        withTimeToFirstChunk,
        withTimeToFirstToken,
        withOutcomeFields,
        now,
      });
      // A word search over more than 7 days loads one chunk of the range at a time, when the server can.
      const progressive = withProgressiveSearch && hasWordSearch(query.where) && searchesInChunks(query.timeRange);
      return {
        ...query,
        ...(rootSource === 'aggregated' ? { rootSource } : {}),
        ...(progressive ? { progressive: true as const } : {}),
      };
    },
    orderBy: [sort],
    // An explicit projection must never fall back to the legacy list endpoint.
    withQueryTrace: rootSource === 'aggregated' || withQueryTrace,
    withDeltaPolling: !hasTokenSearch && rootSource !== 'aggregated' && withDeltaPolling,
    enabled: !isCapabilitiesLoading,
    legacyFilters: buildTracesLegacyFilters({ filters, dateFrom, dateTo }),
  });

  const {
    rows,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    setEndOfListElement,
    error,
    refetch,
    isFetching,
    autoRefetch,
    progressive,
    timeRange,
  } = list;
  // The progress fields follow the query key, which a rolling tick moves: outside a progressive search they stay
  // fixed so a tick doesn't re-render every list consumer.
  const searchedRange = progressive ? list.searchedRange : undefined;
  const searching = progressive && list.searching;
  const stopped = progressive && list.stopped;
  const chunkError = progressive ? list.chunkError : null;
  const stop = progressive ? list.stop : NOOP;
  const fetchNextPage = progressive ? list.fetchNextPage : NOOP;
  const value = useMemo<TracesListContextValue>(
    () => ({
      rows,
      isLoading,
      isFetchingNextPage,
      hasNextPage,
      setEndOfListElement,
      error,
      refetch,
      autoRefetch,
      progressive,
      searchedRange,
      searching,
      stopped,
      stop,
      chunkError,
      fetchNextPage,
      timeRange,
      sort,
      onSortChange,
    }),
    [
      rows,
      isLoading,
      isFetchingNextPage,
      hasNextPage,
      setEndOfListElement,
      error,
      refetch,
      autoRefetch,
      progressive,
      searchedRange,
      searching,
      stopped,
      stop,
      chunkError,
      fetchNextPage,
      timeRange,
      sort,
      onSortChange,
    ],
  );

  return (
    <TracesListContext.Provider value={value}>
      <TracesListFetchingContext.Provider value={isFetching}>{children}</TracesListFetchingContext.Provider>
    </TracesListContext.Provider>
  );
});
