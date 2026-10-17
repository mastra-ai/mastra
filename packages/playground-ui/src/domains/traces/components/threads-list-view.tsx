import { useRef } from 'react';
import { DataList, DataListSkeletonRows, TracesDataList, useDataListKeyboard } from '@/ds/components/DataList';

const THREAD_LIST_COLUMNS = 'minmax(0,1fr)';

export type ThreadsListViewProps = {
  threadIds: string[];
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  filtersApplied?: boolean;
  featuredThreadId?: string | null;
  onThreadClick: (threadId: string) => void;
};

/** One row per conversation (`threadId`). */
export function ThreadsListView({
  threadIds,
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
        <TracesDataList.TopCell>Thread ID</TracesDataList.TopCell>
      </TracesDataList.Top>

      {isLoading ? (
        <DataListSkeletonRows columnCount={1} />
      ) : threadIds.length === 0 ? (
        <TracesDataList.NoMatch
          message={filtersApplied ? 'No threads found for applied filters' : 'No threads found yet'}
        />
      ) : (
        <>
          {threadIds.map((threadId, index) => (
            <TracesDataList.RowButton
              key={threadId}
              {...getRowProps(index)}
              onClick={() => onThreadClick(threadId)}
              featured={threadId === featuredThreadId}
            >
              <DataList.TextCell font="mono">{threadId}</DataList.TextCell>
            </TracesDataList.RowButton>
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
