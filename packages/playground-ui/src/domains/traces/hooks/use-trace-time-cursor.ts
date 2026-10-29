import { createContext, use, useSyncExternalStore } from 'react';

/** Cursor time in absolute epoch ms; `null` means no cursor, the whole trace is shown. */
export type TraceTimeCursor = number | null;

export type TraceTimeCursorStore = {
  get: () => TraceTimeCursor;
  set: (t: TraceTimeCursor) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createTraceTimeCursorStore(initial: TraceTimeCursor = null): TraceTimeCursorStore {
  let current = initial;
  const listeners = new Set<() => void>();

  return {
    get: () => current,
    set: next => {
      if (Object.is(next, current)) return;
      current = next;
      for (const listener of listeners) listener();
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const TraceTimeCursorContext = createContext<TraceTimeCursorStore | undefined>(undefined);

export function useTraceTimeCursorStore(): TraceTimeCursorStore | undefined {
  return use(TraceTimeCursorContext);
}

const subscribeNoop = () => () => {};

/**
 * Subscribes to the cursor through `selector`; the component re-renders only when the selected
 * value changes, so selectors should return primitives. Without a provider the cursor is `null`.
 */
export function useTraceTimeCursor<T>(selector: (t: TraceTimeCursor) => T): T {
  const store = useTraceTimeCursorStore();
  const getSnapshot = () => selector(store ? store.get() : null);
  return useSyncExternalStore(store?.subscribe ?? subscribeNoop, getSnapshot, getSnapshot);
}
