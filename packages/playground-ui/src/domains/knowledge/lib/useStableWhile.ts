import { useRef } from 'react';

/**
 * The previous value for as long as `equal` says the new one is the same. Hosts hand back fresh arrays
 * every render (a list of query results, say); anything built from them would otherwise change every render.
 */
export function useStableWhile<T>(next: T, equal: (previous: T, next: T) => boolean): T {
  const previous = useRef(next);
  if (!equal(previous.current, next)) previous.current = next;
  return previous.current;
}
