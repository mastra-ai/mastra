import { useEffect, useState } from 'react';

const BASE = 'Initializing work session';
const CYCLE = ['', '.', '..', '...'] as const;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * Placeholder text for the composer while `/ensure` is in flight and the user
 * has not yet started drafting. Returns `undefined` when the ticker should be
 * off — the caller falls back to its normal placeholder.
 *
 * Kept component-local by design (do not lift into a shared context — a 500ms
 * tick in a shared provider would re-render every consumer).
 */
export function useInitializingPlaceholder(sandboxPreparing: boolean, isEmpty: boolean): string | undefined {
  const active = sandboxPreparing && isEmpty;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    if (prefersReducedMotion()) return;
    const id = setInterval(() => setTick(t => (t + 1) % CYCLE.length), 500);
    return () => clearInterval(id);
  }, [active]);

  if (!active) return undefined;
  if (prefersReducedMotion()) return `${BASE}${CYCLE[CYCLE.length - 1]}`;
  return `${BASE}${CYCLE[tick]}`;
}
