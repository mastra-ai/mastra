import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useRef, useState } from 'react';

const SCROLLING_OVERFLOW = /(auto|scroll)/;

function findScrollingAncestor(element: HTMLElement): HTMLElement | null {
  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    if (SCROLLING_OVERFLOW.test(getComputedStyle(ancestor).overflowY)) return ancestor;
  }
  return null;
}

/** Height of sticky page chrome above the list, published inline on the page scroller by the page layout. */
function stickyTopOf(pageScroller: HTMLElement | null): number {
  return parseFloat(pageScroller?.style.getPropertyValue('--page-layout-sticky-top') ?? '') || 0;
}

type PageListGeometry = {
  rowsOffsetInScroller: number;
  stickyHeaderHeight: number;
};

export type UseDataListPageVirtualizerArgs = {
  count: number;
  rowHeight: number;
  overscan: number;
};

/**
 * Virtualizes a `scroll="page"` + `fit="container"` DataList against the page
 * scroller it sits in. Pass `listRef` to the DataList's `scrollRef`; spacer
 * heights are relative to the first row, below the sticky header.
 */
export function useDataListPageVirtualizer({ count, rowHeight, overscan }: UseDataListPageVirtualizerArgs) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const pageScrollerRef = useRef<HTMLElement | null>(null);
  const [geometry, setGeometry] = useState<PageListGeometry>({ rowsOffsetInScroller: 0, stickyHeaderHeight: 0 });

  const attachList = useCallback((list: HTMLDivElement | null) => {
    listRef.current = list;
    pageScrollerRef.current = list ? findScrollingAncestor(list) : null;
    const pageScroller = pageScrollerRef.current;
    if (!list || !pageScroller) return;

    const listOffsetInScroller =
      list.getBoundingClientRect().top - pageScroller.getBoundingClientRect().top + pageScroller.scrollTop;
    const stickyHeaderHeight = list.querySelector<HTMLElement>('.data-list-top')?.offsetHeight ?? 0;
    setGeometry({ rowsOffsetInScroller: listOffsetInScroller + stickyHeaderHeight, stickyHeaderHeight });
  }, []);

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => pageScrollerRef.current,
    estimateSize: () => rowHeight,
    overscan,
    scrollMargin: geometry.rowsOffsetInScroller,
    scrollPaddingStart: geometry.stickyHeaderHeight + stickyTopOf(pageScrollerRef.current),
  });

  const virtualItems = virtualizer.getVirtualItems();
  const firstItem = virtualItems[0];
  const lastItem = virtualItems[virtualItems.length - 1];
  const paddingTop = firstItem ? firstItem.start - geometry.rowsOffsetInScroller : 0;
  const paddingBottom = lastItem
    ? Math.max(0, virtualizer.getTotalSize() - (lastItem.end - geometry.rowsOffsetInScroller))
    : 0;

  return { listRef, attachList, virtualizer, virtualItems, paddingTop, paddingBottom };
}
