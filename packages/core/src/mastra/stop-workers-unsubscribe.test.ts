import { describe, expect, it } from 'vitest';
import type { PubSub as PubSubType } from '../events/pubsub';
import { PubSub } from '../events/pubsub';
import type { Event, EventCallback, SubscribeOptions } from '../events/types';
import { Mastra } from './index';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => {
    resolve = res;
  });
  return { promise, resolve };
}

/**
 * Unsubscribe parks until released, so the test can see how many unsubscribes
 * stopWorkers() has started before any of them settles. A sequential loop would
 * still be sitting on the first one.
 */
class ParkingPubSub extends PubSub implements PubSubType {
  readonly unsubscribed: string[] = [];
  readonly release = deferred<void>();

  async publish(): Promise<void> {}
  async subscribe(_topic: string, _cb: EventCallback, _options?: SubscribeOptions): Promise<void> {}
  async unsubscribe(topic: string, _cb: EventCallback): Promise<void> {
    this.unsubscribed.push(topic);
    await this.release.promise;
  }
  async flush(): Promise<void> {}
}

describe('Mastra.stopWorkers() user event unsubscribe', () => {
  it('unsubscribes every user event listener concurrently, not one at a time', async () => {
    const pubsub = new ParkingPubSub();
    // workers: false keeps the test to the user-listener subscriptions alone.
    const mastra = new Mastra({
      logger: false,
      workers: false,
      pubsub,
      events: {
        'topic-a': (_event: Event) => {},
        'topic-b': (_event: Event) => {},
      },
    });
    await mastra.startWorkers();

    const stopped = mastra.stopWorkers();
    // One turn of the microtask queue is enough for a concurrent loop to reach
    // every unsubscribe; a sequential loop would still be parked on the first.
    await new Promise(resolve => setTimeout(resolve, 0));

    expect([...pubsub.unsubscribed].sort()).toEqual(['topic-a', 'topic-b']);

    pubsub.release.resolve();
    await stopped;
  });
});
