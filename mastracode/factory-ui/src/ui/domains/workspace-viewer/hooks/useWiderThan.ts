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

/** Container query in JS — tracks the element's own width, so a resized sidebar counts too. */
export function useWiderThan(ref: RefObject<HTMLElement | null>, minRem: number) {
  const [state, setState] = useState({ wider: false, revision: 0 });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = (width: number) => {
      const wider = width >= remToPx(minRem);
      setState(current => (current.wider === wider ? current : { wider, revision: current.revision + 1 }));
    };

    measure(element.getBoundingClientRect().width);

    const observer = new ResizeObserver(entries => {
      const entry = entries.at(-1);
      const width = entry?.borderBoxSize[0]?.inlineSize ?? entry?.contentRect.width;
      if (width !== undefined) measure(width);
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, [ref, minRem]);

  return state;
}
