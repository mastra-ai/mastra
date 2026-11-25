import { useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
let ticker: ReturnType<typeof setInterval> | undefined;
let now = Date.now();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!ticker) {
    now = Date.now();
    ticker = setInterval(() => {
      now = Date.now();
      listeners.forEach(notify => notify());
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(ticker);
      ticker = undefined;
    }
  };
}

/**
 * Reads the time through `read` on one clock that ticks every second for every caller, and draws
 * again only when what `read` returns changes: a label that moves once a minute draws once a minute.
 */
export function useClock<T>(read: (now: number) => T): T {
  const snapshot = () => read(ticker ? now : Date.now());
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
