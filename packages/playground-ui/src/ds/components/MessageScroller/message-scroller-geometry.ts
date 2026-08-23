import type { MessageScrollerScrollAlign } from './message-scroller-context';

/**
 * Geometry behind the scroller: how far to scroll for a given alignment, and
 * which anchored message the reader is currently on. Split out from the
 * component so each rule can be reasoned about — and tested — on its own.
 */

/** A message the scroller tracks, and whether a turn is anchored to it. */
export type MessageScrollerItemRecord = {
  element: HTMLElement;
  scrollAnchor: boolean;
};

/** Sub-pixel slack, so a message resting exactly on the anchor line still counts. */
export const VISIBILITY_EPSILON = 0.5;

export const getContentPadding = (contentElement: HTMLElement | null) => {
  if (!contentElement) return { start: 0, end: 0 };
  const styles = window.getComputedStyle(contentElement);
  return {
    start: Number.parseFloat(styles.paddingBlockStart || styles.paddingTop) || 0,
    end: Number.parseFloat(styles.paddingBlockEnd || styles.paddingBottom) || 0,
  };
};

export const getRelativeTop = (element: HTMLElement, viewportElement: HTMLElement) => {
  const elementRect = element.getBoundingClientRect();
  const viewportRect = viewportElement.getBoundingClientRect();
  return elementRect.top - viewportRect.top + viewportElement.scrollTop;
};

export const getScrollTarget = ({
  align,
  element,
  scrollMargin,
  viewportElement,
}: {
  align: MessageScrollerScrollAlign;
  element: HTMLElement;
  scrollMargin: number;
  viewportElement: HTMLElement;
}) => {
  const contentPadding = getContentPadding(element.parentElement);
  const elementTop = getRelativeTop(element, viewportElement);
  const elementHeight = element.getBoundingClientRect().height;
  const visibleHeight = Math.max(0, viewportElement.clientHeight - contentPadding.start - contentPadding.end);

  if (align === 'center') return elementTop - contentPadding.start - (visibleHeight - elementHeight) / 2 - scrollMargin;
  if (align === 'end')
    return elementTop - viewportElement.clientHeight + elementHeight + contentPadding.end + scrollMargin;

  if (align === 'nearest') {
    const elementBottom = elementTop + elementHeight;
    const viewportTop = viewportElement.scrollTop + contentPadding.start;
    const viewportBottom = viewportElement.scrollTop + viewportElement.clientHeight - contentPadding.end;
    if (elementTop >= viewportTop && elementBottom <= viewportBottom) return viewportElement.scrollTop;
    return elementTop < viewportTop
      ? elementTop - contentPadding.start - scrollMargin
      : elementBottom - viewportElement.clientHeight + contentPadding.end + scrollMargin;
  }

  return elementTop - contentPadding.start - scrollMargin;
};

export const getCurrentAnchorId = ({
  fallbackAnchorId,
  items,
  scrollMargin,
  scrollPreviousItemPeek,
  visibleMessageIds,
  viewportElement,
}: {
  fallbackAnchorId: string | undefined;
  items: Array<readonly [string, MessageScrollerItemRecord]>;
  scrollMargin: number;
  scrollPreviousItemPeek: number;
  visibleMessageIds: Set<string>;
  viewportElement: HTMLElement;
}) => {
  const anchorLine = viewportElement.getBoundingClientRect().top + scrollMargin + scrollPreviousItemPeek;
  const anchors = items.filter(([, item]) => item.scrollAnchor);
  let anchoredAboveViewport: string | undefined;

  for (const [messageId, item] of anchors) {
    if (item.element.getBoundingClientRect().top <= anchorLine + VISIBILITY_EPSILON) {
      anchoredAboveViewport = messageId;
    }
  }

  if (anchoredAboveViewport) return anchoredAboveViewport;
  return anchors.find(([messageId]) => visibleMessageIds.has(messageId))?.[0] ?? fallbackAnchorId;
};
