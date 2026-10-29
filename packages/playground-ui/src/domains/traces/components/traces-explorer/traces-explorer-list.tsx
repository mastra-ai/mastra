import { useTraceUsage } from '@mastra/react/hooks/traces';
import { TracesListView } from '../traces-list-view';
import type { TracesListViewTrace } from '../traces-list-view';
import {
  useTraceUsageColumns,
  useTracesConfig,
  useTracesFilters,
  useTracesList,
  useTracesSelection,
} from './traces-explorer-context';
import { useTracesFilterBar } from './use-traces-filter-bar';

export function TracesExplorerList() {
  const { listId, withTimeToFirstChunkSort } = useTracesConfig();
  const { rows, isLoading, isFetchingNextPage, hasNextPage, setEndOfListElement, autoRefetch, sort, onSortChange } =
    useTracesList();
  const { filtersApplied } = useTracesFilters();
  const { onFilterByField } = useTracesFilterBar();
  const { selectedTraceId, selectTrace, closeTrace } = useTracesSelection();
  const { displayedPreferences, usageEnabled } = useTraceUsageColumns();

  const { data: usageByTraceId } = useTraceUsage({
    traceIds: rows.map(row => row.traceId),
    enabled: usageEnabled,
    autoRefetch,
  });

  // Clicking the open row closes it; any other row opens.
  const handleTraceClick = (trace: TracesListViewTrace) => {
    if (trace.traceId === selectedTraceId) closeTrace();
    else selectTrace(trace.traceId);
  };

  return (
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
      usageByTraceId={usageByTraceId}
      createdSort={sort.field === 'startedAt' ? sort.direction : undefined}
      onSortChange={direction => onSortChange({ field: 'startedAt', direction })}
      timeToFirstChunkSort={sort.field === 'timeToFirstChunkMs' ? sort.direction : undefined}
      onTimeToFirstChunkSortChange={
        withTimeToFirstChunkSort ? direction => onSortChange({ field: 'timeToFirstChunkMs', direction }) : undefined
      }
      onFilterByField={onFilterByField}
      onTraceClick={handleTraceClick}
    />
  );
}
