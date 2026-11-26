import { randomUUID } from 'node:crypto';
import type { Event, EventCallback } from '@mastra/core/events';
import { afterEach, describe, expect, it } from 'vitest';
import { RedisStreamsPubSub } from './index';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6381';

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => {
    resolve = res;
  });
  return { promise, resolve };
}

// A workflow step that finishes while its process is shutting down fails to
// publish its result, releases its step lease and nacks. The nack republishes
// through the writer that close() keeps open, so the lease release must reach
// Redis too; otherwise the worker that gets the redelivery finds the lease held and
// drops the step.
describe('releaseLease while close() is in progress', () => {
  let pubsubs: RedisStreamsPubSub[] = [];

  afterEach(async () => {
    await Promise.all(pubsubs.map(p => p.close()));
    pubsubs = [];
  });

  it('frees the lease for the worker that receives the nacked delivery', async () => {
    const keyPrefix = `close-release-${randomUUID()}`;
    const topic = 'workflows';
    const group = 'workers';
    const leaseKey = 'workflow-step-run:run-1:event-1';
    // A's large blockMs keeps close() waiting on the `hold` reader until the
    // test publishes to it.
    const a = new RedisStreamsPubSub({ url: REDIS_URL, keyPrefix, blockMs: 20_000 });
    const b = new RedisStreamsPubSub({ url: REDIS_URL, keyPrefix, blockMs: 50 });
    pubsubs.push(a, b);

    const stepStarted = deferred<{ acquired: boolean; owner?: string }>();
    const closeStarted = deferred();
    const nacked = deferred();
    let closeResolved = false;
    let closeResolvedAtRelease: boolean | undefined;

    const workerA: EventCallback = async (event, ack, nack) => {
      if (event.type !== 'step.run') return ack?.();
      stepStarted.resolve(await a.acquireLease(leaseKey, 'a', 30_000));
      await closeStarted.promise;
      closeResolvedAtRelease = closeResolved;
      await a.releaseLease(leaseKey, 'a');
      await nack?.();
      nacked.resolve();
    };
    await a.subscribe(topic, workerA, { group });
    await a.subscribe('hold', async (_event, ack) => ack?.());

    await a.publish(topic, { type: 'step.run', data: {}, runId: 'run-1' });
    expect(await stepStarted.promise).toEqual({ acquired: true, owner: 'a' });

    // The worker stops consuming before the pubsub closes. A's stopped reader
    // still delivers what its pending read returns, so wake it with an entry
    // the handler acks; otherwise it would take the nacked copy itself.
    const unsubscribed = a.unsubscribe(topic, workerA);
    await b.publish(topic, { type: 'wake', data: {}, runId: 'run-1' });
    await unsubscribed;

    const closing = a.close().then(() => {
      closeResolved = true;
    });
    closeStarted.resolve();
    await nacked.promise;
    await b.publish('hold', { type: 'wake', data: {}, runId: 'run-1' });
    await closing;
    expect(closeResolvedAtRelease).toBe(false);

    const redelivered = deferred<Event>();
    await b.subscribe(
      topic,
      async (event, ack) => {
        await ack?.();
        if (event.type === 'step.run') redelivered.resolve(event);
      },
      { group },
    );
    expect((await redelivered.promise).deliveryAttempt).toBe(2);
    expect(await b.acquireLease(leaseKey, 'b', 30_000)).toEqual({ acquired: true, owner: 'b' });
  });
});
