import React, { useRef } from 'react';

export interface UseAutoscrollOptions {
  enabled?: boolean;
}

const SCROLL_END_THRESHOLD = 8;

export const useAutoscroll = (ref: React.RefObject<HTMLElement | null>, { enabled = true }: UseAutoscrollOptions) => {
  const shouldScrollRef = useRef(enabled);
  const scrollFrameRef = useRef<number | null>(null);
  const userScrollIntentRef = useRef(false);
  const userScrollIntentTimeoutRef = useRef<number | null>(null);

  React.useEffect(() => {
    if (!enabled) return;
    if (!ref?.current) return;

    const area = ref.current;

    const scrollToEnd = () => {
      if (!shouldScrollRef.current) return;

      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
      }

      scrollFrameRef.current = requestAnimationFrame(() => {
        area.scrollTop = area.scrollHeight;
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

    const cancelPendingScroll = () => {
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };

    const handleScroll = (e: Event) => {
      const scrollElement = e.target as HTMLElement;
      const currentPosition = scrollElement.scrollTop + scrollElement.clientHeight;
      const totalHeight = scrollElement.scrollHeight;
      const isAtEnd = currentPosition >= totalHeight - SCROLL_END_THRESHOLD;

      if (isAtEnd) {
        shouldScrollRef.current = true;
        return;
      }

      if (userScrollIntentRef.current) {
        shouldScrollRef.current = false;
        cancelPendingScroll();
      }
    };

    area.addEventListener('wheel', registerUserScrollIntent, { passive: true });
    area.addEventListener('touchmove', registerUserScrollIntent, { passive: true });
    area.addEventListener('pointerdown', registerUserScrollIntent);
    area.addEventListener('keydown', registerUserScrollIntent);
    area.addEventListener('scroll', handleScroll);
    scrollToEnd();

    return () => {
      area.removeEventListener('wheel', registerUserScrollIntent);
      area.removeEventListener('touchmove', registerUserScrollIntent);
      area.removeEventListener('pointerdown', registerUserScrollIntent);
      area.removeEventListener('keydown', registerUserScrollIntent);
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
