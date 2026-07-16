import * as React from 'react';

import { useIsomorphicLayoutEffect } from './use-isomorphic-layout-effect';

export interface UseIsClampedResult<TElement extends HTMLElement> {
  ref: React.RefCallback<TElement>;
  isClamped: boolean;
}

/**
 * Reports whether a line-clamped (or otherwise overflow-hidden) element
 * actually has content cut off, by measuring the rendered layout
 * (`scrollHeight > clientHeight`) — never by counting characters.
 *
 * Re-measures when the element resizes and once fonts finish loading, since
 * both change line wrapping. Pass `enabled: false` while the clamp is lifted
 * (e.g. text expanded) to keep the last measured value instead of reporting
 * the unclamped element as not cut off.
 */
export function useIsClamped<TElement extends HTMLElement = HTMLElement>({
  enabled = true,
}: { enabled?: boolean } = {}): UseIsClampedResult<TElement> {
  const [element, setElement] = React.useState<TElement | null>(null);
  const [isClamped, setIsClamped] = React.useState(false);

  useIsomorphicLayoutEffect(() => {
    if (!element || !enabled) return undefined;

    const measure = () => setIsClamped(element.scrollHeight > element.clientHeight);
    measure();

    if (typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    document.fonts?.ready.then(measure).catch(() => {});

    return () => observer.disconnect();
  }, [element, enabled]);

  return { ref: setElement, isClamped };
}
