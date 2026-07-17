import { useState } from 'react';
import type { RefCallback } from 'react';

import { useIsomorphicLayoutEffect } from './use-isomorphic-layout-effect';

export interface UseIsClampedOptions {
  /** Set false while the clamp is lifted (e.g. text expanded) to freeze the last measurement. */
  enabled?: boolean;
}

export interface UseIsClampedResult<TElement extends HTMLElement> {
  ref: RefCallback<TElement>;
  isClamped: boolean;
}

/** Measures whether a clamped element has content cut off (`scrollHeight > clientHeight`), re-measuring on resize and font load. */
export function useIsClamped<TElement extends HTMLElement = HTMLElement>({
  enabled = true,
}: UseIsClampedOptions = {}): UseIsClampedResult<TElement> {
  const [element, setElement] = useState<TElement | null>(null);
  const [isClamped, setIsClamped] = useState(false);

  useIsomorphicLayoutEffect(() => {
    if (!element || !enabled) return;

    let stopped = false;
    const measure = () => {
      if (!stopped) setIsClamped(element.scrollHeight > element.clientHeight);
    };

    measure();

    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      observer.observe(element);
    }
    // Font swaps change line wrapping without resizing the observed box.
    document.fonts?.ready.then(measure).catch(() => {});

    return () => {
      stopped = true;
      observer?.disconnect();
    };
  }, [element, enabled]);

  return { ref: setElement, isClamped };
}
