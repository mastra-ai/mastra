import { useLayoutEffect } from 'react';
import type { RefObject } from 'react';

const FADE_PX = 32;

function fadeHiddenWords(element: HTMLElement) {
  const hidden = element.scrollWidth - element.clientWidth;
  element.style.maskImage =
    hidden > 0 ? `linear-gradient(to right, #000 calc(100% - ${Math.min(hidden, FADE_PX)}px), transparent)` : '';
}

/**
 * Words wider than their line fade out at its edge instead of ending in an ellipsis. The fade is never wider than
 * what it hides, so a line growing into its full width loses the fade as its last word comes into view.
 */
export function useFadingEdge(line: RefObject<HTMLElement | null>, words: string) {
  useLayoutEffect(() => {
    const element = line.current;
    if (!element) return;
    fadeHiddenWords(element);
    if (!('ResizeObserver' in globalThis)) return;
    const observer = new ResizeObserver(() => fadeHiddenWords(element));
    observer.observe(element);
    return () => observer.disconnect();
  }, [line, words]);
}
