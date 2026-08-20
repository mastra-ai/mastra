import { useLayoutEffect, useState, type RefObject } from 'react';

/** The container's own width, so a resized panel re-lays its chart out. */
export function useHostWidth(host: RefObject<HTMLElement | null>, assumed = 1000): number {
  const [width, setWidth] = useState(assumed);
  useLayoutEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => {
      const measured = entries.at(-1)?.contentRect.width;
      if (measured) setWidth(Math.max(measured, 320));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [host]);
  return width;
}
