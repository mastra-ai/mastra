import { ArrowDownIcon } from 'lucide-react';
import * as React from 'react';

import {
  AUTO_SCROLL_ATTACH_THRESHOLD,
  DEFAULT_REACH_START_THRESHOLD,
  DEFAULT_SCROLL_EDGE_THRESHOLD,
  DEFAULT_SCROLL_MARGIN,
  DEFAULT_SCROLL_PREVIOUS_ITEM_PEEK,
  DEFAULT_SCROLLABLE,
  DEFAULT_VISIBILITY,
  MessageScrollerActionsContext,
  MessageScrollerScrollableContext,
  MessageScrollerVisibilityContext,
  useRequiredMessageScrollerActionsContext,
  useRequiredMessageScrollerScrollableContext,
} from './message-scroller-context';
import type {
  MessageScrollerActionsContextValue,
  MessageScrollerButtonDirection,
  MessageScrollerDefaultScrollPosition,
  MessageScrollerScrollAlign,
  MessageScrollerScrollOptions,
  MessageScrollerScrollable,
  MessageScrollerVisibility,
} from './message-scroller-context';

import { cn } from '@/lib/utils';

export type {
  MessageScrollerButtonDirection,
  MessageScrollerDefaultScrollPosition,
  MessageScrollerScrollAlign,
  MessageScrollerScrollOptions,
  MessageScrollerScrollable,
  MessageScrollerVisibility,
} from './message-scroller-context';

type MessageScrollerItemRecord = {
  element: HTMLElement;
  scrollAnchor: boolean;
};

const VISIBILITY_EPSILON = 0.5;

const mergeRefs =
  <TElement,>(...refs: Array<React.Ref<TElement> | undefined>) =>
  (element: TElement | null) => {
    refs.forEach(ref => {
      if (!ref) return;
      if (typeof ref === 'function') {
        ref(element);
        return;
      }
      ref.current = element;
    });
  };

const scrollableMatches = (left: MessageScrollerScrollable, right: MessageScrollerScrollable) =>
  left.start === right.start && left.end === right.end;

const visibilityMatches = (left: MessageScrollerVisibility, right: MessageScrollerVisibility) =>
  left.currentAnchorId === right.currentAnchorId &&
  left.visibleMessageIds.length === right.visibleMessageIds.length &&
  left.visibleMessageIds.every((messageId, index) => messageId === right.visibleMessageIds[index]);

const orderItemsByDocumentPosition = (items: Array<readonly [string, MessageScrollerItemRecord]>) =>
  items.sort(([, left], [, right]) => {
    const position = left.element.compareDocumentPosition(right.element);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });

const getContentPadding = (contentElement: HTMLElement | null) => {
  if (!contentElement) return { start: 0, end: 0 };
  const styles = window.getComputedStyle(contentElement);
  return {
    start: Number.parseFloat(styles.paddingBlockStart || styles.paddingTop || '0') || 0,
    end: Number.parseFloat(styles.paddingBlockEnd || styles.paddingBottom || '0') || 0,
  };
};

const getRelativeTop = (element: HTMLElement, viewportElement: HTMLElement) => {
  const elementRect = element.getBoundingClientRect();
  const viewportRect = viewportElement.getBoundingClientRect();
  return elementRect.top - viewportRect.top + viewportElement.scrollTop;
};

const scrollViewportTo = (viewportElement: HTMLElement, top: number, behavior: ScrollBehavior) => {
  if (typeof viewportElement.scrollTo === 'function') {
    viewportElement.scrollTo({ top, behavior });
    return;
  }

  viewportElement.scrollTop = top;
};

const scheduleScrollSync = (callback: () => void) => {
  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(callback);
    return;
  }

  window.setTimeout(callback, 0);
};

