/**
 * Resolve to `fallback` when `signal` aborts before `promise` settles, leaving
 * `promise` itself running: callers that share one coalesced upstream request
 * keep their own cancellation without cancelling each other's answer.
 */
export function settleOrAbort<T>(promise: Promise<T>, signal: AbortSignal | undefined, fallback: T): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.resolve(fallback);
  return new Promise<T>(resolve => {
    const onAbort = () => resolve(fallback);
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      value => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      () => {
        signal.removeEventListener('abort', onAbort);
        resolve(fallback);
      },
    );
  });
}
