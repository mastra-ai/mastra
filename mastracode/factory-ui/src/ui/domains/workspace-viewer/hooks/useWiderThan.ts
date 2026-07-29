import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';

/** Container query in JS — tracks the element's own width, so a resized sidebar counts too. */
export function useWiderThan(ref: RefObject<HTMLElement | null>, minWidth: number) {
  const [wider, setWider] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    setWider(element.getBoundingClientRect().width >= minWidth);

    const observer = new ResizeObserver(entries => {
      const width = entries.at(-1)?.contentRect.width;
      if (width !== undefined) setWider(width >= minWidth);
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, [ref, minWidth]);

  return wider;
}
