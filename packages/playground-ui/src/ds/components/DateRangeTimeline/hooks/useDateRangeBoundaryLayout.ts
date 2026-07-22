import { useLayoutEffect, useState, type RefObject } from 'react';
import {
  resolveDateRangeBoundaryLayout,
  type DateRangeBoundaryLayout,
} from '../lib/date-range-boundary-layout';

interface BoundaryPositions {
  from: number;
  to: number;
}

export function useDateRangeBoundaryLayout(
  containerRef: RefObject<HTMLDivElement | null>,
  positions: BoundaryPositions,
): DateRangeBoundaryLayout | undefined {
  const [containerWidth, setContainerWidth] = useState<number>();

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function updateWidth(width: number) {
      if (width <= 0) return;
      setContainerWidth((current) => (current === width ? current : width));
    }

    updateWidth(container.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries.find(({ target }) => target === container) ?? entries[0];
      const width = entry?.contentRect.width ?? container.getBoundingClientRect().width;
      updateWidth(width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef]);

  return containerWidth === undefined
    ? undefined
    : resolveDateRangeBoundaryLayout(containerWidth, positions);
}
