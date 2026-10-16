import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import type { ReactNode } from 'react';
import { Fragment, useContext, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';

import type { BoardLayout } from '../boardLayout';
import { BoardScrollContext } from '../context/BoardScrollContext';
import { boardRetainedRows } from '../services/boardRetainedRows';
import { boardVirtualScroll } from '../services/boardVirtualScroll';

const estimateListRow = () => 44;
const estimateBoardCard = () => 154;

/** Own scroll updates here: scrolling must not repeat the board's filtering,
 * sorting, or per-item key construction. The parent supplies stable callbacks
 * until its data changes, so TanStack can reuse its measurement cache. */
export function VirtualBoardWindow({
  count,
  layout,
  pinnedIndex,
  getItemKey,
  getItemIndex,
  renderItem,
}: {
  count: number;
  layout: BoardLayout;
  pinnedIndex: number;
  getItemKey: (index: number) => string;
  getItemIndex: (key: string) => number | undefined;
  renderItem: (index: number) => ReactNode;
}) {
  const scrollRef = useContext(BoardScrollContext);
  const contentRef = useRef<HTMLDivElement>(null);
  const [retainedRows] = useState(() => boardRetainedRows(contentRef));
  const retainedKeys = useSyncExternalStore(retainedRows.subscribe, retainedRows.getSnapshot);
  const [scrollOptions] = useState(() => boardVirtualScroll(scrollRef, contentRef));
  const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    ...scrollOptions,
    count,
    getItemKey,
    estimateSize: layout === 'list' ? estimateListRow : estimateBoardCard,
    overscan: 4,
    // Batch all visible columns in one React update instead of flushing each
    // column synchronously inside the shared viewport's scroll event.
    useFlushSync: false,
    rangeExtractor: range => {
      const indexes = new Set(defaultRangeExtractor(range));
      if (pinnedIndex >= 0) indexes.add(pinnedIndex);
      for (const key of retainedKeys) {
        const index = getItemIndex(key);
        if (index !== undefined) indexes.add(index);
      }
      return [...indexes].filter(index => index < count).toSorted((a, b) => a - b);
    },
  });
  useLayoutEffect(() => {
    // Several columns share a viewport. Let normal-flow browser anchoring handle
    // resizing; independent virtualizers must not each adjust that same scrollTop.
    virtualizer.shouldAdjustScrollPositionOnItemSizeChange = () => false;
    return () => {
      virtualizer.shouldAdjustScrollPositionOnItemSizeChange = undefined;
    };
  }, [virtualizer]);
  const rows = virtualizer.getVirtualItems();
  const scrollElement = virtualizer.scrollElement;
  useLayoutEffect(() => {
    if (pinnedIndex < 0 || !scrollElement) return;
    // Reconcile the target as nearby rows are measured. On mobile those rows
    // can grow after the card's initial scrollIntoView and push it offscreen.
    virtualizer.scrollToIndex(pinnedIndex, { align: 'center' });
  }, [pinnedIndex, scrollElement, virtualizer]);
  const listGrid = layout === 'list' ? 'col-span-full grid grid-cols-subgrid' : undefined;

  return (
    <div ref={contentRef} className={listGrid}>
      {rows.map((row, position) => (
        <Fragment key={row.key}>
          <div aria-hidden className="col-span-full" style={{ height: row.start - (rows[position - 1]?.end ?? 0) }} />
          <div
            ref={virtualizer.measureElement}
            data-index={row.index}
            data-item-key={row.key}
            className={listGrid}
            style={{ paddingBottom: layout === 'list' ? 1 : 10 }}
          >
            {renderItem(row.index)}
          </div>
        </Fragment>
      ))}
      <div
        aria-hidden
        className="col-span-full"
        style={{ height: Math.max(0, virtualizer.getTotalSize() - (rows.at(-1)?.end ?? 0)) }}
      />
    </div>
  );
}
