import { level1 } from '@internal/level1';

// The entry imports ONLY @internal/level1. @internal/level2 (one hop) and
// @internal/level3 (two hops) are reachable only transitively.
export const fn = () => {
  return `${level1}`;
};
