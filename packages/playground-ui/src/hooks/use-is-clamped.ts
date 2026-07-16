import { useState } from 'react';
import type { RefCallback } from 'react';

import { useIsomorphicLayoutEffect } from './use-isomorphic-layout-effect';

export interface UseIsClampedOptions {
  /**
   * Keep measuring while true. Pass false when the clamp is lifted (e.g. the
   * text is expanded) to freeze the last measurement instead of reporting the
   * unclamped element as not cut off.
   */
  enabled?: boolean;
}

export interface UseIsClampedResult<TElement extends HTMLElement> {
  ref: RefCallback<TElement>;
  isClamped: boolean;
}

/**
 * Whether a line-clamped (or otherwise overflow-hidden) element actually has
 * content cut off, measured from the rendered layout
 * (`scrollHeight > clientHeight`) — never from a character count.
 * Re-measures when the element resizes and once fonts finish loading, since
 * both change line wrapping.
 */
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

    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    // Font swaps change line wrapping without resizing the observed box.
    document.fonts?.ready.then(measure).catch(() => {});

    return () => {
      stopped = true;
      observer.disconnect();
    };
  }, [element, enabled]);

  return { ref: setElement, isClamped };
}
