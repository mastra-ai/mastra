/**
 * Tiny external store for the screencast frame. Lives outside React's state
 * machine so frame updates (15-30 fps) don't trigger re-renders in the
 * provider component — only consumers that subscribe via
 * `useSyncExternalStore` re-render when a new frame arrives.
 */
export interface BrowserFrameStore {
  getSnapshot: () => string | null;
  subscribe: (listener: () => void) => () => void;
  setFrame: (frame: string | null) => void;
}

export function createBrowserFrameStore(): BrowserFrameStore {
  let frame: string | null = null;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => frame,
    subscribe: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setFrame: next => {
      if (frame === next) return;
      frame = next;
      listeners.forEach(l => l());
    },
  };
}
