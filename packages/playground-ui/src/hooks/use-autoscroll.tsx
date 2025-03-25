import React, { useRef } from 'react';

export interface UseAutoscrollOptions {
  enabled?: boolean;
}

export const useAutoscroll = (ref: React.RefObject<HTMLElement | null>, { enabled = true }: UseAutoscrollOptions) => {
  const shouldScrollRef = useRef(enabled);

  React.useEffect(() => {
    if (!enabled) return;
    if (!ref?.current) return;

    const area = ref.current;

    const observer = new MutationObserver(() => {
      if (shouldScrollRef.current) {
        area.scrollTo({ top: area.scrollHeight, behavior: 'smooth' });
      }
    });

    observer.observe(area, {
      childList: true, // observe direct children changes
      subtree: true, // observe all descendants
      characterData: true, // observe text content changes
    });

    const handleScroll = (e: Event) => {
      const scrollElement = e.target as HTMLElement;
      const currentPosition = scrollElement.scrollTop + scrollElement.clientHeight;
      const totalHeight = scrollElement.scrollHeight;
      const isAtEnd = currentPosition >= totalHeight - 1;

      if (isAtEnd) {
        shouldScrollRef.current = true;
      } else {
        shouldScrollRef.current = false;
      }
    };

    area.addEventListener('scroll', handleScroll);

    return () => {
      area.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, [enabled, ref]);
};
