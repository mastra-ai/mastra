import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';

// jsdom reports no root font size, and a NaN threshold would compare false forever.
const DEFAULT_ROOT_FONT_SIZE = 16;

function remToPx(rem: number) {
  const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return rem * (rootFontSize || DEFAULT_ROOT_FONT_SIZE);
}

/** `revision` counts crossings since the first enabled measurement, so 0 is the layout the page painted with. */
export function useWiderThan(ref: RefObject<HTMLElement | null>, minRem: number, enabled = true, slackPx = 0) {
  const [state, setState] = useState<{ wider: boolean; revision: number }>();

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;

    const measure = (width: number) => {
      const wider = width >= remToPx(minRem) + slackPx;
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
  }, [ref, minRem, enabled, slackPx]);

  return { wider: state?.wider ?? false, revision: state?.revision ?? 0 };
}
