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
