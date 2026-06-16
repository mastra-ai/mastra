import { useCallback, useSyncExternalStore } from 'react';

const noopSubscribe = () => () => {};
const getServerSnapshot = () => false;

// Default breakpoint 1024 matches MainSidebar's mobile breakpoint.
export const useIsMobile = (breakpoint: number = 1024) => {
  const query = `(max-width: ${breakpoint - 1}px)`;

  const getSnapshot = useCallback(
    () =>
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia(query).matches
        : false,
    [query],
  );

  const subscribe = useCallback(
    (callback: () => void) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return noopSubscribe();
      }

      const mq = window.matchMedia(query);
      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', callback);
        return () => mq.removeEventListener('change', callback);
      }

      mq.addListener(callback);
      return () => mq.removeListener(callback);
    },
    [query],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
};
