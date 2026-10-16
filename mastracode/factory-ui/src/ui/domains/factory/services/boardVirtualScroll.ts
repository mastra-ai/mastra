import { elementScroll, observeElementOffset } from '@tanstack/react-virtual';
import type { VirtualizerOptions } from '@tanstack/react-virtual';
import type { RefObject } from 'react';

/** Translate the shared viewport to this group's coordinates. Reading the
 * origin on scroll/resize accounts for preceding groups, the toolbar, inline
 * composers, and candidate dividers without rerendering the whole board. */
export function boardVirtualScroll(
  scrollRef: RefObject<HTMLDivElement | null> | undefined,
  contentRef: RefObject<HTMLDivElement | null>,
): Pick<
  VirtualizerOptions<HTMLDivElement, HTMLDivElement>,
  'getScrollElement' | 'observeElementOffset' | 'scrollToFn'
> {
  const origin = () => {
    const scroll = scrollRef?.current;
    const content = contentRef.current;
    if (!scroll || !content) return 0;
    return content.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop;
  };

  return {
    getScrollElement: () => scrollRef?.current ?? null,
    observeElementOffset: (instance, callback) => {
      const notify = (offset: number, scrolling: boolean) => callback(offset - origin(), scrolling);
      // TanStack's element observer only reports subsequent scroll events.
      // Seed the local (possibly negative) offset before its mount-time scroll
      // reconciliation, otherwise each later group scrolls itself to the top.
      notify(scrollRef?.current?.scrollTop ?? 0, false);
      const cleanup = observeElementOffset(instance, notify);
      const observer = new ResizeObserver(() => notify(scrollRef?.current?.scrollTop ?? 0, false));
      // A preceding group's collapse or changed height moves this group even
      // when this group's own dimensions stay the same.
      for (let element: HTMLElement | null = contentRef.current; element; element = element.parentElement) {
        observer.observe(element);
        if (element === scrollRef?.current) break;
      }
      return () => {
        cleanup?.();
        observer.disconnect();
      };
    },
    scrollToFn: (offset, options, instance) => elementScroll(offset + origin(), options, instance),
  };
}
