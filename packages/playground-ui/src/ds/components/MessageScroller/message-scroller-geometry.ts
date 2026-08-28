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

export const getMaxScroll = (viewportElement: HTMLElement) =>
  Math.max(0, viewportElement.scrollHeight - viewportElement.clientHeight);

export const getRelativeTop = (element: HTMLElement, viewportElement: HTMLElement) => {
  const elementRect = element.getBoundingClientRect();
  const viewportRect = viewportElement.getBoundingClientRect();
  return elementRect.top - viewportRect.top + viewportElement.scrollTop;
};

export const getScrollTarget = ({
  align,
  contentElement,
  element,
  scrollMargin,
  viewportElement,
}: {
  align: MessageScrollerScrollAlign;
  /** The padding framing the transcript lives here, however deep the rows nest. */
  contentElement: HTMLElement | null;
  element: HTMLElement;
  scrollMargin: number;
  viewportElement: HTMLElement;
}) => {
  const contentPadding = getContentPadding(contentElement);
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

/**
 * Where the reader must sit for the last row to rest at the end of the view.
 *
 * Not the end of the scroll: a chat reserves room under a live turn so a reply
 * grows into empty space, and docks its composer in the flow. Both sit below the
 * last row, so scrolling to the end of the box carries that row — and the message
 * that opened the turn — out of the view above. Reading it from the rows means no
 * one has to publish a height for anyone else to subtract.
 */
export const getFollowTarget = ({
  contentElement,
  items,
  viewportElement,
}: {
  contentElement: HTMLElement | null;
  items: Array<readonly [string, MessageScrollerItemRecord]>;
  viewportElement: HTMLElement;
}) => {
  const end = getMaxScroll(viewportElement);
  const lastRow = items.at(-1)?.[1].element;
  if (!lastRow || !contentElement) return end;

  const contentBottom = getRelativeTop(contentElement, viewportElement) + contentElement.getBoundingClientRect().height;
  const belowContent = Math.max(0, viewportElement.scrollHeight - contentBottom);
  const rowBottom = getRelativeTop(lastRow, viewportElement) + lastRow.getBoundingClientRect().height;

  return Math.min(end, Math.max(0, rowBottom + belowContent - viewportElement.clientHeight));
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
