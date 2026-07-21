export function createTuiCleanup(options: {
  stopWork: Array<() => Promise<unknown> | unknown>;
  closeStorage: () => Promise<void> | void;
  shutdownAnalytics: () => Promise<unknown> | unknown;
  releaseLocks: () => void;
}): () => Promise<void> {
  let cleanupPromise: Promise<void> | undefined;
  return () => {
    cleanupPromise ??= (async () => {
      try {
        await Promise.allSettled(options.stopWork.map(stop => Promise.resolve().then(stop)));
        await options.closeStorage();
      } finally {
        try {
          await options.shutdownAnalytics();
        } finally {
          options.releaseLocks();
        }
      }
    })();
    return cleanupPromise;
  };
}
