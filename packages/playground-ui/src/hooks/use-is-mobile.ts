import { useSyncExternalStore } from 'react';

// Matches MainSidebar's default mobile breakpoint.
const DEFAULT_MOBILE_BREAKPOINT = 1024;

const noopSubscribe = () => () => {};

export const useIsMobile = (breakpoint: number = DEFAULT_MOBILE_BREAKPOINT) => {
  const query = `(max-width: ${breakpoint - 1}px)`;
  const getSnapshot = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false;

  return useSyncExternalStore(
    typeof window === 'undefined' || typeof window.matchMedia !== 'function'
      ? noopSubscribe
      : callback => {
          const mq = window.matchMedia(query);
          if (typeof mq.addEventListener === 'function') {
            mq.addEventListener('change', callback);
            return () => mq.removeEventListener('change', callback);
          }

          mq.addListener(callback);
          return () => mq.removeListener(callback);
        },
    getSnapshot,
    () => false,
  );
};
