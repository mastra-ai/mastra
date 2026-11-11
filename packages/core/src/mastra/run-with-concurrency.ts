export const DEFAULT_RESTART_CONCURRENCY = 5;

export function normalizeConcurrency(value: number | undefined): number {
  if (value === Infinity) return Infinity;
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_RESTART_CONCURRENCY;
  return Math.max(1, Math.floor(value));
}

/**
 * Run `task` over `items` with at most `limit` in flight. Resolves once every
 * task has settled; `task` is expected to handle its own errors.
 */
export async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number | undefined,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++]!;
      await task(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(normalizeConcurrency(limit), items.length) }, worker));
}

/** A concurrency limit shared by tasks that arrive over time, such as one per page read. */
export interface ConcurrencyLimiter {
  /**
   * Waits for a free slot, then starts `task` without waiting for it, so a
   * producer that awaits each call stops producing while every slot is busy.
   * `task` is expected to handle its own errors.
   */
  start(task: () => Promise<void>): Promise<void>;
  /** Resolves once every started task, including ones started meanwhile, has settled. */
  drain(): Promise<void>;
}

/** Creates a {@link ConcurrencyLimiter} with at most `limit` tasks in flight. */
export function createConcurrencyLimiter(limit: number | undefined): ConcurrencyLimiter {
  const max = normalizeConcurrency(limit);
  const running = new Set<Promise<void>>();
  return {
    async start(task) {
      while (running.size >= max) await Promise.race(running);
      const settled: Promise<void> = task().finally(() => running.delete(settled));
      running.add(settled);
    },
    async drain() {
      while (running.size > 0) await Promise.all(running);
    },
  };
}
