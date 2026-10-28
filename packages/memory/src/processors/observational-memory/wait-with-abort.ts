/** Stops waiting when `signal` aborts; the awaited work keeps running. */
export async function waitWithAbort<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return work;
  if (signal.aborted) {
    // The caller stops waiting, but the work's own failure must not surface as unhandled.
    work.catch(() => {});
    throw signal.reason;
  }
  let onAbort = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    return await Promise.race([work, cancelled]);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}
