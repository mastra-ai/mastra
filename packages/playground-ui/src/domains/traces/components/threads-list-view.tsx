import { useTraceThreadSummary } from '@mastra/react/hooks/traces';
import { useRef } from 'react';
import { DataList, DataListSkeletonRows, TracesDataList, useDataListKeyboard } from '@/ds/components/DataList';
import { formatDuration } from '@/utils/duration';

const THREAD_LIST_COLUMNS = '11rem 12rem minmax(10rem,1fr) minmax(10rem,1fr) 5rem 7rem 6rem';

export type ThreadsListViewProps = {
  threadIds: string[];
  /** Time range the summaries are built over; matches the list's filter range. */
  timeRange: { from: string; to: string };
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  filtersApplied?: boolean;
  featuredThreadId?: string | null;
  onThreadClick: (threadId: string) => void;
};

/** One row per conversation (`threadId`). Each row loads its own summary from the thread's traces. */
export function ThreadsListView({
  threadIds,
  timeRange,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  setEndOfListElement,
  filtersApplied,
  featuredThreadId,
  onThreadClick,
}: ThreadsListViewProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { getRowProps } = useDataListKeyboard({ count: threadIds.length, containerRef: scrollRef, global: true });

  return (
    <TracesDataList columns={THREAD_LIST_COLUMNS} fit="container" scrollRef={scrollRef} className="min-w-0">
      <TracesDataList.Top>
        <TracesDataList.TopCell>Last activity</TracesDataList.TopCell>
        <TracesDataList.TopCell>Primitive name</TracesDataList.TopCell>
        <TracesDataList.TopCell>First message</TracesDataList.TopCell>
        <TracesDataList.TopCell>Last message</TracesDataList.TopCell>
        <TracesDataList.TopCell className="justify-end text-right">Turns</TracesDataList.TopCell>
        <TracesDataList.TopCell className="justify-end text-right">Duration</TracesDataList.TopCell>
        <TracesDataList.TopCell>Status</TracesDataList.TopCell>
      </TracesDataList.Top>

      {isLoading ? (
        <DataListSkeletonRows columnCount={7} />
      ) : threadIds.length === 0 ? (
        <TracesDataList.NoMatch
          message={filtersApplied ? 'No threads found for applied filters' : 'No threads found yet'}
        />
      ) : (
        <>
          {threadIds.map((threadId, index) => (
            <ThreadRow
              key={threadId}
              threadId={threadId}
              timeRange={timeRange}
              featured={threadId === featuredThreadId}
              rowProps={getRowProps(index)}
              onClick={() => onThreadClick(threadId)}
            />
          ))}
          <TracesDataList.NextPageLoading
            isLoading={isFetchingNextPage}
            hasMore={hasNextPage}
            setEndOfListElement={setEndOfListElement}
          />
        </>
      )}
    </TracesDataList>
  );
}

function ThreadRow({
  threadId,
  timeRange,
  featured,
  rowProps,
  onClick,
}: {
  threadId: string;
  timeRange: { from: string; to: string };
  featured: boolean;
  rowProps: ReturnType<ReturnType<typeof useDataListKeyboard>['getRowProps']>;
  onClick: () => void;
}) {
  const { data: summary, isLoading } = useTraceThreadSummary({ threadId, timeRange });
  const placeholder = isLoading ? '…' : '—';
  const durationMs =
    summary?.startedAt && summary.lastActivityAt
      ? new Date(summary.lastActivityAt).getTime() - new Date(summary.startedAt).getTime()
      : undefined;

  return (
    <TracesDataList.RowButton {...rowProps} onClick={onClick} featured={featured}>
      {summary?.lastActivityAt ? (
        <TracesDataList.CreatedCell timestamp={summary.lastActivityAt} preset="day-time-seconds" />
      ) : (
        <DataList.TextCell>{placeholder}</DataList.TextCell>
      )}
      <TracesDataList.NameCell name={summary?.entityName ?? placeholder} parentSpanId={null} />
      <TracesDataList.InputCell input={summary?.firstInput ?? placeholder} />
      <TracesDataList.InputCell input={summary?.lastInput ?? placeholder} />
      <DataList.NumberCell font="mono">
        {summary ? `${summary.turnCount}${summary.hasMoreTurns ? '+' : ''}` : placeholder}
      </DataList.NumberCell>
      <DataList.NumberCell font="mono">
        {durationMs === undefined ? placeholder : formatDuration(durationMs)}
      </DataList.NumberCell>
      <TracesDataList.StatusCell status={summary ? (summary.errorCount > 0 ? 'error' : 'success') : undefined} />
    </TracesDataList.RowButton>
  );
}