const getScrollTarget = ({
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

const getCurrentAnchorId = ({
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

export interface MessageScrollerProviderProps {
  autoScroll?: boolean;
  children?: React.ReactNode;
  defaultScrollPosition?: MessageScrollerDefaultScrollPosition;
  /** Called when the reader scrolls near the start — where older history is loaded. */
  onReachStart?: () => void;
  /** Hold the reading position when older items are added above the current ones. */
  preserveScrollOnPrepend?: boolean;
  reachStartThreshold?: number;
  scrollEdgeThreshold?: number;
  scrollMargin?: number;
  scrollPreviousItemPeek?: number;
}

export function MessageScrollerProvider({
  autoScroll = false,
  children,
  defaultScrollPosition = 'end',
  onReachStart,
  preserveScrollOnPrepend = false,
  reachStartThreshold = DEFAULT_REACH_START_THRESHOLD,
  scrollEdgeThreshold = DEFAULT_SCROLL_EDGE_THRESHOLD,
  scrollMargin = DEFAULT_SCROLL_MARGIN,
  scrollPreviousItemPeek = DEFAULT_SCROLL_PREVIOUS_ITEM_PEEK,
}: MessageScrollerProviderProps) {
  const itemsRef = React.useRef<Map<string, MessageScrollerItemRecord> | null>(null);
  itemsRef.current ??= new Map<string, MessageScrollerItemRecord>();
  const itemsRegistry = itemsRef.current;
  // Rebuilt on register/unregister only — scroll runs this too often to sort per event.
  const orderedItemsRef = React.useRef<Array<readonly [string, MessageScrollerItemRecord]> | null>(null);
  const visibleMessageIdsRef = React.useRef<Set<string> | null>(null);
  visibleMessageIdsRef.current ??= new Set<string>();
  const intersectingMessageIds = visibleMessageIdsRef.current;
  const [itemsVersion, setItemsVersion] = React.useState(0);
  const [rootElement, setRootElement] = React.useState<HTMLDivElement | null>(null);
  const [viewportElement, setViewportElement] = React.useState<HTMLDivElement | null>(null);
  const [contentElement, setContentElement] = React.useState<HTMLDivElement | null>(null);
  const defaultScrollAppliedRef = React.useRef(false);
  const [scrollable, setScrollable] = React.useState<MessageScrollerScrollable>(DEFAULT_SCROLLABLE);
  const [visibility, setVisibility] = React.useState<MessageScrollerVisibility>(DEFAULT_VISIBILITY);
  const atEndRef = React.useRef(true);
  // Mount sits at scrollTop 0 before the default scroll lands, indistinguishable
  // from a reader asking for older history. Arms only once settled at the end.
  const reachStartArmedRef = React.useRef(false);
  const reachStartFiredRef = React.useRef(false);
  const prependAnchorRef = React.useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const firstItemIdRef = React.useRef<string | undefined>(undefined);
  // Off notifyScroll's deps on purpose: consumers pass it inline, and a fresh
  // identity per render would republish the actions context to every consumer.
  const onReachStartRef = React.useRef(onReachStart);
  React.useEffect(() => {
    onReachStartRef.current = onReachStart;
  }, [onReachStart]);

  const publishScrollable = React.useCallback(
    (nextScrollable: MessageScrollerScrollable) => {
      const scrollableValue = [nextScrollable.start && 'start', nextScrollable.end && 'end'].filter(Boolean).join(' ');

      for (const element of [rootElement, viewportElement]) {
        if (!element) continue;
        if (scrollableValue) {
          element.setAttribute('data-scrollable', scrollableValue);
        } else {
          element.removeAttribute('data-scrollable');
        }
      }

      setScrollable(current => (scrollableMatches(current, nextScrollable) ? current : nextScrollable));
    },
    [rootElement, viewportElement],
  );

  const publishVisibility = React.useCallback((nextVisibility: MessageScrollerVisibility) => {
    setVisibility(current => (visibilityMatches(current, nextVisibility) ? current : nextVisibility));
  }, []);

  const updateScrollable = React.useCallback(() => {
    if (!viewportElement) {
      atEndRef.current = true;
      publishScrollable(DEFAULT_SCROLLABLE);
      return;
    }

    const remainingScroll = viewportElement.scrollHeight - viewportElement.scrollTop - viewportElement.clientHeight;
    atEndRef.current = remainingScroll < AUTO_SCROLL_ATTACH_THRESHOLD;
    publishScrollable({
      start: viewportElement.scrollTop > scrollEdgeThreshold,
      end: remainingScroll > scrollEdgeThreshold,
    });
  }, [publishScrollable, scrollEdgeThreshold, viewportElement]);

  const updateVisibility = React.useCallback(() => {
    // Registration is mount order, not document order, once history is prepended.
    orderedItemsRef.current ??= orderItemsByDocumentPosition(Array.from(itemsRegistry.entries()));
    const items = orderedItemsRef.current;
    const fallbackAnchorId = items.filter(([, item]) => item.scrollAnchor).at(-1)?.[0] ?? items.at(-1)?.[0];

    if (items.length === 0) {
      publishVisibility(DEFAULT_VISIBILITY);
      return;
    }

    if (!viewportElement) {
      publishVisibility({
        currentAnchorId: fallbackAnchorId,
        visibleMessageIds: fallbackAnchorId ? [fallbackAnchorId] : [],
      });
      return;
    }

    const viewportRect = viewportElement.getBoundingClientRect();
    const visibleMessageIds = new Set<string>();

    if (typeof IntersectionObserver === 'undefined') {
      const visibilityTop = viewportRect.top + scrollMargin + scrollPreviousItemPeek;
      items.forEach(([messageId, item]) => {
        const rect = item.element.getBoundingClientRect();
        if (rect.bottom > visibilityTop && rect.top < viewportRect.bottom) visibleMessageIds.add(messageId);
      });
    } else {
      intersectingMessageIds.forEach(messageId => visibleMessageIds.add(messageId));
    }

    const orderedVisibleMessageIds = items.flatMap(([messageId]) =>
      visibleMessageIds.has(messageId) ? [messageId] : [],
    );

    publishVisibility({
      currentAnchorId: getCurrentAnchorId({
        fallbackAnchorId,
        items,
        scrollMargin,
        scrollPreviousItemPeek,
        visibleMessageIds,
        viewportElement,
      }),
      visibleMessageIds:
        orderedVisibleMessageIds.length > 0 ? orderedVisibleMessageIds : fallbackAnchorId ? [fallbackAnchorId] : [],
    });
  }, [intersectingMessageIds, itemsRegistry, publishVisibility, scrollMargin, scrollPreviousItemPeek, viewportElement]);

  const syncAfterScroll = React.useCallback(() => {
    updateScrollable();
    updateVisibility();
  }, [updateScrollable, updateVisibility]);

  const notifyScroll = React.useCallback(() => {
    const wasScrollable = Boolean(viewportElement && viewportElement.scrollHeight > viewportElement.clientHeight);
    syncAfterScroll();
    if (!viewportElement) return;

    if (atEndRef.current && wasScrollable) reachStartArmedRef.current = true;

    if (!reachStartArmedRef.current) return;
    if (!wasScrollable) return;
    if (viewportElement.scrollTop > reachStartThreshold) {
      reachStartFiredRef.current = false;
      return;
    }
    // One request per trip to the start: staying there must not queue a second.
    if (reachStartFiredRef.current) return;
    if (!onReachStartRef.current) return;

    reachStartFiredRef.current = true;
    if (preserveScrollOnPrepend) {
      prependAnchorRef.current = {
        scrollHeight: viewportElement.scrollHeight,
        scrollTop: viewportElement.scrollTop,
      };
    }
    onReachStartRef.current();
  }, [preserveScrollOnPrepend, reachStartThreshold, syncAfterScroll, viewportElement]);

  const notifyContentResize = React.useCallback(() => {
    const followEnd = autoScroll && defaultScrollAppliedRef.current && atEndRef.current && viewportElement;
    if (followEnd) {
      scrollViewportTo(
        viewportElement,
        Math.max(0, viewportElement.scrollHeight - viewportElement.clientHeight),
        'auto',
      );
    }
    syncAfterScroll();
  }, [autoScroll, syncAfterScroll, viewportElement]);

  const scrollToElement = React.useCallback(
    (
      element: HTMLElement,
      {
        align = 'start',
        behavior = 'auto',
        scrollMargin: optionScrollMargin = scrollMargin,
      }: MessageScrollerScrollOptions = {},
    ) => {
      if (!viewportElement || !contentElement?.contains(element)) return false;

      const nextScrollTop = Math.max(
        0,
        getScrollTarget({ align, element, scrollMargin: optionScrollMargin, viewportElement }),
      );

      if (Math.abs(viewportElement.scrollTop - nextScrollTop) <= VISIBILITY_EPSILON) {
        scrollViewportTo(viewportElement, nextScrollTop, 'auto');
        syncAfterScroll();
        return true;
      }

      scrollViewportTo(viewportElement, nextScrollTop, behavior);
      scheduleScrollSync(syncAfterScroll);
      return true;
    },
    [contentElement, scrollMargin, syncAfterScroll, viewportElement],
  );

  const scrollToStart = React.useCallback(
    ({ behavior = 'auto' }: MessageScrollerScrollOptions = {}) => {
      if (!viewportElement) return false;
      scrollViewportTo(viewportElement, 0, behavior);
      scheduleScrollSync(syncAfterScroll);
      return true;
    },
    [syncAfterScroll, viewportElement],
  );

  const scrollToEnd = React.useCallback(
    ({ behavior = 'auto' }: MessageScrollerScrollOptions = {}) => {
      if (!viewportElement) return false;
      scrollViewportTo(
        viewportElement,
        Math.max(0, viewportElement.scrollHeight - viewportElement.clientHeight),
        behavior,
      );
      scheduleScrollSync(syncAfterScroll);
      return true;
    },
    [syncAfterScroll, viewportElement],
  );

  const scrollToMessage = React.useCallback(
    (messageId: string, options?: MessageScrollerScrollOptions) => {
      const item = itemsRegistry.get(messageId);
      if (!item) return false;
      return scrollToElement(item.element, options);
    },
    [itemsRegistry, scrollToElement],
  );

  const registerItem = React.useCallback(
    (messageId: string, element: HTMLElement, scrollAnchor: boolean) => {
      itemsRegistry.set(messageId, { element, scrollAnchor });
      orderedItemsRef.current = null;
      setItemsVersion(version => version + 1);

      return () => {
        const current = itemsRegistry.get(messageId);
        if (current?.element !== element) return;
        itemsRegistry.delete(messageId);
        intersectingMessageIds.delete(messageId);
        orderedItemsRef.current = null;
        setItemsVersion(version => version + 1);
      };
    },
    [intersectingMessageIds, itemsRegistry],
  );

  React.useEffect(() => {
    if (!contentElement || !viewportElement || typeof IntersectionObserver === 'undefined') {
      updateVisibility();
      return undefined;
    }

    const messageIdByElement = new Map<Element, string>();
    for (const [messageId, item] of itemsRegistry) {
      messageIdByElement.set(item.element, messageId);
    }

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          const messageId = messageIdByElement.get(entry.target);
          if (!messageId) continue;
          if (entry.isIntersecting) {
            intersectingMessageIds.add(messageId);
          } else {
            intersectingMessageIds.delete(messageId);
          }
        }
        updateVisibility();
      },
      {
        root: viewportElement,
        rootMargin: `${-(scrollMargin + scrollPreviousItemPeek)}px 0px 0px 0px`,
        threshold: [0, 0.01, 0.5, 1],
      },
    );

    for (const [, item] of itemsRegistry) observer.observe(item.element);
    updateVisibility();

    return () => observer.disconnect();
  }, [
    contentElement,
    intersectingMessageIds,
    itemsRegistry,
    itemsVersion,
    scrollMargin,
    scrollPreviousItemPeek,
    updateVisibility,
    viewportElement,
  ]);

  React.useEffect(() => {
    if (!viewportElement || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(syncAfterScroll);
    observer.observe(viewportElement);
    return () => observer.disconnect();
  }, [syncAfterScroll, viewportElement]);

  React.useLayoutEffect(() => {
    updateScrollable();
    updateVisibility();
  }, [itemsVersion, updateScrollable, updateVisibility]);

  React.useLayoutEffect(() => {
    if (defaultScrollAppliedRef.current || !viewportElement || itemsRegistry.size === 0) return;

    let didScroll = false;
    if (defaultScrollPosition === 'start') {
      didScroll = scrollToStart({ behavior: 'auto' });
    } else if (defaultScrollPosition === 'last-anchor') {
      const lastAnchorId = Array.from(itemsRegistry.entries())
        .filter(([, item]) => item.scrollAnchor)
        .at(-1)?.[0];
      didScroll = lastAnchorId
        ? scrollToMessage(lastAnchorId, { align: 'start', behavior: 'auto' })
        : scrollToEnd({ behavior: 'auto' });
    } else {
      didScroll = scrollToEnd({ behavior: 'auto' });
    }

    if (didScroll) defaultScrollAppliedRef.current = true;
  }, [
    defaultScrollPosition,
    itemsRegistry,
    itemsVersion,
    scrollToEnd,
    scrollToMessage,
    scrollToStart,
    viewportElement,
  ]);

  // Older items land above the reader and shove their position down. A prepend is
  // told from an append by the first item's id, then undone by offsetting
  // scrollTop by however much taller the content got.
  React.useLayoutEffect(() => {
    const previousFirstItemId = firstItemIdRef.current;
    // From the DOM, not the registry: prepended items register last, so registry
    // order stops matching reading order.
    const firstItemId = contentElement?.querySelector<HTMLElement>('[data-slot="message-scroller-item"]')?.dataset
      .messageId;
    firstItemIdRef.current = firstItemId;

    const anchor = prependAnchorRef.current;
    prependAnchorRef.current = null;
    if (!anchor || !viewportElement || firstItemId === previousFirstItemId) return;

    reachStartFiredRef.current = false;
    const grownBy = viewportElement.scrollHeight - anchor.scrollHeight;
    if (grownBy > 0) viewportElement.scrollTop = anchor.scrollTop + grownBy;
  }, [contentElement, itemsVersion, viewportElement]);

  React.useLayoutEffect(() => {
    if (!autoScroll || !defaultScrollAppliedRef.current || !atEndRef.current) return;
    scrollToEnd({ behavior: 'auto' });
  }, [autoScroll, itemsVersion, scrollToEnd]);

  const actionsContextValue = React.useMemo<MessageScrollerActionsContextValue>(
    () => ({
      notifyContentResize,
      notifyScroll,
      registerItem,
      scrollToEnd,
      scrollToMessage,
      scrollToStart,
      setContentElement,
      setRootElement,
      setViewportElement,
      syncAfterScroll,
    }),
    [notifyContentResize, notifyScroll, registerItem, scrollToEnd, scrollToMessage, scrollToStart, syncAfterScroll],
  );

  const scrollableContextValue = React.useMemo<MessageScrollerScrollable>(
    () => ({
      end: scrollable.end,
      start: scrollable.start,
    }),
    [scrollable.end, scrollable.start],
  );

  const visibilityContextValue = React.useMemo<MessageScrollerVisibility>(
    () => ({
      currentAnchorId: visibility.currentAnchorId,
      visibleMessageIds: visibility.visibleMessageIds,
    }),
    [visibility.currentAnchorId, visibility.visibleMessageIds],
  );

  return (
    <MessageScrollerActionsContext.Provider value={actionsContextValue}>
      <MessageScrollerScrollableContext.Provider value={scrollableContextValue}>
        <MessageScrollerVisibilityContext.Provider value={visibilityContextValue}>
          {children}
        </MessageScrollerVisibilityContext.Provider>
      </MessageScrollerScrollableContext.Provider>
    </MessageScrollerActionsContext.Provider>
  );
}

export type MessageScrollerProps = React.HTMLAttributes<HTMLDivElement>;

export const MessageScroller = React.forwardRef<HTMLDivElement, MessageScrollerProps>(
  ({ className, ...props }, ref) => {
    const { setRootElement } = useRequiredMessageScrollerActionsContext('MessageScroller');
    return (
      <div
        ref={mergeRefs(setRootElement, ref)}
        data-slot="message-scroller"
        className={cn('group/message-scroller relative flex size-full min-h-0 flex-col overflow-hidden', className)}
        {...props}
      />
    );
  },
);
MessageScroller.displayName = 'MessageScroller';

export type MessageScrollerViewportProps = React.HTMLAttributes<HTMLDivElement>;

export const MessageScrollerViewport = React.forwardRef<HTMLDivElement, MessageScrollerViewportProps>(
  ({ className, onScroll, role, tabIndex, ...props }, ref) => {
    const { setViewportElement, notifyScroll } = useRequiredMessageScrollerActionsContext('MessageScrollerViewport');
    const viewportRef = React.useMemo(() => mergeRefs(setViewportElement, ref), [ref, setViewportElement]);

    return (
      <div
        ref={viewportRef}
        role={role ?? 'region'}
        tabIndex={tabIndex ?? 0}
        data-slot="message-scroller-viewport"
        className={cn(
          'size-full min-h-0 min-w-0 overflow-y-auto overscroll-contain data-autoscrolling:scrollbar-thumb-transparent data-autoscrolling:scrollbar-track-transparent',
          className,
        )}
        onScroll={event => {
          notifyScroll();
          onScroll?.(event);
        }}
        {...props}
      />
    );
  },
);
MessageScrollerViewport.displayName = 'MessageScrollerViewport';

export type MessageScrollerContentProps = React.HTMLAttributes<HTMLDivElement> & {
  spacerClassName?: string;
};

export const MessageScrollerContent = React.forwardRef<HTMLDivElement, MessageScrollerContentProps>(
  ({ children, className, spacerClassName, role, 'aria-relevant': ariaRelevant = 'additions', ...props }, ref) => {
    const { setContentElement, notifyContentResize, syncAfterScroll } =
      useRequiredMessageScrollerActionsContext('MessageScrollerContent');
    const [contentElement, setLocalContentElement] = React.useState<HTMLDivElement | null>(null);

    const contentRef = React.useMemo(
      () => mergeRefs<HTMLDivElement>(setContentElement, setLocalContentElement, ref),
      [ref, setContentElement],
    );

    React.useLayoutEffect(() => {
      syncAfterScroll();
    }, [syncAfterScroll]);

    React.useEffect(() => {
      if (!contentElement || typeof MutationObserver === 'undefined') return undefined;
      const observer = new MutationObserver(notifyContentResize);
      observer.observe(contentElement, { childList: true, subtree: false });
      return () => observer.disconnect();
    }, [contentElement, notifyContentResize]);

    React.useEffect(() => {
      if (!contentElement || typeof ResizeObserver === 'undefined') return undefined;
      const observer = new ResizeObserver(notifyContentResize);
      observer.observe(contentElement);
      return () => observer.disconnect();
    }, [contentElement, notifyContentResize]);

    return (
      <div
        ref={contentRef}
        role={role ?? 'log'}
        aria-relevant={ariaRelevant}
        data-slot="message-scroller-content"
        className={cn('flex h-max min-h-full flex-col gap-6', className)}
        {...props}
      >
        {children}
        <div aria-hidden="true" data-message-scroller-spacer="" hidden className={spacerClassName} />
      </div>
    );
  },
);
MessageScrollerContent.displayName = 'MessageScrollerContent';

export type MessageScrollerItemProps = React.HTMLAttributes<HTMLDivElement> & {
  messageId?: string;
  scrollAnchor?: boolean;
};

export const MessageScrollerItem = React.forwardRef<HTMLDivElement, MessageScrollerItemProps>(
  ({ className, messageId, scrollAnchor = false, ...props }, ref) => {
    // Optional, unlike the other slots: the same row renderer is reused outside a
    // scroller (draft pages, previews), where there is simply nothing to register.
    const registerItem = React.useContext(MessageScrollerActionsContext)?.registerItem;
    const unregisterRef = React.useRef<(() => void) | undefined>(undefined);
    const itemRef = React.useCallback(
      (element: HTMLDivElement | null) => {
        unregisterRef.current?.();
        unregisterRef.current = undefined;
        mergeRefs(ref)(element);

        if (!element || !messageId || !registerItem) return;
        unregisterRef.current = registerItem(messageId, element, scrollAnchor);
      },
      [messageId, ref, registerItem, scrollAnchor],
    );

    return (
      <div
        ref={itemRef}
        data-slot="message-scroller-item"
        data-message-id={messageId}
        data-scroll-anchor={scrollAnchor ? 'true' : 'false'}
        className={cn('min-w-0 shrink-0 [contain-intrinsic-size:auto_10rem] [content-visibility:auto]', className)}
        {...props}
      />
    );
  },
);
MessageScrollerItem.displayName = 'MessageScrollerItem';

export type MessageScrollerButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  behavior?: ScrollBehavior;
  children?: React.ReactNode;
  direction?: MessageScrollerButtonDirection;
};

export const MessageScrollerButton = React.forwardRef<HTMLButtonElement, MessageScrollerButtonProps>(
  (
    { behavior = 'smooth', direction = 'end', className, children, onClick, tabIndex, type = 'button', ...props },
    ref,
  ) => {
    const { scrollToEnd, scrollToStart } = useRequiredMessageScrollerActionsContext('MessageScrollerButton');
    const { start, end } = useRequiredMessageScrollerScrollableContext('MessageScrollerButton');
    const active = direction === 'start' ? start : end;

    return (
      <button
        ref={ref}
        type={type}
        {...props}
        data-slot="message-scroller-button"
        data-active={active ? 'true' : 'false'}
        data-direction={direction}
        tabIndex={active ? tabIndex : -1}
        className={cn(
          'absolute inset-s-1/2 inline-flex min-h-5 min-w-7 -translate-x-1/2 items-center justify-center rounded-full border border-border1 bg-surface3 text-neutral6 shadow-[0_1px_2px_-1px_oklch(0%_0_0deg/10%),0_8px_20px_-12px_oklch(0%_0_0deg/25%)] transition-[translate,scale,opacity] duration-200 hover:bg-surface4 data-[active=false]:pointer-events-none data-[active=false]:scale-95 data-[active=false]:opacity-0 data-[active=false]:duration-400 data-[active=false]:ease-[cubic-bezier(0.7,0,0.84,0)] data-[active=true]:translate-y-0 data-[active=true]:scale-100 data-[active=true]:opacity-100 data-[active=true]:ease-[cubic-bezier(0.23,1,0.32,1)] data-[direction=end]:bottom-4 data-[direction=end]:data-[active=false]:translate-y-full data-[direction=start]:top-4 data-[direction=start]:data-[active=false]:-translate-y-full rtl:translate-x-1/2 data-[direction=start]:[&_svg]:rotate-180',
          className,
        )}
        onClick={event => {
          if (!active) return;
          onClick?.(event);
          if (event.defaultPrevented) return;
          event.currentTarget.blur();
          if (direction === 'start') {
            scrollToStart({ behavior });
          } else {
            scrollToEnd({ behavior });
          }
        }}
      >
        {children ?? (
          <>
            <ArrowDownIcon className="size-4" aria-hidden />
            <span className="sr-only">{direction === 'end' ? 'Scroll to end' : 'Scroll to start'}</span>
          </>
        )}
      </button>
    );
  },
);
MessageScrollerButton.displayName = 'MessageScrollerButton';
