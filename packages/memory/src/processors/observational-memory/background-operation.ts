/** Runs sharing an OM lock retain its background work until every consumer cancels. */
export class BackgroundOperation {
  private static runs = new Map<string, Map<symbol, AbortSignal | undefined>>();
  private static operations = new Map<string, Set<BackgroundOperation>>();
  private readonly controller = new AbortController();
  private readonly consumers = new Map<AbortSignal | undefined, () => void>();

  readonly signal: AbortSignal = this.controller.signal;

  static retainRun(key: string, signal?: AbortSignal): () => void {
    if (signal?.aborted) return () => {};
    const runs = this.runs.get(key) ?? new Map();
    const lease = Symbol();
    runs.set(lease, signal);
    this.runs.set(key, runs);
    for (const operation of this.operations.get(key) ?? []) operation.retain(signal);
    const release = () => {
      signal?.removeEventListener('abort', release);
      runs.delete(lease);
      if (!runs.size && this.runs.get(key) === runs) this.runs.delete(key);
    };
    signal?.addEventListener('abort', release, { once: true });
    return release;
  }

  constructor(
    private readonly key: string,
    signal?: AbortSignal,
  ) {
    const operations = BackgroundOperation.operations.get(key) ?? new Set();
    operations.add(this);
    BackgroundOperation.operations.set(key, operations);
    this.retain(signal);
    for (const consumer of BackgroundOperation.runs.get(key)?.values() ?? []) this.retain(consumer);
    this.checkCancelled();
  }

  private retain(signal?: AbortSignal): void {
    if (this.consumers.has(signal)) return;
    const onAbort = () => this.checkCancelled();
    this.consumers.set(signal, onAbort);
    signal?.addEventListener('abort', onAbort, { once: true });
  }

  private checkCancelled(): void {
    if ([...this.consumers.keys()].every(signal => signal?.aborted)) this.controller.abort();
  }

  dispose(): void {
    for (const [signal, listener] of this.consumers) signal?.removeEventListener('abort', listener);
    this.consumers.clear();
    const operations = BackgroundOperation.operations.get(this.key);
    operations?.delete(this);
    if (!operations?.size) BackgroundOperation.operations.delete(this.key);
  }
}

/** Cancelling a waiter must not cancel background work retained by another run. */
export async function waitWithAbort<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return work;
  signal.throwIfAborted();
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
