import { useState } from 'react';
import type { RefCallback } from 'react';

import { useIsomorphicLayoutEffect } from '@/hooks/use-isomorphic-layout-effect';

export interface UseMiddleTruncationResult<TElement extends HTMLElement> {
  /** The box the text has to fit; it must lay out at the room the text gets, not at the text's width. */
  ref: RefCallback<TElement>;
  /** The value, or its start and end joined by `…` so it fits the box. */
  text: string;
  truncated: boolean;
}

/**
 * Cuts a value in the middle so its start and its last `tail` characters stay readable: `user_01KJ…ECM9AQ`. Measured
 * in the box's own font, so the `…` lands against the tail with no gap. CSS `text-overflow` can only cut the end,
 * and splitting the value into two ellipsized spans leaves a gap wherever the cut falls between characters.
 */
export function useMiddleTruncation<TElement extends HTMLElement = HTMLElement>(
  value: string,
  tail = 6,
): UseMiddleTruncationResult<TElement> {
  const [element, setElement] = useState<TElement | null>(null);
  const [text, setText] = useState(value);

  useIsomorphicLayoutEffect(() => {
    if (!element) return;

    let stopped = false;
    const measure = () => {
      if (stopped) return;
      const probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;white-space:pre;pointer-events:none';
      element.appendChild(probe);
      const widthOf = (candidate: string) => {
        probe.textContent = candidate;
        return probe.getBoundingClientRect().width;
      };
      try {
        const room = element.getBoundingClientRect().width + 0.5;
        if (widthOf(value) <= room) {
          setText(value);
          return;
        }
        // In a box too narrow for `…` and the whole tail, keep less of the tail (down to just `…`).
        let tailLength = Math.min(tail, value.length - 1);
        while (tailLength > 0 && widthOf(`…${value.slice(-tailLength)}`) > room) tailLength--;
        const end = tailLength > 0 ? value.slice(-tailLength) : '';
        let keep = 0;
        let over = value.length - tailLength - 1;
        // Binary search for the longest start that still fits beside `…` and the tail.
        while (keep < over) {
          const mid = Math.ceil((keep + over) / 2);
          if (widthOf(`${value.slice(0, mid)}…${end}`) <= room) keep = mid;
          else over = mid - 1;
        }
        setText(`${value.slice(0, keep)}…${end}`);
      } finally {
        probe.remove();
      }
    };

    measure();

    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      observer.observe(element);
    }
    // The real font can arrive after the first measurement and change every width.
    document.fonts?.ready.then(measure).catch(() => {});

    return () => {
      stopped = true;
      observer?.disconnect();
    };
  }, [element, value, tail]);

  return { ref: setElement, text, truncated: text !== value };
}
