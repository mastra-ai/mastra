import { randomUUID } from 'node:crypto';
import type { Event, EventCallback } from '@mastra/core/events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { REDIS_URL } from '../test-fixtures/harness';
import { RedisStreamsPubSub } from './index';

function makeEvent(overrides: Partial<Omit<Event, 'id' | 'createdAt'>> = {}): Omit<Event, 'id' | 'createdAt'> {
  return { type: 'test', data: {}, runId: 'run-1', ...overrides };
}

/**
 * An idle subscription's reader sits in a blocking XREADGROUP until a message
 * arrives. Unsubscribing used to close that connection with a graceful quit()
 * that could not complete until the block returned, so stop cost up to blockMs
 * per subscription (#30635). These tests pin the fixed behaviour against real
 * Redis: stop must not wait out the block, and must still drain a batch the
 * reader had already acquired.
 */
describe('redis-streams unsubscribe latency', () => {
  let pubsubs: RedisStreamsPubSub[] = [];

  function createPubSub(config: ConstructorParameters<typeof RedisStreamsPubSub>[0] = {}): RedisStreamsPubSub {
    const ps = new RedisStreamsPubSub({ url: REDIS_URL, blockMs: 1000, ...config });
    pubsubs.push(ps);
    return ps;
  }

  afterEach(async () => {
    await Promise.allSettled(pubsubs.map(ps => ps.close()));
    pubsubs = [];
  });

  it.each([true, false])('releases an idle subscription without waiting out blockMs (grouped=%s)', async grouped => {
    const ps = createPubSub({ reclaimIntervalMs: 0 });
    const topic = `latency-${randomUUID()}`;
    const cb = vi.fn();

    await ps.subscribe(topic, cb, grouped ? { group: 'workers' } : undefined);
    // Give the reader time to park in its blocking XREADGROUP, leaving ~850ms of
    // the 1000ms block outstanding.
    await new Promise(resolve => setTimeout(resolve, 150));

    const start = Date.now();
    await ps.unsubscribe(topic, cb);
    const elapsed = Date.now() - start;

    // ~850ms before the fix, single digits after; 400ms is far from both.
    expect(elapsed).toBeLessThan(400);
  });

  it('still delivers a batch that was already acquired when stop ran', async () => {
    const ps = createPubSub({ reclaimIntervalMs: 0 });
    const topic = `latency-drain-${randomUUID()}`;
    for (let i = 0; i < 10; i++) await ps.publish(topic, makeEvent({ runId: String(i) }));

    const delivered: string[] = [];
    let stop: Promise<void> | undefined;
    const cb: EventCallback = event => {
      delivered.push(event.runId);
      // Stop from inside the first delivery: the remaining nine entries belong
      // to a read that was already issued, so they must still be dispatched.
      if (delivered.length === 1) stop = ps.unsubscribe(topic, cb);
    };

    await ps.subscribe(topic, cb, { group: 'workers' });
    await expect.poll(() => stop !== undefined).toBe(true);
    await stop;

    expect(delivered).toEqual(Array.from({ length: 10 }, (_, i) => String(i)));
  });
});
