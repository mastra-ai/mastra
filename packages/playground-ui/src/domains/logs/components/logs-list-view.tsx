import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef } from 'react';
import type { LogRecord } from '../types';
import { LogsDataList, LogsDataListSkeleton } from '@/ds/components/LogsDataList';
import { cn } from '@/lib/utils';

// Fixed widths on non-flex columns prevent track shifts as the virtualizer swaps rows in/out.
const COLUMNS = '6rem 9rem 5rem 10rem minmax(8rem,1fr) minmax(8rem,1fr)';

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
}: LogsListViewProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  // Reset scroll to top whenever a fresh query resolves (filter / date range change).
  // `isLoading` only flips on initial fetches — `fetchNextPage` keeps it `false`, so this
  // effect doesn't fire during pagination.
  //
  // Why the manual scroll event: when the skeleton-vs-list branch swaps in the new scroll
  // container, it mounts at `scrollTop = 0`. The virtualizer rebinds its listener but
  // doesn't re-read `scrollTop`, so it keeps the stale `scrollOffset` from the previous
  // element. `scrollToOffset(0)` no-ops because the new element is already at 0 (no scroll
  // event fires). Dispatching a synthetic `scroll` forces the virtualizer's handler to
  // read the fresh `scrollTop` and recompute `virtualItems` with `paddingTop = 0`.
  const wasLoadingRef = useRef(isLoading);
  useEffect(() => {
    if (wasLoadingRef.current && !isLoading) {
      scrollRef.current?.dispatchEvent(new Event('scroll'));
    }
    wasLoadingRef.current = isLoading;
  }, [isLoading]);

  if (isLoading) {
    return <LogsDataListSkeleton columns={COLUMNS} />;
  }

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const paddingTop = virtualItems[0]?.start ?? 0;
  const paddingBottom =
    virtualItems.length > 0 ? Math.max(0, totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0)) : 0;

  return (
    <LogsDataList columns={COLUMNS} scrollRef={scrollRef} className="min-w-0">
      <LogsDataList.Top>
        <LogsDataList.TopCell>Date</LogsDataList.TopCell>
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
                onClick={() => onLogClick(log)}
                className={cn(isFeatured && 'bg-surface4')}
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
