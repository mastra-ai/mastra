export function createTuiCleanup(options: {
  stopWork: Array<() => Promise<unknown> | unknown>;
  closeStorage: () => Promise<void> | void;
  shutdownAnalytics: () => Promise<unknown> | unknown;
  releaseLocks: () => void;
}): () => Promise<void> {
  let cleanupPromise: Promise<void> | undefined;
  return () => {
    cleanupPromise ??= (async () => {
      await Promise.allSettled(options.stopWork.map(stop => Promise.resolve().then(stop)));
      const errors: unknown[] = [];
      try {
        await options.closeStorage();
      } catch (error) {
        errors.push(error);
      }
      try {
        await options.shutdownAnalytics();
      } catch (error) {
        errors.push(error);
      } finally {
        options.releaseLocks();
      }
      if (errors.length === 1) throw errors[0];
      if (errors.length > 1) throw new AggregateError(errors, 'TUI cleanup failed');
    })();
    return cleanupPromise;
  };
}
