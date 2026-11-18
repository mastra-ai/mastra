'use client';

import { useRef, useState } from 'react';
import type { RefObject } from 'react';

import { useIsomorphicLayoutEffect } from '@/hooks/use-isomorphic-layout-effect';

export interface UseMiddleTruncationResult<TElement extends HTMLElement> {
  /** The box the text has to fit; it must lay out at the room the text gets, not at the text's width. */
  ref: RefObject<TElement | null>;
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
  const ref = useRef<TElement>(null);
  const [text, setText] = useState(value);

  // Measuring needs the laid-out box, so it runs in a layout effect (before paint) and again whenever the box
  // resizes or the real font arrives.
  useIsomorphicLayoutEffect(() => {
    const element = ref.current;
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
        // Cut on whole characters as people see them (graphemes), so no emoji is split in half.
        const chars = splitGraphemes(value);
        const startOf = (count: number) => chars.slice(0, count).join('');
        const endOf = (count: number) => (count > 0 ? chars.slice(-count).join('') : '');
        // In a box too narrow for `…` and the whole tail, keep less of the tail (down to just `…`).
        let tailLength = Math.min(tail, chars.length - 1);
        while (tailLength > 0 && widthOf(`…${endOf(tailLength)}`) > room) tailLength--;
        const end = endOf(tailLength);
        let keep = 0;
        let over = chars.length - tailLength - 1;
        // Binary search for the longest start that still fits beside `…` and the tail.
        while (keep < over) {
          const mid = Math.ceil((keep + over) / 2);
          if (widthOf(`${startOf(mid)}…${end}`) <= room) keep = mid;
          else over = mid - 1;
        }
        setText(`${startOf(keep)}…${end}`);
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
    // The real font can arrive after the first measurement, or load later, and change every width without
    // resizing the box.
    document.fonts?.ready.then(measure).catch(() => {});
    document.fonts?.addEventListener('loadingdone', measure);

    return () => {
      stopped = true;
      observer?.disconnect();
      document.fonts?.removeEventListener('loadingdone', measure);
    };
  }, [value, tail]);

  return { ref, text, truncated: text !== value };
}

function splitGraphemes(value: string): string[] {
  if (typeof Intl === 'undefined' || !('Segmenter' in Intl)) return Array.from(value);
  return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value), part => part.segment);
}
