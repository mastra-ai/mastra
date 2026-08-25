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

import {
  VISIBILITY_EPSILON,
  getCurrentAnchorId,
  getFollowTarget,
  getMaxScroll,
  getScrollTarget,
} from './message-scroller-geometry';
import type { MessageScrollerItemRecord } from './message-scroller-geometry';
import { glideContent } from './message-scroller-glide';
import { startTrip } from './message-scroller-trip';
import type { TripAnimation } from './message-scroller-trip';

import { cn } from '@/lib/utils';

export type {
  MessageScrollerButtonDirection,
  MessageScrollerDefaultScrollPosition,
  MessageScrollerScrollAlign,
  MessageScrollerScrollOptions,
  MessageScrollerScrollable,
  MessageScrollerVisibility,
} from './message-scroller-context';

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

export interface MessageScrollerProviderProps {
  /** Carry the reader with the stream, re-attaching on a new turn. Off still parks a new turn, without following the reply. */
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
  const deferDefaultScrollRef = React.useRef(false);
  const defaultScrollScheduledRef = React.useRef(false);
  const seenAnchorIdsRef = React.useRef<Set<string> | null>(null);
  seenAnchorIdsRef.current ??= new Set<string>();
  const seenAnchorIds = seenAnchorIdsRef.current;
  // Message ID reconciliation keeps the row element while replacing its ID.
  const seenAnchorElementsRef = React.useRef<WeakSet<HTMLElement> | null>(null);
  seenAnchorElementsRef.current ??= new WeakSet<HTMLElement>();
  const seenAnchorElements = seenAnchorElementsRef.current;
  const turnAnchoringArmedRef = React.useRef(false);
  const [scrollable, setScrollable] = React.useState<MessageScrollerScrollable>(DEFAULT_SCROLLABLE);
  const [visibility, setVisibility] = React.useState<MessageScrollerVisibility>(DEFAULT_VISIBILITY);
  const atEndRef = React.useRef(true);
  // Attachment is a mode, not a measurement: a growing reply moves the end away
  // without the reader having moved, so only the reader detaches it.
  const followingRef = React.useRef(true);
  // A smooth trip in flight, remembered by destination — the end of the stream, or
  // the anchor a new turn parks at. Sampled mid-flight it reads as a reader who
  // left, so it suspends detachment; a position going backwards calls it off.
  const tripRef = React.useRef<'end' | { anchorId: string } | null>(null);
  // The frame loop behind an anchor trip. Owns clearing its trip: it alone can
  // tell the reader taking over from its own writes landing.
  const tripAnimationRef = React.useRef<TripAnimation | null>(null);
  const lastScrollTopRef = React.useRef(0);
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

  // Registration is mount order, not document order, once history is prepended.
  const getOrderedItems = React.useCallback(() => {
    orderedItemsRef.current ??= orderItemsByDocumentPosition(Array.from(itemsRegistry.entries()));
    return orderedItemsRef.current;
  }, [itemsRegistry]);

  // The one definition of "the end" — following it, resting at it, offering the trip
  // back to it. Everything below the last row (reserved room, the docked composer)
  // is room to grow into, never somewhere to scroll.
  const followTarget = React.useCallback(() => {
    if (!viewportElement) return 0;

    return getFollowTarget({ contentElement, items: getOrderedItems(), viewportElement });
  }, [contentElement, getOrderedItems, viewportElement]);

  const anchorTripTarget = React.useCallback(
    (anchorId: string) => {
      const item = itemsRegistry.get(anchorId);
      if (!item || !viewportElement) return undefined;
      return Math.max(
        0,
        getScrollTarget({ align: 'start', contentElement, element: item.element, scrollMargin, viewportElement }),
      );
    },
    [contentElement, itemsRegistry, scrollMargin, viewportElement],
  );

  // The motion's destination, never the decision's: the room under a fresh turn is
  // still opening when the trip starts — on a short thread the box has not even
  // grown yet — so the cap is re-read per frame and the trip rides the end of the
  // box until the opened room decides where the message rests.
  const parkTripTarget = React.useCallback(
    (anchorId: string) => {
      const target = anchorTripTarget(anchorId);
      if (target === undefined || !viewportElement) return target;
      return Math.min(target, getMaxScroll(viewportElement));
    },
    [anchorTripTarget, viewportElement],
  );

  const cancelTripAnimation = React.useCallback(() => {
    tripAnimationRef.current?.cancel();
    tripAnimationRef.current = null;
  }, []);

