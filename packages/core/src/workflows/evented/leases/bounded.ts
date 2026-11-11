/** Bounded concurrency for the lease modules that write or read many keys at once. */

/** Runs `task` over `items`, at most `concurrency` at a time. */
export async function forEachBounded<T>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];

  // Each worker takes the next item once its previous one settles, until the queue is empty.
  const next = async (): Promise<void> => {
    const item = queue.shift();
    if (item === undefined) {
      return;
    }

    await task(item);
    return next();
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, next));
}
