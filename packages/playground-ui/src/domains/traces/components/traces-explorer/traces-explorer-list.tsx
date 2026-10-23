import { useTraceUsage } from '@mastra/react/hooks/traces';
import { TracesListView } from '../traces-list-view';
import type { TracesListViewTrace } from '../traces-list-view';
import {
  useTraceUsageColumns,
  useTracesColumns,
  useTracesConfig,
  useTracesFilters,
  useTracesList,
  useTracesSelection,
} from './traces-explorer-context';
import { useTracesFilterBar } from './use-traces-filter-bar';

export function TracesExplorerList() {
  const { listId } = useTracesConfig();
  const {
    rows,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    setEndOfListElement,
    autoRefetch,
    sortDirection,
    onSortChange,
  } = useTracesList();
  const { filtersApplied } = useTracesFilters();
  const { onFilterByField } = useTracesFilterBar();
  const { selectedTraceId, selectTrace, closeTrace } = useTracesSelection();
  const { displayedPreferences, usageEnabled } = useTraceUsageColumns();
  const { order, onOrderChange } = useTracesColumns();

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
      columnOrder={order}
      onColumnOrderChange={onOrderChange}
      traces={rows}
      isLoading={isLoading}
      isFetchingNextPage={isFetchingNextPage}
      hasNextPage={hasNextPage}
      setEndOfListElement={setEndOfListElement}
      filtersApplied={filtersApplied}
      featuredTraceId={selectedTraceId}
      columnPreferences={displayedPreferences}
      usageByTraceId={usageByTraceId}
      createdSort={sortDirection}
      onSortChange={onSortChange}
      onFilterByField={onFilterByField}
      onTraceClick={handleTraceClick}
    />
  );
}
