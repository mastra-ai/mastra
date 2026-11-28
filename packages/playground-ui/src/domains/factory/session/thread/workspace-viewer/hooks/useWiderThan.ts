import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';

// Resolved per measurement so zoom and root font-size changes are reflected on the next
// container resize. Unstyled documents (jsdom) report no font size, and a NaN threshold
// would compare false forever.
const DEFAULT_ROOT_FONT_SIZE = 16;

function remToPx(rem: number) {
  const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return rem * (rootFontSize || DEFAULT_ROOT_FONT_SIZE);
}

// The sidebar sets `--sidebar-width` to where it is heading while its box still animates there.
function pendingGrowth(sidebar: HTMLElement | null | undefined) {
  if (!sidebar) return 0;
  const destination = parseFloat(sidebar.style.getPropertyValue('--sidebar-width'));
  return Number.isNaN(destination) ? 0 : destination - sidebar.getBoundingClientRect().width;
}

type MovingSidebar = { panelRef: RefObject<HTMLElement | null>; state: string };

/** Container query in JS — tracks the element's own width, so a resized sidebar counts too.
 * `revision` counts crossings since the first measurement, so 0 is the layout the page painted with.
 * With `sidebar`, the answer is for the width the element settles at, from the frame the sidebar
 * starts moving rather than the frame its animation crosses the threshold. */
export function useWiderThan(
  ref: RefObject<HTMLElement | null>,
  minRem: number,
  slackPx = 0,
  sidebar?: MovingSidebar | null,
) {
  const sidebarRef = sidebar?.panelRef;
  const sidebarState = sidebar?.state;
  const [state, setState] = useState<{ wider: boolean; revision: number }>();

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = (width: number) => {
      const settled = width - pendingGrowth(sidebarRef?.current);
      const wider = settled >= remToPx(minRem) + slackPx;
      setState(current => {
        if (!current) return { wider, revision: 0 };
        return current.wider === wider ? current : { wider, revision: current.revision + 1 };
      });
    };

    measure(element.getBoundingClientRect().width);

    const observer = new ResizeObserver(entries => {
      const entry = entries.at(-1);
      const width = entry?.borderBoxSize[0]?.inlineSize ?? entry?.contentRect.width;
      if (width !== undefined) measure(width);
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, [ref, minRem, slackPx, sidebarRef, sidebarState]);

  return { wider: state?.wider ?? false, revision: state?.revision ?? 0 };
}
