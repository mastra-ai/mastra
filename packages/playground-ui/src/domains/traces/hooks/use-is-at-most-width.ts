import { useEffect, useState } from 'react';

/** Whether `element` is `maxWidth` px wide or narrower, kept current as it resizes. False until measured. */
export function useIsAtMostWidth(element: HTMLElement | null, maxWidth: number) {
  const [isAtMostWidth, setIsAtMostWidth] = useState(false);
  useEffect(() => {
    if (!element || !('ResizeObserver' in globalThis)) return;
    const observer = new ResizeObserver(() => setIsAtMostWidth(element.clientWidth <= maxWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, maxWidth]);
  return isAtMostWidth;
}
