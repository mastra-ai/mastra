import { useEffect } from 'react';
import { TracesListView } from '../traces-list-view';
import type { TracesListViewTrace } from '../traces-list-view';
import type { TracesSortField } from './traces-explorer-actions';
import {
  useTraceUsageColumns,
  useTracesConfig,
  useTracesFilters,
  useTracesList,
  useTracesListFetching,
  useTracesSelection,
} from './traces-explorer-context';
import type { TracesExplorerUsage } from './traces-explorer-data';
import { useTracesFilterBar } from './use-traces-filter-bar';
import { useInView } from '@/hooks/use-in-view';

export type TracesExplorerListProps = {
  /** Token and estimated-cost totals by trace id, for the usage columns (Studio: `useTracesUsageQuery`). */
  usage?: TracesExplorerUsage;
};

export function TracesExplorerList({ usage }: TracesExplorerListProps) {
  const { listId, withTimeToFirstChunkSort, withTimeToFirstTokenSort } = useTracesConfig();
  const { rows, isLoading, isFetchingNextPage, hasNextPage, sort, onSortChange } = useTracesList();
  const { filtersApplied } = useTracesFilters();
  const { onFilterByField } = useTracesFilterBar();
  const { selectedTraceId, selectTrace, closeTrace } = useTracesSelection();
  const { displayedPreferences } = useTraceUsageColumns();
  const { inView, setRef: setEndOfListElement } = useInView();
  const sortableFields: TracesSortField[] = ['startedAt'];
  if (withTimeToFirstChunkSort) sortableFields.push('timeToFirstChunkMs');
  if (withTimeToFirstTokenSort) sortableFields.push('timeToFirstTokenMs');

  // Clicking the open row closes it; any other row opens.
  const handleTraceClick = (trace: TracesListViewTrace) => {
    if (trace.traceId === selectedTraceId) closeTrace();
    else selectTrace(trace.traceId);
  };

  return (
    <>
      <TracesListView
        listId={listId}
        traces={rows}
        isLoading={isLoading}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        setEndOfListElement={setEndOfListElement}
        filtersApplied={filtersApplied}
        featuredTraceId={selectedTraceId}
        columnPreferences={displayedPreferences}
        usageByTraceId={usage}
        sort={sort}
        sortableFields={sortableFields}
        onSortChange={onSortChange}
        onFilterByField={onFilterByField}
        onTraceClick={handleTraceClick}
      />
      <LoadMoreWhenInView inView={inView} />
    </>
  );
}

/**
 * Asks the host for the next page while the end of the list is in view, the list has one, and no
 * request is in flight. Its own component so a fetch flip re-renders it alone, not the list.
 */
function LoadMoreWhenInView({ inView }: { inView: boolean }) {
  const { hasNextPage, error, onLoadMore } = useTracesList();
  const isFetching = useTracesListFetching();
  const shouldLoad = inView && hasNextPage && !isFetching && !error;
  useEffect(() => {
    if (shouldLoad) onLoadMore();
  }, [shouldLoad, onLoadMore]);
  return null;
}
