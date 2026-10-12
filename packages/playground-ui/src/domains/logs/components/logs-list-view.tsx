import { useEffect, useRef } from 'react';
import type { LogRecord } from '../types';
import { useDataListKeyboard, useDataListPageVirtualizer } from '@/ds/components/DataList';
import type { DataListSort, DataListVariant } from '@/ds/components/DataList';
import { LogsDataList, LogsDataListSkeleton } from '@/ds/components/LogsDataList';

// Content-independent widths on non-flex columns prevent track shifts as the virtualizer swaps rows in/out.
const COLUMNS = 'minmax(0,6rem) minmax(0,9rem) minmax(0,5rem) minmax(0,10rem) minmax(8rem,1fr) minmax(8rem,1fr)';

const ROW_HEIGHT = 36;
const OVERSCAN = 8;

export interface LogsListViewProps {
  logs: LogRecord[];
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  /** Stable per-render id for each log — used for React keys and for matching against `featuredLogId`.
   *  Build with `useLogsListNavigation`. */
  logIdMap: Map<LogRecord, string>;
  /** Currently featured/selected log — its row gets the highlighted background. */
  featuredLogId?: string | null;
  /** Called when a row is clicked. The current toggle + trace-sync logic is the consumer's call. */
  onLogClick: (log: LogRecord) => void;
  /** Current timestamp sort direction. When `onSortChange` is provided the Date/Time headers become sortable. */
  timestampSort?: DataListSort;
  onSortChange?: (direction: DataListSort, key: 'timestamp') => void;
  /** `light` drops the card panel when the list fills a panel of its own. */
  variant?: DataListVariant;
}

/**
 * Virtualized presentational list. Renders only the visible window of logs via
 * TanStack Virtual, sandwiched between top/bottom Spacers that preserve total
 * scroll height. Owns no state and fetches no data.
 */
export function LogsListView({
  logs,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  setEndOfListElement,
  logIdMap,
  featuredLogId,
  onLogClick,
  timestampSort,
  onSortChange,
  variant,
}: LogsListViewProps) {
  const { listRef, attachList, virtualizer, virtualItems, paddingTop, paddingBottom } = useDataListPageVirtualizer({
    count: logs.length,
    rowHeight: ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const { getRowProps } = useDataListKeyboard({
    count: logs.length,
    containerRef: listRef,
    onNavigate: index => virtualizer.scrollToIndex(index),
    global: true,
  });

  // The virtualizer does not re-read scrollTop when it rebinds after the skeleton, so a fresh query
  // scrolls the page back to the top and replays a scroll event for it.
  const wasLoadingRef = useRef(isLoading);
  useEffect(() => {
    const pageScroller = virtualizer.scrollElement;
    if (wasLoadingRef.current && !isLoading && pageScroller) {
      pageScroller.scrollTop = 0;
      pageScroller.dispatchEvent(new Event('scroll'));
    }
    wasLoadingRef.current = isLoading;
  }, [isLoading, virtualizer]);

  if (isLoading) {
    return <LogsDataListSkeleton columns={COLUMNS} fit="container" scroll="page" variant={variant} />;
  }

  return (
    <LogsDataList
      columns={COLUMNS}
      scrollRef={attachList}
      variant={variant}
      className="min-w-0"
      fit="container"
      scroll="page"
    >
      <LogsDataList.Top>
        {onSortChange ? (
          <LogsDataList.SortableTopCell sortKey="timestamp" sort={timestampSort} onSortChange={onSortChange}>
            Date
          </LogsDataList.SortableTopCell>
        ) : (
          <LogsDataList.TopCell>Date</LogsDataList.TopCell>
        )}
        <LogsDataList.TopCell>Time</LogsDataList.TopCell>
        <LogsDataList.TopCell>Level</LogsDataList.TopCell>
        <LogsDataList.TopCell>Entity</LogsDataList.TopCell>
        <LogsDataList.TopCell>Message</LogsDataList.TopCell>
        <LogsDataList.TopCell>Data</LogsDataList.TopCell>
      </LogsDataList.Top>

      {logs.length === 0 ? (
        <LogsDataList.NoMatch message="No logs match your search" />
      ) : (
        <>
          <LogsDataList.Spacer height={paddingTop} />
          {virtualItems.map(vi => {
            const log = logs[vi.index];
            if (!log) return null;
            const id = logIdMap.get(log);
            // Defensive: consumer is expected to build `logIdMap` from the same `logs` list
            // (via `useLogsListNavigation`), but if they drift we'd rather drop the row than
            // ship a missing-key warning and broken selection highlighting.
            if (!id) return null;
            const isFeatured = id === featuredLogId;

            return (
              <LogsDataList.RowButton
                key={id}
                ref={virtualizer.measureElement}
                data-index={vi.index}
                {...getRowProps(vi.index)}
                onClick={() => onLogClick(log)}
                featured={isFeatured}
                variant={log.level === 'error' || log.level === 'fatal' ? 'error' : 'default'}
              >
                <LogsDataList.DateCell timestamp={log.timestamp} />
                <LogsDataList.TimeCell timestamp={log.timestamp} />
                <LogsDataList.LevelCell level={log.level} />
                <LogsDataList.EntityCell entityType={log.entityType} entityName={log.entityName} />
                <LogsDataList.MessageCell message={log.message} />
                <LogsDataList.DataCell data={log.data} />
              </LogsDataList.RowButton>
            );
          })}
          <LogsDataList.Spacer height={paddingBottom} />
        </>
      )}
      <LogsDataList.NextPageLoading
        isLoading={isFetchingNextPage}
        hasMore={hasNextPage}
        setEndOfListElement={setEndOfListElement}
      />
    </LogsDataList>
  );
}
