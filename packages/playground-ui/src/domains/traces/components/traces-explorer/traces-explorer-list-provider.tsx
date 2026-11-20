import { memo, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { TracesSort } from './traces-explorer-actions';
import {
  TracesListContext,
  TracesListFetchingContext,
  useTraceUsageColumns,
  useTracesConfig,
} from './traces-explorer-context';
import type { TracesListContextValue } from './traces-explorer-context';
import type { TracesExplorerTraces } from './traces-explorer-data';
import { resolveTracesSort } from './traces-explorer-support';

type TracesListProviderProps = {
  traces: TracesExplorerTraces;
  sort: TracesSort;
  onSortChange: (next: TracesSort) => void;
  children: ReactNode;
};

/**
 * Hands the host's list to the parts. Its own memoized component so a background fetch re-renders
 * only list consumers, and a selection change doesn't hand them a fresh value.
 */
export const TracesListProvider = memo(function TracesListProvider({
  traces,
  sort: hostSort,
  onSortChange,
  children,
}: TracesListProviderProps) {
  const { withTimeToFirstChunkSort, withTimeToFirstTokenSort } = useTracesConfig();
  const { displayedPreferences } = useTraceUsageColumns();
  const sort = resolveTracesSort(
    hostSort,
    { withTimeToFirstChunkSort, withTimeToFirstTokenSort },
    displayedPreferences,
  );

  const { rows, isLoading, isFetchingNextPage, hasNextPage, error, onLoadMore, onRetry, isFetching } = traces;
  const value = useMemo<TracesListContextValue>(
    () => ({ rows, isLoading, isFetchingNextPage, hasNextPage, error, onLoadMore, onRetry, sort, onSortChange }),
    [rows, isLoading, isFetchingNextPage, hasNextPage, error, onLoadMore, onRetry, sort, onSortChange],
  );

  return (
    <TracesListContext.Provider value={value}>
      <TracesListFetchingContext.Provider value={isFetching}>{children}</TracesListFetchingContext.Provider>
    </TracesListContext.Provider>
  );
});
