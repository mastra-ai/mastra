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

/** A concurrency limit shared by tasks that arrive over time, such as every recovery pass's restarts on one instance. */
export interface ConcurrencyLimiter {
  /** Queues `task` until a slot is free, in arrival order, and settles as it does. */
  run<T>(task: () => Promise<T>): Promise<T>;
}

/** Creates a {@link ConcurrencyLimiter} with at most `limit` tasks running. */
export function createConcurrencyLimiter(limit: number | undefined): ConcurrencyLimiter {
  const max = normalizeConcurrency(limit);
  let running = 0;
  const waiting: (() => void)[] = [];

  return {
    async run(task) {
      if (running < max) {
        running++;
      } else {
        await new Promise<void>(resolve => waiting.push(resolve));
      }

      try {
        return await task();
      } finally {
        // A finished task hands its slot straight to the next one, so `running` only drops when none waits.
        const next = waiting.shift();
        if (next) {
          next();
        } else {
          running--;
        }
      }
    },
  };
}
