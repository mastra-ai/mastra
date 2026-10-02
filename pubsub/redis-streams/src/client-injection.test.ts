import { randomUUID } from 'node:crypto';
import type { Event, EventCallback } from '@mastra/core/events';
import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RedisStreamsPubSub } from './index';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6381';

function makeEvent(): Event {
  return { id: randomUUID(), type: 'test', data: { ts: Date.now() } };
}

async function waitFor(pred: () => boolean, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!pred()) {
    if (Date.now() > deadline) throw new Error('waitFor timed out');
    await new Promise(r => setTimeout(r, 20));
  }
}

function quietClient(): RedisClientType {
  const c = createClient({ url: REDIS_URL }) as RedisClientType;
  c.on('error', () => {});
  return c;
}

/**
 * Wrap a real standalone client so it behaves like node-redis Cluster during
 * the initial connect:
 *  - `isOpen` flips true synchronously inside connect() (cluster-slots.js), and
 *  - any command issued before slot discovery finishes crashes in slot lookup
 *    with "Cannot read properties of undefined (reading 'master')".
 * A standalone client instead queues early commands, which is why the race
 * is invisible against a plain server.
 */
function makeClusterLikeClient(discoveryMs: number): { client: RedisClientType; connectCalls: () => number } {
  const real = quietClient();
  let discovered = false;
  let connectCalls = 0;
  const realConnect = real.connect.bind(real);
  const client = new Proxy(real, {
    get(target, prop, receiver) {
      if (prop === 'connect') {
        return async () => {
          connectCalls += 1;
          const p = realConnect(); // isOpen is now true, synchronously
          await new Promise(r => setTimeout(r, discoveryMs));
          await p;
          discovered = true;
          return receiver;
        };
      }
      const v = Reflect.get(target, prop, target);
      if (typeof v === 'function' && prop !== 'on' && prop !== 'once' && prop !== 'off' && prop !== 'duplicate') {
        return (...args: unknown[]) => {
          if (target.isOpen && !discovered) {
            throw new TypeError(`Cannot read properties of undefined (reading 'master') [via ${String(prop)}]`);
          }
          return v.apply(target, args);
        };
      }
      return v;
    },
  }) as RedisClientType;
  return { client, connectCalls: () => connectCalls };
}

describe('RedisStreamsPubSub client injection', () => {
  let pubsubs: RedisStreamsPubSub[] = [];

  afterEach(async () => {
    await Promise.all(pubsubs.map(p => p.close()));
    pubsubs = [];
  });

  it('uses the injected client as the writer and duplicate()s it for each reader', async () => {
    const client = quietClient();
    const duplicate = vi.spyOn(client, 'duplicate');

    const ps = new RedisStreamsPubSub({ client, blockMs: 200 });
    pubsubs.push(ps);

    const topic = `t-${randomUUID()}`;
    let received = 0;
    const cb: EventCallback = (_event, ack) => {
      received += 1;
      void ack?.();
    };
    await ps.subscribe(topic, cb);
    await ps.subscribe(topic, async (_e, ack) => void ack?.());
    await ps.publish(topic, makeEvent());
    await waitFor(() => received === 1);

    expect(duplicate).toHaveBeenCalledTimes(2);
    expect(client.isOpen).toBe(true);
  });

  it('rejects an already-connected client', async () => {
    const client = quietClient();
    await client.connect();
    try {
      expect(() => new RedisStreamsPubSub({ client })).toThrow(/must not be connected/);
    } finally {
      await client.quit();
    }
  });

  it('rejects combining client, cluster, or url/redisOptions', () => {
    expect(() => new RedisStreamsPubSub({ client: quietClient(), url: REDIS_URL })).toThrow(/mutually exclusive/);
    expect(() => new RedisStreamsPubSub({ client: quietClient(), redisOptions: {} })).toThrow(/mutually exclusive/);
    expect(() => new RedisStreamsPubSub({ cluster: { rootNodes: [] }, url: REDIS_URL })).toThrow(/mutually exclusive/);
    expect(() => new RedisStreamsPubSub({ cluster: { rootNodes: [] }, client: quietClient() })).toThrow(
      /mutually exclusive/,
    );
  });

  it('awaits one in-flight writer connect across concurrent cold callers (cluster isOpen semantics)', async () => {
    const writer = makeClusterLikeClient(50);
    const ps = new RedisStreamsPubSub({ client: writer.client, blockMs: 200 });
    pubsubs.push(ps);

    const topics = Array.from({ length: 8 }, () => `t-${randomUUID()}`);
    let received = 0;
    const cb: EventCallback = (_event, ack) => {
      received += 1;
      void ack?.();
    };

    // Without the shared connect promise, callers 2..8 see isOpen=true during
    // discovery and crash in XGROUP CREATE.
    await Promise.all([...topics.map(t => ps.subscribe(t, cb)), ps.publish(topics[0]!, makeEvent())]);
    await waitFor(() => received === 1);

    expect(writer.connectCalls()).toBe(1);
  });

  it('retries the initial connect after a failure', async () => {
    const client = quietClient();
    let fail = true;
    const realConnect = client.connect.bind(client);
    // @ts-expect-error - override with a wrapper that fails once.
    client.connect = async () => {
      if (fail) {
        fail = false;
        throw new Error('boom');
      }
      return realConnect();
    };
    const ps = new RedisStreamsPubSub({ client, blockMs: 200 });
    pubsubs.push(ps);

    const topic = `t-${randomUUID()}`;
    await expect(ps.subscribe(topic, () => {})).rejects.toThrow('boom');
    await expect(ps.subscribe(topic, () => {})).resolves.toBeUndefined();
  });

  it('still builds a standalone client from url/redisOptions when nothing is injected (back-compat)', async () => {
    const ps = new RedisStreamsPubSub({ redisOptions: { url: REDIS_URL }, blockMs: 200 });
    pubsubs.push(ps);

    const topic = `t-${randomUUID()}`;
    let received = 0;
    await ps.subscribe(topic, (_e, ack) => {
      received += 1;
      void ack?.();
    });
    await ps.publish(topic, makeEvent());
    await waitFor(() => received === 1);
  });
});
