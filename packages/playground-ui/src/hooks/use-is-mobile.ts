import { useSyncExternalStore } from 'react';

// Matches MainSidebar's default mobile breakpoint.
const DEFAULT_MOBILE_BREAKPOINT = 1024;

const noopSubscribe = () => () => {};

/**
 * Tracks whether the viewport is below the mobile breakpoint.
 * SSR-safe: renders desktop on the server, then syncs on hydration.
 */
export const useIsMobile = (breakpoint: number = DEFAULT_MOBILE_BREAKPOINT) => {
  const query = `(max-width: ${breakpoint - 1}px)`;

  return useSyncExternalStore(
    typeof window === 'undefined'
      ? noopSubscribe
      : callback => {
          const mq = window.matchMedia(query);
          mq.addEventListener('change', callback);
          return () => mq.removeEventListener('change', callback);
        },
    () => window.matchMedia(query).matches,
    () => false,
  );
};
