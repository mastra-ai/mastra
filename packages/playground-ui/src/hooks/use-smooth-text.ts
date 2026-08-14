import { useEffect, useState } from 'react';

/**
 * How long the reveal takes to close the gap it is behind by. Also the lag a
 * steady stream settles at, so it has to stay short enough to read as live.
 */
const CATCH_UP_MS = 180;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * A jitter buffer for streamed text. Chunks reach the browser unevenly — a
 * proxy flushes, a tool call ends, the model changes pace — and rendering each
 * one on arrival makes a reply lurch. Reveal instead at a rate set by how far
 * behind the text is, so a burst spreads out and a gap closes rather than
 * stalling, and no delta is ever waited on.
 *
 * Whatever is on screen at mount was already read, so only what arrives after
 * counts: a thread opened from history renders whole.
 */
export function useSmoothText(text: string): string {
  const [shown, setShown] = useState(text.length);

  useEffect(() => {
    if (shown === text.length) return;

    if (shown > text.length || prefersReducedMotion()) {
      setShown(text.length);
      return;
    }

    const scheduledAt = performance.now();
    const frame = requestAnimationFrame(now => {
      const behind = text.length - shown;
      setShown(shown + Math.ceil(behind * (1 - Math.exp((scheduledAt - now) / CATCH_UP_MS))));
    });

    return () => cancelAnimationFrame(frame);
  }, [shown, text]);

  return text.slice(0, shown);
}
