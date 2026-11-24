import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import type { LogViewListProps } from '../log-view-list';
import { LogViewRow } from './log-view-row';
import { OlderLogsEdge } from './older-logs-edge';
import { useDataListKeyboard } from '@/ds/components/DataList';
import { LogStream } from '@/ds/components/LogStream';
import { Txt } from '@/ds/components/Txt';

const ROW_HEIGHT = 24;
const OVERSCAN = 8;

export type LogViewRowsProps = Omit<LogViewListProps, 'isLoading'>;

export function LogViewRows({
  logs,
  isFetchingNextPage,
  hasNextPage,
  logIdMap,
  featuredLogId,
  onLogClick,
  order = 'newest-first',
  wrap = true,
  onFetchNextPage,
}: LogViewRowsProps) {
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
        return (
          <LogViewRow
            key={id}
            log={log}
            index={item.index}
            featured={id === featuredLogId}
            wrap={wrap}
            measureRef={virtualizer.measureElement}
            keyboardProps={getRowProps(item.index)}
            onLogClick={onLogClick}
          />
        );
      })}
      <LogStream.Spacer height={paddingBottom} />
      {!isOldestFirst && olderEdge}
    </LogStream>
  );
}
