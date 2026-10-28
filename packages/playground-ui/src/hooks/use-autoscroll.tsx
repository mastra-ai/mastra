import React, { useRef } from 'react';

export interface UseAutoscrollOptions {
  enabled?: boolean;
  /** Start pinned to the end. `false` keeps the reader's position until they scroll back to the end. Defaults to true. */
  startFollowing?: boolean;
  /** Called whenever following turns on or off (reader scrolls away, or returns to the end). */
  onFollowingChange?: (following: boolean) => void;
}

const SCROLL_END_THRESHOLD = 8;

export const useAutoscroll = (
  ref: React.RefObject<HTMLElement | null>,
  { enabled = true, startFollowing = true, onFollowingChange }: UseAutoscrollOptions,
) => {
  const shouldScrollRef = useRef(enabled && startFollowing);
  const scrollFrameRef = useRef<number | null>(null);
  const userScrollIntentRef = useRef(false);
  const userScrollIntentTimeoutRef = useRef<number | null>(null);

  const notifyFollowing = React.useEffectEvent((following: boolean) => onFollowingChange?.(following));

  React.useEffect(() => {
    if (!enabled) return;
    if (!ref?.current) return;

    const area = ref.current;

    const setFollowing = (next: boolean) => {
      if (shouldScrollRef.current === next) return;
      shouldScrollRef.current = next;
      notifyFollowing(next);
    };

    const scrollToEnd = () => {
      if (!shouldScrollRef.current) return;

      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
      }

      scrollFrameRef.current = requestAnimationFrame(() => {
        if (shouldScrollRef.current) {
          area.scrollTop = area.scrollHeight;
        }
        scrollFrameRef.current = null;
      });
    };

    const mutationObserver = new MutationObserver(scrollToEnd);

    mutationObserver.observe(area, {
      childList: true, // observe direct children changes
      subtree: true, // observe all descendants
      characterData: true, // observe text content changes
    });

    const resizeObserver = new ResizeObserver(scrollToEnd);
    resizeObserver.observe(area);

    const cancelPendingScroll = () => {
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };

    const stopFollowing = () => {
      setFollowing(false);
      cancelPendingScroll();
    };

    const registerUserScrollIntent = () => {
      userScrollIntentRef.current = true;

      if (userScrollIntentTimeoutRef.current !== null) {
        window.clearTimeout(userScrollIntentTimeoutRef.current);
      }

      userScrollIntentTimeoutRef.current = window.setTimeout(() => {
        userScrollIntentRef.current = false;
        userScrollIntentTimeoutRef.current = null;
      }, 250);
    };

    const handleWheel = (event: WheelEvent) => {
      registerUserScrollIntent();

      if (event.deltaY < 0) {
        stopFollowing();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      registerUserScrollIntent();

      if (['ArrowUp', 'PageUp', 'Home'].includes(event.key)) {
        stopFollowing();
      }
    };

    const handleScroll = (e: Event) => {
      const scrollElement = e.target as HTMLElement;
      const currentPosition = scrollElement.scrollTop + scrollElement.clientHeight;
      const totalHeight = scrollElement.scrollHeight;
      const isAtEnd = currentPosition >= totalHeight - SCROLL_END_THRESHOLD;

      if (isAtEnd) {
        setFollowing(true);
        return;
      }

      if (userScrollIntentRef.current) {
        setFollowing(false);
        cancelPendingScroll();
      }
    };

    area.addEventListener('wheel', handleWheel, { passive: true });
    area.addEventListener('touchmove', registerUserScrollIntent, { passive: true });
    area.addEventListener('pointerdown', registerUserScrollIntent);
    area.addEventListener('keydown', handleKeyDown);
    area.addEventListener('scroll', handleScroll);
    scrollToEnd();

    return () => {
      area.removeEventListener('wheel', handleWheel);
      area.removeEventListener('touchmove', registerUserScrollIntent);
      area.removeEventListener('pointerdown', registerUserScrollIntent);
      area.removeEventListener('keydown', handleKeyDown);
      area.removeEventListener('scroll', handleScroll);
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      cancelPendingScroll();

      if (userScrollIntentTimeoutRef.current !== null) {
        window.clearTimeout(userScrollIntentTimeoutRef.current);
        userScrollIntentTimeoutRef.current = null;
      }
    };
  }, [enabled, ref]);
};
