import { useEffect, useState } from 'react';

const BASE = 'Initializing work session';
const CYCLE = ['', '.', '..', '...'] as const;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function getReducedMotionQuery(): MediaQueryList | undefined {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
  return window.matchMedia(REDUCED_MOTION_QUERY);
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
  const [reducedMotion, setReducedMotion] = useState(() => getReducedMotionQuery()?.matches ?? false);

  useEffect(() => {
    const query = getReducedMotionQuery();
    if (!query) return;
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!active || reducedMotion) return;
    const id = setInterval(() => setTick(t => (t + 1) % CYCLE.length), 500);
    return () => clearInterval(id);
  }, [active, reducedMotion]);

  if (!active) return undefined;
  if (reducedMotion) return `${BASE}${CYCLE[CYCLE.length - 1]}`;
  return `${BASE}${CYCLE[tick]}`;
}
