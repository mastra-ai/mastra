import { useQueryThreads } from '@mastra/react/hooks/traces';
import type { ThreadQueryArgs } from '@mastra/react/hooks/traces';
import { useMemo } from 'react';
import { buildThreadQueryWhere } from '../thread-filters';
import { threadToListRow } from '../thread-list-row';
import { ThreadsFilterBar } from './threads-filter-bar';
import { useFeedbackAvailable, useTraceQueryAvailable } from '@/domains/capabilities';
import { ObservabilityListBody } from '@/domains/observability/components/observability-list-body';
import {
  observabilityListQueryOptions,
  useObservabilityListFilters,
} from '@/domains/observability/hooks/use-observability-list-filters';
import { NoTracesInfo } from '@/domains/traces/components/no-traces-info';
import { TraceThreadPanel } from '@/domains/traces/components/trace-thread-panel';
import { TracesErrorContent } from '@/domains/traces/components/traces-error-content';
import { TracesListView } from '@/domains/traces/components/traces-list-view';
import type { TracesListViewTrace } from '@/domains/traces/components/traces-list-view';
import { ActionRow } from '@/ds/components/ActionRow';

export type ThreadsExplorerBodyProps = {
  /** The open thread. The host keeps it (e.g. in the URL) so it survives a reload. */
  selectedThreadId: string | undefined;
  onSelectedThreadChange: (threadId: string | undefined) => void;
  /** Opens a score from the thread drawer; scores live on host routes. */
  onOpenScore: (traceId: string, scoreId: string) => void;
};

/** The threads page body: filter bar, thread list and the thread drawer. Router-agnostic. */
export function ThreadsExplorerBody({
  selectedThreadId,
  onSelectedThreadChange,
  onOpenScore,
}: ThreadsExplorerBodyProps) {
  const filters = useObservabilityListFilters();
  const { timeRange, tokens, groups, sort } = filters;
  const withQueryTrace = useTraceQueryAvailable().enabled;
  const withFeedback = useFeedbackAvailable().enabled;

  // Threads with trace activity in the window, like the traces list for the same chip.
  const query = useMemo<ThreadQueryArgs>(() => {
    const where = buildThreadQueryWhere(tokens, groups);
    return {
      timeRange: { traces: timeRange },
      orderBy: [{ field: 'startedAt', direction: sort }],
      ...(where ? { where } : {}),
    };
  }, [timeRange, sort, tokens, groups]);

  const { threads, hasNextPage, isFetchingNextPage, setEndOfListElement, isLoading, isError, error } = useQueryThreads({
    query,
    queryOptions: observabilityListQueryOptions,
  });

  const rows = useMemo(() => (threads ?? []).map(threadToListRow), [threads]);
  const selectedRow = rows.find(row => row.threadId === selectedThreadId);

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
          <ActionRow>
            <ActionRow.Start>
              <ThreadsFilterBar
                datePreset={filters.datePreset}
                dateFrom={filters.dateFrom}
                dateTo={filters.dateTo}
                tokens={tokens}
                groups={groups}
                onDatePresetChange={filters.onDatePresetChange}
                onDateChange={filters.onDateChange}
                onDateRangeChange={filters.onDateRangeChange}
                onFiltersChange={filters.onFiltersChange}
                disabled={isLoading}
              />
            </ActionRow.Start>
          </ActionRow>
        }
        error={
          isError ? (
            <TracesErrorContent error={error} resource="threads" errorTitle="Failed to load threads" />
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
          traces={rows}
          isLoading={isLoading}
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={hasNextPage}
          setEndOfListElement={setEndOfListElement}
          filtersApplied={filters.filtersApplied}
          resource="threads"
          createdSort={sort}
          onSortChange={filters.setSort}
          featuredTraceId={selectedRow?.traceId}
          onTraceClick={handleThreadClick}
        />
      </ObservabilityListBody>
      <TraceThreadPanel
        open={!!selectedThreadId}
        threadId={selectedThreadId ?? ''}
        depth={1}
        closeLabel="Close"
        withQueryTrace={withQueryTrace}
        withFeedback={withFeedback}
        onOpenScore={onOpenScore}
        onClose={() => onSelectedThreadChange(undefined)}
      />
    </>
  );
}
