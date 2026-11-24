import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef } from 'react';
import type { LogRecord } from '../types';
import { Button } from '@/ds/components/Button';
import { useDataListKeyboard } from '@/ds/components/DataList';
import type { DataListSort } from '@/ds/components/DataList';
import { LogsDataList, LogsDataListSkeleton } from '@/ds/components/LogsDataList';
import { SkeletonText } from '@/ds/components/Skeleton';

// Fixed widths on non-flex columns prevent track shifts as the virtualizer swaps rows in/out.
const COLUMNS = '6rem 9rem 5rem 10rem minmax(8rem,1fr) minmax(8rem,1fr)';

const STREAM_COLUMNS = 'minmax(0,1fr)';

const ROW_HEIGHT = 36;
const STREAM_ROW_HEIGHT = 24;
const OVERSCAN = 8;
const STREAM_SKELETON_WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-5/6', 'w-3/5', 'w-4/5'] as const;

export type LogsListViewDensity = 'table' | 'stream';

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
  density?: LogsListViewDensity;
  onFetchNextPage?: () => void;
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
  density = 'table',
  onFetchNextPage,
}: LogsListViewProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isStream = density === 'stream';

  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => (isStream ? STREAM_ROW_HEIGHT : ROW_HEIGHT),
    overscan: OVERSCAN,
  });

  const { getRowProps } = useDataListKeyboard({
    count: logs.length,
    containerRef: scrollRef,
    onNavigate: index => virtualizer.scrollToIndex(index),
    global: !isStream,
  });

  const renderedRowCount = isLoading ? 0 : virtualizer.getVirtualItems().length;
  const pinnedToEndRef = useRef(false);
  useEffect(() => {
    if (isLoading) {
      pinnedToEndRef.current = false;
      return;
    }
    if (!isStream || pinnedToEndRef.current || renderedRowCount === 0) return;
    const frame = requestAnimationFrame(() => {
      virtualizer.scrollToIndex(logs.length - 1, { align: 'end' });
      pinnedToEndRef.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [isStream, isLoading, renderedRowCount, logs.length, virtualizer]);

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
    if (wasLoadingRef.current && !isLoading && !isStream) {
      scrollRef.current?.dispatchEvent(new Event('scroll'));
    }
    wasLoadingRef.current = isLoading;
  }, [isLoading, isStream]);

  if (isLoading) {
    if (isStream) {
      return (
        <div className="flex flex-col gap-1 px-3 py-1" aria-busy="true">
          {STREAM_SKELETON_WIDTHS.map(width => (
            <SkeletonText key={width} className={width} />
          ))}
        </div>
      );
    }
    return <LogsDataListSkeleton columns={COLUMNS} fit="container" />;
  }

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const paddingTop = virtualItems[0]?.start ?? 0;
  const paddingBottom =
    virtualItems.length > 0 ? Math.max(0, totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0)) : 0;

  const rows = (
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

        const isError = log.level === 'error' || log.level === 'fatal';

        return (
          <LogsDataList.RowButton
            key={id}
            ref={virtualizer.measureElement}
            data-index={vi.index}
            {...getRowProps(vi.index)}
            onClick={() => onLogClick(log)}
            featured={isFeatured}
            variant={isError && !isStream ? 'error' : 'default'}
          >
            {isStream ? (
              <LogsDataList.LineCell
                timestamp={log.timestamp}
                level={log.level}
                message={log.message}
                fields={log.data}
              />
            ) : (
              <>
                <LogsDataList.DateCell timestamp={log.timestamp} />
                <LogsDataList.TimeCell timestamp={log.timestamp} />
                <LogsDataList.LevelCell level={log.level} />
                <LogsDataList.EntityCell entityType={log.entityType} entityName={log.entityName} />
                <LogsDataList.MessageCell message={log.message} />
                <LogsDataList.DataCell data={log.data} />
              </>
            )}
          </LogsDataList.RowButton>
        );
      })}
      <LogsDataList.Spacer height={paddingBottom} />
    </>
  );

  if (isStream) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {hasNextPage && onFetchNextPage && (
          <Button variant="ghost" size="sm" className="w-full" onClick={onFetchNextPage} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? 'Loading older logs' : 'Load older logs'}
          </Button>
        )}
        <LogsDataList
          columns={STREAM_COLUMNS}
          scrollRef={scrollRef}
          className="min-w-0 flex-1"
          fit="container"
          variant="light"
          density="compact"
        >
          {logs.length === 0 ? <LogsDataList.NoMatch message="No logs match your search" /> : rows}
        </LogsDataList>
      </div>
    );
  }

  return (
    <LogsDataList columns={COLUMNS} scrollRef={scrollRef} className="min-w-0" fit="container">
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

      {logs.length === 0 ? <LogsDataList.NoMatch message="No logs match your search" /> : rows}
      <LogsDataList.NextPageLoading
        isLoading={isFetchingNextPage}
        hasMore={hasNextPage}
        setEndOfListElement={setEndOfListElement}
      />
    </LogsDataList>
  );
}
