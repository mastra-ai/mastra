import { useCallback, useSyncExternalStore } from 'react';

// Default breakpoint 1024 matches Sidebar's mobile breakpoint.
export const useIsMobile = (breakpoint: number = 1024) => {
  const query = `(max-width: ${breakpoint - 1}px)`;
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
};
