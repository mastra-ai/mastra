import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import type { LogRecord } from '../types';
import { LogViewFill } from './log-view/log-view-fill';
import { useDataListKeyboard } from '@/ds/components/DataList';
import { LogStream } from '@/ds/components/LogStream';
import { SkeletonText } from '@/ds/components/Skeleton';
import { Txt } from '@/ds/components/Txt';

const ROW_HEIGHT = 24;
const OVERSCAN = 8;
const SKELETON_WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-5/6', 'w-3/5', 'w-4/5'] as const;

export type LogViewOrder = 'newest-first' | 'oldest-first';

export interface LogViewListProps {
  logs: LogRecord[];
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  logIdMap: Map<LogRecord, string>;
  featuredLogId?: string;
  onLogClick?: (log: LogRecord) => void;
  order?: LogViewOrder;
  wrap?: boolean;
  onFetchNextPage?: () => void;
}

export function LogViewList({ isLoading, ...props }: LogViewListProps) {
  if (isLoading) return <LogViewSkeleton />;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col px-1 pb-1">
      <LogViewRows {...props} />
    </div>
  );
}

function LogViewSkeleton() {
  return (
    <LogViewFill>
      <div className="flex flex-col gap-1 px-3 py-2" aria-busy="true">
        {SKELETON_WIDTHS.map(width => (
          <SkeletonText key={width} className={width} />
        ))}
      </div>
    </LogViewFill>
  );
}

function OlderLogsEdge({ isFetching, onVisible }: { isFetching?: boolean; onVisible: () => void }) {
  const observe = (node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) onVisible();
    });
    observer.observe(node);
    return () => observer.disconnect();
  };

  return (
    <div ref={observe} role="status" className="col-span-full flex min-h-6 items-center px-3">
      {isFetching && (
        <Txt as="span" variant="caption" tone="muted">
          Loading older logs
        </Txt>
      )}
    </div>
  );
}

function LogViewRows({
  logs,
  isFetchingNextPage,
  hasNextPage,
  logIdMap,
  featuredLogId,
  onLogClick,
  order = 'newest-first',
  wrap = true,
  onFetchNextPage,
}: Omit<LogViewListProps, 'isLoading'>) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isOldestFirst = order === 'oldest-first';

  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    getItemKey: index => {
      const log = logs[index];
      return (log && logIdMap.get(log)) ?? index;
    },
    overscan: OVERSCAN,
    anchorTo: isOldestFirst ? 'end' : 'start',
    followOnAppend: isOldestFirst,
    initialOffset: isOldestFirst ? () => logs.length * ROW_HEIGHT : 0,
  });

  const { getRowProps } = useDataListKeyboard({
    count: logs.length,
    containerRef: scrollRef,
    onNavigate: index => virtualizer.scrollToIndex(index),
  });

  const loadOlder = () => {
    if (hasNextPage && !isFetchingNextPage) onFetchNextPage?.();
  };

  const virtualItems = virtualizer.getVirtualItems();
  const paddingTop = virtualItems[0]?.start ?? 0;
  const paddingBottom = Math.max(0, virtualizer.getTotalSize() - (virtualItems.at(-1)?.end ?? 0));
  const olderEdge = hasNextPage && <OlderLogsEdge isFetching={isFetchingNextPage} onVisible={loadOlder} />;

  return (
    <LogStream scrollRef={scrollRef} wrap={wrap} className="flex-1">
      <LogStream.Header>
        <LogStream.HeaderCell>Time</LogStream.HeaderCell>
        <LogStream.HeaderCell>Level</LogStream.HeaderCell>
        <LogStream.HeaderCell>Message</LogStream.HeaderCell>
      </LogStream.Header>
      {logs.length === 0 && (
        <Txt variant="body-sm" tone="muted" className="col-span-full px-3 py-2">
          No logs match your search
        </Txt>
      )}
      {isOldestFirst && olderEdge}
      <LogStream.Spacer height={paddingTop} />
      {virtualItems.map(item => {
        const log = logs[item.index];
        const id = log && logIdMap.get(log);
        if (!log || !id) return null;
        const line = (
          <LogStream.Line
            timestamp={log.timestamp}
            level={log.level}
            message={log.message}
            fields={log.data ?? undefined}
            wrap={wrap}
            collapse={onLogClick !== undefined}
          />
        );
        if (!onLogClick) {
          return (
            <LogStream.Row key={id} ref={virtualizer.measureElement} data-index={item.index} level={log.level}>
              {line}
            </LogStream.Row>
          );
        }
        return (
          <LogStream.RowButton
            key={id}
            ref={virtualizer.measureElement}
            data-index={item.index}
            {...getRowProps(item.index)}
            level={log.level}
            featured={id === featuredLogId}
            onClick={() => onLogClick(log)}
          >
            {line}
          </LogStream.RowButton>
        );
      })}
      <LogStream.Spacer height={paddingBottom} />
      {!isOldestFirst && olderEdge}
    </LogStream>
  );
}
