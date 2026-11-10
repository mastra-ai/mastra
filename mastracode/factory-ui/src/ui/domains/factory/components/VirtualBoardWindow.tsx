import { cn } from '@mastra/playground-ui/utils/cn';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { VirtualItem, Virtualizer } from '@tanstack/react-virtual';
import type { ReactNode } from 'react';
import { Fragment, useRef, useState } from 'react';

import type { BoardLayout } from '../boardLayout';
import { BoardRowDetailsContext } from '../context/BoardRowDetailsContext';
import { useBoardOpenCard } from '../context/useBoardOpenCard';
import { useBoardScrollRef } from '../context/useBoardScrollRef';
import { boardVirtualScroll } from '../services/boardVirtualScroll';
import { SPANS_LIST_GRID } from './BoardList';

const estimateListRowHeight = () => 44;
const estimateBoardCardHeight = () => 154;

type BoardRow = Pick<VirtualItem, 'index' | 'start' | 'end'>;

/** Index-based so scroll re-renders stay here, away from the board's filtering and sorting. */
export function VirtualBoardWindow({
  count,
  virtualized,
  layout,
  pinnedKey,
  getItemKey,
  itemIndexes,
  renderItem,
}: {
  count: number;
  virtualized: boolean;
  layout: BoardLayout;
  pinnedKey: string | undefined;
  getItemKey: (index: number) => string;
  itemIndexes: ReadonlyMap<string, number>;
  renderItem: (index: number) => ReactNode;
}) {
  const scrollRef = useBoardScrollRef();
  const contentRef = useRef<HTMLDivElement>(null);
  const [focusedKey, setFocusedKey] = useState<string>();
  const [draggingKey, setDraggingKey] = useState<string>();
  const { openKey, setCardOpen } = useBoardOpenCard();
  const [scrollOptions] = useState(() => boardVirtualScroll(scrollRef, contentRef));
  const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    ...scrollOptions,
    count,
    getItemKey,
    estimateSize: layout === 'list' ? estimateListRowHeight : estimateBoardCardHeight,
    overscan: 4,
    // Batch all visible groups into one update instead of flushing each inside the shared scroll event.
    useFlushSync: false,
  });

  const retainedIndexes = [focusedKey, draggingKey, pinnedKey, openKey].flatMap(key =>
    key === undefined ? [] : (itemIndexes.get(key) ?? []),
  );
  const rows: BoardRow[] = virtualized
    ? windowedRows(virtualizer, retainedIndexes)
    : Array.from({ length: count }, (_, index) => ({ index, start: 0, end: 0 }));
  const spaceAfterPx = virtualized ? virtualizer.getTotalSize() - (rows.at(-1)?.end ?? 0) : 0;
  const listGrid = layout === 'list' ? SPANS_LIST_GRID : undefined;

  return (
    <div ref={contentRef} className={listGrid}>
      {rows.map((row, position) => {
        const key = getItemKey(row.index);
        const spaceBeforePx = row.start - (rows[position - 1]?.end ?? 0);
        return (
          <Fragment key={key}>
            {spaceBeforePx > 0 && <div aria-hidden className="col-span-full" style={{ height: spaceBeforePx }} />}
            <div
              ref={virtualizer.measureElement}
              data-index={row.index}
              className={cn(listGrid, row.index < count - 1 && (layout === 'list' ? 'pb-px' : 'pb-2.5'))}
              onFocus={() => setFocusedKey(key)}
              onBlur={event => {
                if (event.currentTarget.contains(event.relatedTarget)) return;
                setFocusedKey(current => (current === key ? undefined : current));
              }}
              onDragStart={() => setDraggingKey(key)}
              onDragEnd={() => setDraggingKey(undefined)}
            >
              <BoardRowDetailsContext value={{ open: openKey === key, setOpen: open => setCardOpen(key, open) }}>
                {renderItem(row.index)}
              </BoardRowDetailsContext>
            </div>
          </Fragment>
        );
      })}
      {spaceAfterPx > 0 && <div aria-hidden className="col-span-full" style={{ height: spaceAfterPx }} />}
    </div>
  );
}

/** Retained rows join the range here, not in `rangeExtractor`: before the virtualizer reaches the viewport its range is empty. */
function windowedRows(
  virtualizer: Virtualizer<HTMLDivElement, HTMLDivElement>,
  retainedIndexes: readonly number[],
): BoardRow[] {
  return [...new Set([...virtualizer.getVirtualIndexes(), ...retainedIndexes])]
    .toSorted((a, b) => a - b)
    .flatMap(index => virtualizer.measurementsCache[index] ?? []);
}