  const updateScrollable = React.useCallback(
    ({ fromScroll = false }: { fromScroll?: boolean } = {}) => {
      if (!viewportElement) {
        atEndRef.current = true;
        publishScrollable(DEFAULT_SCROLLABLE);
        return;
      }

      const { scrollTop } = viewportElement;
      const remainingScroll = followTarget() - scrollTop;
      const wentBack = scrollTop < lastScrollTopRef.current;
      atEndRef.current = remainingScroll < AUTO_SCROLL_ATTACH_THRESHOLD;
      if (tripRef.current === 'end' && (wentBack || atEndRef.current)) tripRef.current = null;
      lastScrollTopRef.current = scrollTop;
      // Scrolling back is the only way out of the stream, the end the only way back in:
      // a position merely left behind by a growing reply is us chasing it, not them leaving.
      if (fromScroll && tripRef.current === null && (wentBack || atEndRef.current)) {
        followingRef.current = atEndRef.current;
      }

      publishScrollable({
        start: scrollTop > scrollEdgeThreshold,
        end: remainingScroll > scrollEdgeThreshold && !(autoScroll && followingRef.current),
      });
    },
    [autoScroll, followTarget, publishScrollable, scrollEdgeThreshold, viewportElement],
  );

  const getLastAnchorId = React.useCallback(
    () =>
      getOrderedItems()
        .filter(([, item]) => item.scrollAnchor)
        .at(-1)?.[0],
    [getOrderedItems],
  );

  const updateVisibility = React.useCallback(() => {
    const items = getOrderedItems();
    const fallbackAnchorId = getLastAnchorId() ?? items.at(-1)?.[0];

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
  }, [
    getLastAnchorId,
    getOrderedItems,
    intersectingMessageIds,
    publishVisibility,
    scrollMargin,
    scrollPreviousItemPeek,
    viewportElement,
  ]);

  const syncAfterScroll = React.useCallback(() => {
    updateScrollable();
    updateVisibility();
  }, [updateScrollable, updateVisibility]);

