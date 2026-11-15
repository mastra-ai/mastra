import { useEffect, useState } from 'react';

import { usePrefersReducedMotion } from '../../../../hooks/usePrefersReducedMotion';

const BASE = 'Initializing work session';
const CYCLE = ['', '.', '..', '...'] as const;

export function useInitializingPlaceholder(initializing: boolean, isEmpty: boolean): string | undefined {
  const active = initializing && isEmpty;
  const [tick, setTick] = useState(0);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!active || reducedMotion) return;
    const id = setInterval(() => setTick(t => (t + 1) % CYCLE.length), 500);
    return () => clearInterval(id);
  }, [active, reducedMotion]);

  if (!active) return undefined;
  if (reducedMotion) return `${BASE}${CYCLE[CYCLE.length - 1]}`;
  return `${BASE}${CYCLE[tick]}`;
}
