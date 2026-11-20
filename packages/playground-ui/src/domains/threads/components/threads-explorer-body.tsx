import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { threadToListRow } from '../thread-list-row';
import { threadsDisplayedColumns } from '../threads-explorer-data';
import type {
  ThreadsExplorerFilterFields,
  ThreadsExplorerSupport,
  ThreadsExplorerThreads,
} from '../threads-explorer-data';
import { ThreadsFilterBar } from './threads-filter-bar';
import { LoadMoreWhenInView } from '@/domains/observability/components/load-more-when-in-view';
import { ObservabilityListBody } from '@/domains/observability/components/observability-list-body';
import type {
  ObservabilityListFiltersState,
  ObservabilityListUrlState,
} from '@/domains/observability/hooks/use-observability-list-filters';
import { ObservabilitySavedViews } from '@/domains/observability/saved-views';
import type { SavedViewColumnsControl } from '@/domains/observability/saved-views';
import { ColumnsMenu } from '@/domains/traces/components/columns-menu';
import { NoTracesInfo } from '@/domains/traces/components/no-traces-info';
import { TracesErrorContent } from '@/domains/traces/components/traces-error-content';
import { TracesListView } from '@/domains/traces/components/traces-list-view';
import type { TracesListViewTrace } from '@/domains/traces/components/traces-list-view';
import { ActionRow } from '@/ds/components/ActionRow';
import { useInView } from '@/hooks/use-in-view';

export type ThreadsExplorerPanelArgs = {
  /** The open thread, if any. */
  threadId: string | undefined;
  onClose: () => void;
};

export type ThreadsExplorerBodyProps = {
  /** What the store can do (Studio: `useThreadsSupport`). */
  support: ThreadsExplorerSupport;
  /** The list's time range, filters and sort (`useObservabilityListFilters`). */
  filters: ObservabilityListFiltersState;
  /** The stored column selection. */
  columns: SavedViewColumnsControl;
  /** The loaded threads (Studio: `useThreadsListQuery`). */
  threads: ThreadsExplorerThreads;
  /** The filter bar's fields (Studio: `useThreadsFilterBarFields`). */
  filterFields: ThreadsExplorerFilterFields;
  /** The open thread. The host keeps it (e.g. in the URL) so it survives a reload. */
  selectedThreadId: string | undefined;
  onSelectedThreadChange: (threadId: string | undefined) => void;
  /** Renders the open thread in the host's own drawer (Studio: `TraceThreadPanel`). */
  renderPanel: (args: ThreadsExplorerPanelArgs) => ReactNode;
  /** The host's search params, for saved views. Omitted: no saved views. */
  urlState?: ObservabilityListUrlState;
};

/** The threads page body: filter bar, thread list and the host's thread drawer. Never fetches. */
export function ThreadsExplorerBody({
  support,
  filters,
  columns,
  threads,
  filterFields,
  selectedThreadId,
  onSelectedThreadChange,
  renderPanel,
  urlState,
}: ThreadsExplorerBodyProps) {
  const displayedColumns = threadsDisplayedColumns(columns.preferences, support);
  const { inView, setRef: setEndOfListElement } = useInView();

  const rows = useMemo(() => threads.threads.map(threadToListRow), [threads.threads]);
  const selectedRow = rows.find(row => row.threadId === selectedThreadId);
  const { isLoading, isError } = threads;

  // The drawer is modal, so the list behind it cannot be clicked while a thread is open.
  const handleThreadClick = (row: TracesListViewTrace) => {
    if (row.threadId) onSelectedThreadChange(row.threadId);
  };

  // Same rule as /traces: an empty window without filters gets the full-page empty state.
  const showEmptyState =
    !isLoading && !isError && rows.length === 0 && !filters.contentFiltersApplied && !selectedThreadId;

  return (
    <>
      <h1 className="sr-only">Threads</h1>
      <ObservabilityListBody
        toolbar={
          <>
            {urlState && <ObservabilitySavedViews page="threads" {...urlState} columns={columns} />}
            <ActionRow>
              <ActionRow.Start>
                <ThreadsFilterBar
                  fields={filterFields}
                  datePreset={filters.datePreset}
                  dateFrom={filters.dateFrom}
                  dateTo={filters.dateTo}
                  tokens={filters.tokens}
                  groups={filters.groups}
                  onDatePresetChange={filters.onDatePresetChange}
                  onDateChange={filters.onDateChange}
                  onDateRangeChange={filters.onDateRangeChange}
                  onFiltersChange={filters.onFiltersChange}
                  disabled={isLoading}
                />
              </ActionRow.Start>
              <ActionRow.End>
                <ColumnsMenu
                  scope="threads"
                  value={columns.preferences}
                  onChange={columns.setPreferences}
                  support={support}
                />
              </ActionRow.End>
            </ActionRow>
          </>
        }
        error={
          isError ? (
            <TracesErrorContent error={threads.error} resource="threads" errorTitle="Failed to load threads" />
          ) : undefined
        }
        empty={
          showEmptyState ? (
            <NoTracesInfo
              resource="threads"
              datePreset={filters.datePreset}
              dateFrom={filters.dateFrom}
              dateTo={filters.dateTo}
            />
          ) : undefined
        }
      >
        <TracesListView
          listId="all-threads"
          columnPreferences={displayedColumns}
          outcomeColumn={false}
          traces={rows}
          isLoading={isLoading}
          isFetchingNextPage={threads.isFetchingNextPage}
          hasNextPage={threads.hasNextPage}
          setEndOfListElement={setEndOfListElement}
          filtersApplied={filters.filtersApplied}
          resource="threads"
          sort={filters.sort}
          onSortChange={next => filters.setSort({ field: 'startedAt', direction: next.direction })}
          featuredTraceId={selectedRow?.traceId}
          onTraceClick={handleThreadClick}
        />
        <LoadMoreWhenInView
          inView={inView}
          hasNextPage={threads.hasNextPage}
          isFetchingNextPage={threads.isFetchingNextPage}
          isError={isError}
          onLoadMore={threads.onLoadMore}
        />
      </ObservabilityListBody>
      {renderPanel({ threadId: selectedThreadId, onClose: () => onSelectedThreadChange(undefined) })}
    </>
  );
}
