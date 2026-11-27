import { useVirtualizer } from '@tanstack/react-virtual';
import { useImperativeHandle, useRef } from 'react';
import type { LogViewLine } from '../../types';
import type { LogViewListProps } from '../log-view-list';
import { LogViewPageEdge } from './log-view-page-edge';
import { LogViewRow } from './log-view-row';
import { useDataListKeyboard } from '@/ds/components/DataList';
import { LogStream } from '@/ds/components/LogStream';
import { Txt } from '@/ds/components/Txt';

const ROW_HEIGHT = 24;
const OVERSCAN = 8;

export type LogViewRowsProps<T extends LogViewLine> = Omit<LogViewListProps<T>, 'isLoading'>;

export function LogViewRows<T extends LogViewLine>({
  logs,
  isFetchingNextPage,
  hasNextPage,
  nextPage = 'older',
  logIdMap,
  featuredLogId,
  onLogClick,
  order = 'newest-first',
  wrap = true,
  timeFractionDigits,
  onFetchNextPage,
  ref,
}: LogViewRowsProps<T>) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isOldestFirst = order === 'oldest-first';
  const pagesAbove = isOldestFirst === (nextPage === 'older');
  const startAtEnd = isOldestFirst && nextPage === 'older';

  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    getItemKey: index => {
      const log = logs[index];
      return (log && logIdMap.get(log)) ?? index;
    },
    overscan: OVERSCAN,
    anchorTo: startAtEnd ? 'end' : 'start',
    followOnAppend: startAtEnd,
    initialOffset: startAtEnd ? () => logs.length * ROW_HEIGHT : 0,
  });

  const { getRowProps } = useDataListKeyboard({
    count: logs.length,
    containerRef: scrollRef,
    onNavigate: index => virtualizer.scrollToIndex(index),
  });

  useImperativeHandle(ref, () => ({
    scrollToLog: logId => {
      const index = logs.findIndex(log => logIdMap.get(log) === logId);
      if (index >= 0) virtualizer.scrollToIndex(index, { align: 'center' });
    },
  }));

  const loadNextPage = () => {
    if (hasNextPage && !isFetchingNextPage) onFetchNextPage?.();
  };

  const virtualItems = virtualizer.getVirtualItems();
  const paddingTop = virtualItems[0]?.start ?? 0;
  const paddingBottom = Math.max(0, virtualizer.getTotalSize() - (virtualItems.at(-1)?.end ?? 0));
  const pageEdge = hasNextPage && (
    <LogViewPageEdge
      label={nextPage === 'older' ? 'Loading older logs' : 'Loading newer logs'}
      isFetching={isFetchingNextPage}
      onVisible={loadNextPage}
    />
  );

  return (
    <LogStream scrollRef={scrollRef} wrap={wrap} fractionDigits={timeFractionDigits} className="flex-1">
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
      {pagesAbove && pageEdge}
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
            timeFractionDigits={timeFractionDigits}
            measureRef={virtualizer.measureElement}
            keyboardProps={getRowProps(item.index)}
            onLogClick={onLogClick}
          />
        );
      })}
      <LogStream.Spacer height={paddingBottom} />
      {!pagesAbove && pageEdge}
    </LogStream>
  );
}
