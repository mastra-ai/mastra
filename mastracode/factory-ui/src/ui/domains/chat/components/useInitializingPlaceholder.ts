import { useEffect, useState } from 'react';

const BASE = 'Initializing work session';
const CYCLE = ['', '.', '..', '...'] as const;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function getReducedMotionQuery(): MediaQueryList | undefined {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
  return window.matchMedia(REDUCED_MOTION_QUERY);
}

export function useInitializingPlaceholder(initializing: boolean, isEmpty: boolean): string | undefined {
  const active = initializing && isEmpty;
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
