import { elementScroll, observeElementOffset } from '@tanstack/react-virtual';
import type { VirtualizerOptions } from '@tanstack/react-virtual';
import type { RefObject } from 'react';

/** Every board group virtualizes against the one board viewport, offset by the group's own position in it. */
export function boardVirtualScroll(
  scrollRef: RefObject<HTMLDivElement | null>,
  contentRef: RefObject<HTMLDivElement | null>,
): Pick<
  VirtualizerOptions<HTMLDivElement, HTMLDivElement>,
  'getScrollElement' | 'observeElementOffset' | 'scrollToFn'
> {
  const groupOffsetInViewport = () => {
    const scroll = scrollRef.current;
    const content = contentRef.current;
    if (!scroll || !content) return 0;
    return content.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop;
  };

  return {
    getScrollElement: () => scrollRef.current,
    observeElementOffset: (instance, onOffset) => {
      // Sibling groups share this scrollTop: per-group size corrections would compound, so browser scroll anchoring owns it.
      instance.shouldAdjustScrollPositionOnItemSizeChange = () => false;
      const notify = (offset: number, scrolling: boolean) => onOffset(offset - groupOffsetInViewport(), scrolling);
      const notifyCurrentOffset = () => notify(scrollRef.current?.scrollTop ?? 0, false);
      // TanStack's observer reports only later scroll events; without a seed, each group scrolls the viewport to its own top.
      notifyCurrentOffset();
      const stopObservingScroll = observeElementOffset(instance, notify);
      const groupMoves = new ResizeObserver(notifyCurrentOffset);
      for (let element: HTMLElement | null = contentRef.current; element; element = element.parentElement) {
        groupMoves.observe(element);
        if (element === scrollRef.current) break;
      }
      return () => {
        stopObservingScroll?.();
        groupMoves.disconnect();
      };
    },
    scrollToFn: (offset, options, instance) => elementScroll(offset + groupOffsetInViewport(), options, instance),
  };
}
