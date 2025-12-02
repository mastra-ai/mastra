import { useSyncExternalStore } from 'use-sync-external-store/shim';

/**
 * Determines whether or not the component tree has been hydrated.
 */
export function useIsHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}

function subscribe() {
  return () => {};
}
