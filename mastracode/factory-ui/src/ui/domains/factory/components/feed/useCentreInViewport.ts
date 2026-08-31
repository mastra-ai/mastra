import { useRef } from 'react';
import type { RefObject } from 'react';

/**
 * A ref for the one row that should sit mid-viewport when it lands. Scrolls the
 * given viewport only: `scrollIntoView` would also scroll every ancestor,
 * yanking the page around behind the popover.
 */
export function useCentreInViewport(viewportRef: RefObject<HTMLDivElement | null>) {
  const centred = useRef<HTMLElement | undefined>(undefined);

  return (row: HTMLDivElement | null) => {
    const viewport = viewportRef.current;
    if (!row || !viewport || centred.current === row) return;
    centred.current = row;
    const viewportRect = viewport.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    viewport.scrollTop += rowRect.top - viewportRect.top - (viewport.clientHeight - rowRect.height) / 2;
  };
}
