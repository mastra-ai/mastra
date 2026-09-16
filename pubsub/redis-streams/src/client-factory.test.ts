import { randomUUID } from 'node:crypto';
import type { Event, EventCallback } from '@mastra/core/events';
import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RedisStreamsPubSub } from './index';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6381';

function makeEvent(overrides: Partial<Omit<Event, 'id' | 'createdAt'>> = {}): Omit<Event, 'id' | 'createdAt'> {
  return {
    type: 'test',
    data: {},
    runId: 'run-1',
    ...overrides,
  };
}

async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await new Promise(r => setTimeout(r, 25));
  }
  if (!predicate()) throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

/**
 * Wrap a real node-redis client so tests can back the pubsub with a live server
 * (matching this package's integration-test convention) while spying on the
 * client's lifecycle. The `connect` wrapper counts calls and can be given an
 * artificial delay to widen the concurrent-cold-start race window.
 */
function makeSpiedClient(connectDelayMs = 0): { client: RedisClientType; connectCalls: () => number } {
  const client = createClient({ url: REDIS_URL }) as RedisClientType;
  client.on('error', () => {});
  let connectCalls = 0;
  const realConnect = client.connect.bind(client);
  // @ts-expect-error - override the method with a counting/delaying wrapper.
  client.connect = async (...args: unknown[]) => {
    connectCalls += 1;
    if (connectDelayMs > 0) await new Promise(r => setTimeout(r, connectDelayMs));
    // @ts-expect-error - forward to the real implementation.
    return realConnect(...args);
  };
  return { client, connectCalls: () => connectCalls };
}

describe('RedisStreamsPubSub clientFactory', () => {
  let pubsubs: RedisStreamsPubSub[] = [];

  afterEach(async () => {
    await Promise.all(pubsubs.map(p => p.close()));
    pubsubs = [];
  });

  it('invokes clientFactory once for the writer and once per subscription reader', async () => {
    const produced: ReturnType<typeof makeSpiedClient>[] = [];
    const factory = vi.fn(() => {
      const spied = makeSpiedClient();
      produced.push(spied);
      return spied.client;
    });

    const ps = new RedisStreamsPubSub({ clientFactory: factory, blockMs: 200 });
    pubsubs.push(ps);

    // Writer client is created eagerly in the constructor.
    expect(factory).toHaveBeenCalledTimes(1);

    const topicA = `t-${randomUUID()}`;
    const topicB = `t-${randomUUID()}`;
    const cb: EventCallback = (_event, ack) => void ack?.();

    await ps.subscribe(topicA, cb);
    await ps.subscribe(topicB, cb);

    // One writer + one reader per subscription.
    expect(factory).toHaveBeenCalledTimes(3);
    // Every produced client was connected exactly once.
    for (const spied of produced) {
      expect(spied.connectCalls()).toBe(1);
    }
  });

  it('dedupes concurrent cold callers onto a single writer connect()', async () => {
    const writer = makeSpiedClient(50);
    let writerHandedOut = false;
    const factory = () => {
      if (!writerHandedOut) {
        writerHandedOut = true;
        return writer.client;
      }
      // Readers use plain live clients.
      const reader = createClient({ url: REDIS_URL }) as RedisClientType;
      reader.on('error', () => {});
      return reader;
    };

    const ps = new RedisStreamsPubSub({ clientFactory: factory, blockMs: 200 });
    pubsubs.push(ps);

    const topics = Array.from({ length: 8 }, () => `t-${randomUUID()}`);
    const cb: EventCallback = (_event, ack) => void ack?.();

    // Fire many cold operations that all race to open the shared writer.
    await Promise.all([...topics.map(t => ps.subscribe(t, cb)), ps.publish(topics[0]!, makeEvent())]);

    expect(writer.connectCalls()).toBe(1);
  });

  it('still uses redisOptions when no clientFactory is provided (back-compat)', async () => {
    const ps = new RedisStreamsPubSub({ redisOptions: { url: REDIS_URL }, blockMs: 200 });
    pubsubs.push(ps);

    const topic = `t-${randomUUID()}`;
    const received: Event[] = [];
    const cb: EventCallback = (event, ack) => {
      received.push(event);
      void ack?.();
    };

    await ps.subscribe(topic, cb);
    await ps.publish(topic, makeEvent({ type: 'hello' }));

    await waitFor(() => received.length === 1);
    expect(received[0]!.type).toBe('hello');
  });
});
