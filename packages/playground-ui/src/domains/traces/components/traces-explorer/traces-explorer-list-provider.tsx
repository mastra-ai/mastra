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
  const { withQueryTrace, withRootDuration, withTimeToFirstChunkSort, withDeltaPolling, isCapabilitiesLoading } =
    useTracesConfig();
  const { filters, dateFrom, dateTo } = useTracesFilters();
  const { displayedPreferences } = useTraceUsageColumns();
  // A TTFC sort the store can't run, or on a column that isn't shown, lists newest first instead.
  // The host keeps its raw value, like filters the server can't query.
  const sortable =
    hostSort.field !== 'timeToFirstChunkMs' ||
    (withTimeToFirstChunkSort && hasTraceColumn(displayedPreferences, 'timeToFirstChunk'));
  const sort = sortable ? hostSort : DEFAULT_TRACES_SORT;
  const list = useTracesListSource({
    rolling: !dateTo,
    query: now => buildTracesQueryRequest({ filters, dateFrom, dateTo, withRootDuration, now }),
    orderBy: [sort],
    withQueryTrace,
    withDeltaPolling,
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
  } = list;
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
