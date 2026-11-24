import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useLayoutEffect, useRef } from 'react';
import type { LogRecord } from '../types';
import { LogsListRow } from './logs-list-row';
import { useDataListKeyboard } from '@/ds/components/DataList';
import { LogsDataList } from '@/ds/components/LogsDataList';
import { SkeletonText } from '@/ds/components/Skeleton';
import { Txt } from '@/ds/components/Txt';

const COLUMNS = 'auto auto minmax(0,1fr)';
const ROW_HEIGHT = 24;
const OVERSCAN = 8;
const SKELETON_WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-5/6', 'w-3/5', 'w-4/5'] as const;

export type LogsStreamOrder = 'newest-first' | 'oldest-first';

export interface LogsStreamViewProps {
  logs: LogRecord[];
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  logIdMap: Map<LogRecord, string>;
  featuredLogId?: string;
  onLogClick?: (log: LogRecord) => void;
  order?: LogsStreamOrder;
  onFetchNextPage?: () => void;
}

export function LogsStreamView({ isLoading, ...props }: LogsStreamViewProps) {
  if (isLoading) return <LogsStreamSkeleton />;
  return (
    <div className="@container flex min-h-0 min-w-0 flex-1 flex-col px-1 pb-1">
      <LogsStreamList {...props} />
    </div>
  );
}

function LogsStreamSkeleton() {
  return (
    <div className="flex flex-col gap-1 px-3 py-1" aria-busy="true">
      {SKELETON_WIDTHS.map(width => (
        <SkeletonText key={width} className={width} />
      ))}
    </div>
  );
}

function LogsStreamList({
  logs,
  isFetchingNextPage,
  hasNextPage,
  logIdMap,
  featuredLogId,
  onLogClick,
  order = 'newest-first',
  onFetchNextPage,
}: Omit<LogsStreamViewProps, 'isLoading'>) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isOldestFirst = order === 'oldest-first';
  const lastLogIndex = logs.length - 1;

  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    getItemKey: index => {
      const log = logs[index];
      return (log && logIdMap.get(log)) ?? index;
    },
    overscan: OVERSCAN,
  });

  const { getRowProps } = useDataListKeyboard({
    count: logs.length,
    containerRef: scrollRef,
    onNavigate: index => virtualizer.scrollToIndex(index),
  });

  const virtualItems = virtualizer.getVirtualItems();
  const lastRenderedIndex = virtualItems.at(-1)?.index;

  const pinnedToNewestRef = useRef(!isOldestFirst);
  useEffect(() => {
    if (pinnedToNewestRef.current || lastRenderedIndex === undefined) return;
    if (lastRenderedIndex === lastLogIndex) {
      pinnedToNewestRef.current = true;
      return;
    }
    const frame = requestAnimationFrame(() => virtualizer.scrollToIndex(lastLogIndex, { align: 'end' }));
    return () => cancelAnimationFrame(frame);
  }, [lastRenderedIndex, lastLogIndex, virtualizer]);

  const firstLogId = logs[0] && logIdMap.get(logs[0]);
  const prependAnchorRef = useRef<{ firstLogId?: string; scrollHeight: number }>({ scrollHeight: 0 });
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const previous = prependAnchorRef.current;
    const previousFirstIndex = logs.findIndex(log => logIdMap.get(log) === previous.firstLogId);
    if (isOldestFirst && previousFirstIndex > 0) element.scrollTop += element.scrollHeight - previous.scrollHeight;
    prependAnchorRef.current = { firstLogId, scrollHeight: element.scrollHeight };
  });

  const observeOlderEdge = (node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && pinnedToNewestRef.current && hasNextPage && !isFetchingNextPage) {
          onFetchNextPage?.();
        }
      },
      { root: scrollRef.current },
    );
    observer.observe(node);
    return () => observer.disconnect();
  };

  const paddingTop = virtualItems[0]?.start ?? 0;
  const paddingBottom = Math.max(0, virtualizer.getTotalSize() - (virtualItems.at(-1)?.end ?? 0));
  const olderEdge = hasNextPage && (
    <div ref={observeOlderEdge} role="status" className="col-span-full flex min-h-6 items-center px-3">
      {isFetchingNextPage && (
        <Txt as="span" variant="caption" tone="muted">
          Loading older logs
        </Txt>
      )}
    </div>
  );

  return (
    <>
      <LogsDataList
        columns={COLUMNS}
        scrollRef={scrollRef}
        className="min-w-0 flex-1"
        fit="container"
        variant="well"
        mask={false}
        density="compact"
      >
        <LogsDataList.Top className="@max-md:hidden">
          <LogsDataList.TopCell>Time</LogsDataList.TopCell>
          <LogsDataList.TopCell>Level</LogsDataList.TopCell>
          <LogsDataList.TopCell>Message</LogsDataList.TopCell>
        </LogsDataList.Top>
        {logs.length === 0 && <LogsDataList.NoMatch message="No logs match your search" />}
        {isOldestFirst && olderEdge}
        <LogsDataList.Spacer height={paddingTop} />
        {virtualItems.map(item => {
          const log = logs[item.index];
          const id = log && logIdMap.get(log);
          if (!log || !id) return null;
          return (
            <LogsListRow
              key={id}
              log={log}
              index={item.index}
              featured={id === featuredLogId}
              measureRef={virtualizer.measureElement}
              keyboardProps={getRowProps(item.index)}
              onLogClick={onLogClick}
            >
              <LogsDataList.LineCell
                timestamp={log.timestamp}
                level={log.level}
                message={log.message}
                fields={log.data ?? undefined}
              />
            </LogsListRow>
          );
        })}
        <LogsDataList.Spacer height={paddingBottom} />
        {!isOldestFirst && olderEdge}
      </LogsDataList>
    </>
  );
}
