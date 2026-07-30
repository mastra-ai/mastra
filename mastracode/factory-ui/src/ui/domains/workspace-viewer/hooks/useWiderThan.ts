import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';

// Resolved per measurement, not at import — a root font-size or zoom change moves the
// threshold with the rem widths it is compared against. Unstyled documents (jsdom) report
// no font size, and a NaN threshold would compare false forever.
const DEFAULT_ROOT_FONT_SIZE = 16;

function remToPx(rem: number) {
  const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return rem * (rootFontSize || DEFAULT_ROOT_FONT_SIZE);
}

/** Container query in JS — tracks the element's own width, so a resized sidebar counts too. */
export function useWiderThan(ref: RefObject<HTMLElement | null>, minRem: number) {
  const [wider, setWider] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = (width: number) => setWider(width >= remToPx(minRem));

    measure(element.getBoundingClientRect().width);

    const observer = new ResizeObserver(entries => {
      const width = entries.at(-1)?.contentRect.width;
      if (width !== undefined) measure(width);
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, [ref, minRem]);

  return wider;
}