  const notifyScroll = React.useCallback(() => {
    const wasScrollable = Boolean(viewportElement && viewportElement.scrollHeight > viewportElement.clientHeight);
    updateScrollable({ fromScroll: true });
    updateVisibility();
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
  }, [preserveScrollOnPrepend, reachStartThreshold, updateScrollable, updateVisibility, viewportElement]);

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
        getScrollTarget({ align, contentElement, element, scrollMargin: optionScrollMargin, viewportElement }),
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
      cancelTripAnimation();
      tripRef.current = null;
      scrollViewportTo(viewportElement, 0, behavior);
      scheduleScrollSync(syncAfterScroll);
      return true;
    },
    [cancelTripAnimation, syncAfterScroll, viewportElement],
  );

  const scrollToEnd = React.useCallback(
    ({ behavior = 'auto' }: MessageScrollerScrollOptions = {}) => {
      if (!viewportElement) return false;
      cancelTripAnimation();
      followingRef.current = true;
      tripRef.current = behavior === 'smooth' ? 'end' : null;
      scrollViewportTo(viewportElement, followTarget(), behavior);
      // Published now, not next frame: a button that hears about the trip late flashes.
      syncAfterScroll();
      scheduleScrollSync(syncAfterScroll);
      return true;
    },
    [cancelTripAnimation, followTarget, syncAfterScroll, viewportElement],
  );

  const scrollToMessage = React.useCallback(
    (messageId: string, options?: MessageScrollerScrollOptions) => {
      const item = itemsRegistry.get(messageId);
      if (!item) return false;
      return scrollToElement(item.element, options);
    },
    [itemsRegistry, scrollToElement],
  );

  // A reply grows into the room its turn reserved and moves nothing: only once the
  // last row would fall past the end of the view is there anything to follow, and
  // then by exactly what it overflowed — pinned instantly, glided on the compositor.
  const notifyContentResize = React.useCallback(() => {
    const trip = tripRef.current;
    const onAnchorTrip = trip !== null && trip !== 'end';
    // An anchor trip re-reads its destination every frame, so a layout settling
    // under it — the reserved room opening — bends its path without help from here.
    if (!onAnchorTrip && autoScroll && defaultScrollAppliedRef.current && followingRef.current && viewportElement) {
      const overflow = followTarget() - viewportElement.scrollTop;
      if (overflow > VISIBILITY_EPSILON) {
        // A trip already in flight is retargeted rather than cut short; only the
        // instant catch-up needs the glide to read as one movement.
        const travelling = trip === 'end';
        scrollViewportTo(viewportElement, followTarget(), travelling ? 'smooth' : 'auto');
        if (!travelling) glideContent(contentElement, overflow);
      }
    }
    syncAfterScroll();
  }, [autoScroll, contentElement, followTarget, syncAfterScroll, viewportElement]);

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
    if (defaultScrollAppliedRef.current || !viewportElement) return undefined;
    if (itemsRegistry.size === 0) {
      deferDefaultScrollRef.current = true;
      return undefined;
    }

    const applyDefaultScroll = () => {
      const lastAnchorId = getLastAnchorId();
      // Where a thread opens decides whether it starts attached: a restored reading
      // position has the stream below it. `scrollToEnd` takes this back when it lands.
      followingRef.current = false;
      let didScroll = false;
      if (defaultScrollPosition === 'start') {
        didScroll = scrollToStart({ behavior: 'auto' });
      } else if (defaultScrollPosition === 'last-anchor') {
        didScroll = lastAnchorId
          ? scrollToMessage(lastAnchorId, { align: 'start', behavior: 'auto' })
          : scrollToEnd({ behavior: 'auto' });
      } else {
        didScroll = scrollToEnd({ behavior: 'auto' });
      }

      if (!didScroll) return;
      defaultScrollAppliedRef.current = true;
      // Settling is what arms turn anchoring: the rows the transcript opened with
      // are recorded as read here, and on a settled thread the next anchor to
      // register is the send itself — an arming left to a later anchoring pass
      // would be eaten by that send instead of parking it.
      for (const [messageId, item] of getOrderedItems()) {
        if (!item.scrollAnchor) continue;
        seenAnchorIds.add(messageId);
        seenAnchorElements.add(item.element);
      }
      turnAnchoringArmedRef.current = true;
    };

    if (!deferDefaultScrollRef.current) {
      applyDefaultScroll();
      return undefined;
    }
    if (defaultScrollScheduledRef.current) return undefined;

    defaultScrollScheduledRef.current = true;
    let cancelled = false;
    scheduleScrollSync(() => {
      scheduleScrollSync(() => {
        defaultScrollScheduledRef.current = false;
        if (!cancelled && !defaultScrollAppliedRef.current) applyDefaultScroll();
      });
    });
    return () => {
      cancelled = true;
      defaultScrollScheduledRef.current = false;
    };
  }, [
    defaultScrollPosition,
    getLastAnchorId,
    getOrderedItems,
    itemsRegistry,
    itemsVersion,
    scrollToEnd,
    scrollToMessage,
    scrollToStart,
    seenAnchorElements,
    seenAnchorIds,
    viewportElement,
  ]);

  // A turn opening is the one scripted scroll of a conversation: it carries the
  // reader to the message they just sent and parks it as high as the room the turn
  // reserves under it allows. The answer then grows into that room and moves
  // nothing at all — following only takes over once it outgrows the room.
  React.useLayoutEffect(() => {
    const lastAnchorId = getLastAnchorId();
    const lastAnchor = lastAnchorId ? itemsRegistry.get(lastAnchorId) : undefined;
    const opensTurn =
      turnAnchoringArmedRef.current &&
      lastAnchorId !== undefined &&
      lastAnchor !== undefined &&
      !seenAnchorIds.has(lastAnchorId) &&
      !seenAnchorElements.has(lastAnchor.element);

    for (const [messageId, item] of getOrderedItems()) {
      if (!item.scrollAnchor) continue;
      seenAnchorIds.add(messageId);
      seenAnchorElements.add(item.element);
    }
    turnAnchoringArmedRef.current = defaultScrollAppliedRef.current;

    if (opensTurn && lastAnchorId) {
      if (autoScroll) followingRef.current = true;
      cancelTripAnimation();
      const target = viewportElement ? anchorTripTarget(lastAnchorId) : undefined;
      // A turn opening at the top of the transcript — the first message of a fresh
      // thread — is already parked: no trip, and nothing moves.
      if (
        target === undefined ||
        !viewportElement ||
        Math.abs(target - viewportElement.scrollTop) <= VISIBILITY_EPSILON
      ) {
        tripRef.current = null;
      } else {
        tripRef.current = { anchorId: lastAnchorId };
        tripAnimationRef.current = startTrip(
          viewportElement,
          () => parkTripTarget(lastAnchorId),
          reason => {
            tripAnimationRef.current = null;
            tripRef.current = null;
            if (reason === 'interrupted') followingRef.current = atEndRef.current;
            syncAfterScroll();
          },
        );
      }
      // Published now: the reader just re-attached, and a button that hears late flashes.
      syncAfterScroll();
      return;
    }

    // Rows landing outside a turn — restored history, a notice — still belong to a
    // reader riding the stream, and reach them without a second animation. A trip
    // to an anchor keeps the viewport; a parked reader has new rows growing into
    // the room above the fold, with nothing below to catch up to.
    if (!autoScroll || !defaultScrollAppliedRef.current || !followingRef.current) return;
    if (tripRef.current !== null && tripRef.current !== 'end') return;
    if (viewportElement && followTarget() - viewportElement.scrollTop <= VISIBILITY_EPSILON) return;
    scrollToEnd({ behavior: tripRef.current === 'end' ? 'smooth' : 'auto' });
  }, [
    anchorTripTarget,
    autoScroll,
    cancelTripAnimation,
    followTarget,
    getLastAnchorId,
    getOrderedItems,
    itemsRegistry,
    itemsVersion,
    parkTripTarget,
    scrollToEnd,
    seenAnchorElements,
    seenAnchorIds,
    syncAfterScroll,
    viewportElement,
  ]);

  // A viewport going away mid-trip strands the frame loop on a detached element.
  React.useEffect(
    () => () => {
      cancelTripAnimation();
      tripRef.current = null;
    },
    [cancelTripAnimation, viewportElement],
  );

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
          // Size container so consumers can size the room under a live turn in cqh.
          '[container-type:size] size-full min-h-0 min-w-0 overflow-y-auto overscroll-contain',
          'data-autoscrolling:scrollbar-thumb-transparent data-autoscrolling:scrollbar-track-transparent',
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
