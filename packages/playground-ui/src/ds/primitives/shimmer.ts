import { useState } from 'react';

/**
 * One loop of the loading shimmer, shared by text skeletons and chart ghosts, so everything
 * loading on a page sweeps together.
 */
export const SHIMMER_MS = 2000;

/**
 * An `animation-delay` that puts a shimmer on the page-wide clock: every skeleton is at the same
 * point of its sweep whenever it mounts, instead of starting its own cycle.
 */
export function useShimmerDelay() {
  const [delay] = useState(() =>
    typeof performance === 'undefined' ? '0ms' : `${-Math.round(performance.now() % SHIMMER_MS)}ms`,
  );
  return delay;
}
