import type { MCPEventOccurrence, MCPEventSubscription } from '../../client/events';

/** Takes exactly `count` occurrences from a subscription, failing if they don't all arrive in time. */
export async function take(subscription: MCPEventSubscription, count: number, timeoutMs = 10_000) {
  const iterator = subscription[Symbol.asyncIterator]();
  const received: MCPEventOccurrence[] = [];
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Timed out after ${received.length}/${count} occurrences of '${subscription.name}'`)),
      timeoutMs,
    );
  });
  try {
    while (received.length < count) {
      const next = await Promise.race([iterator.next(), timeout]);
      if (next.done) throw new Error(`Subscription ended after ${received.length}/${count} occurrences`);
      received.push(next.value);
    }
  } finally {
    clearTimeout(timer);
  }
  return received;
}

export async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('Expected the promise to reject');
    },
    (error: unknown) => error,
  );
}
