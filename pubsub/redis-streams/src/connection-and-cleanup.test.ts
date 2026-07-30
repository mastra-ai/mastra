import { randomUUID } from 'node:crypto';
import net from 'node:net';
import type { Event, EventCallback } from '@mastra/core/events';
import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import { afterEach, describe, expect, it } from 'vitest';
import { getFreePort, REDIS_URL } from '../test-fixtures/harness';
import { RedisStreamsPubSub } from './index';

function makeEvent(overrides: Partial<Omit<Event, 'id' | 'createdAt'>> = {}): Omit<Event, 'id' | 'createdAt'> {
  return {
    type: 'test',
    data: {},
    runId: 'run-1',
    ...overrides,
  };
}

/**
 * TCP proxy in front of Redis whose live connections we can sever on demand,
 * simulating a server-side drop (Redis restart / OOM-kill / idle reset) that
 * the client did not initiate.
 */
function makeSeverableProxy(targetUrl: string) {
  const parsed = new URL(targetUrl);
  const hostname = parsed.hostname;
  // A portless redis:// URL yields port === '' → Number('') === 0; fall back to
  // the Redis default so the proxy dials the real server, not port 0.
  const upstreamPort = Number(parsed.port) || 6379;
  const sockets = new Set<net.Socket>();
  const server = net.createServer(client => {
    const upstream = net.connect(upstreamPort, hostname);
    sockets.add(client);
    sockets.add(upstream);
    client.on('close', () => sockets.delete(client));
    upstream.on('close', () => sockets.delete(upstream));
    client.on('error', () => {});
    upstream.on('error', () => {});
    client.pipe(upstream);
    upstream.pipe(client);
  });
  const listening = new Promise<number>(resolve => {
    server.listen(0, '127.0.0.1', () => resolve((server.address() as net.AddressInfo).port));
  });
  return {
    listening,
    sever() {
      for (const s of sockets) s.destroy();
      sockets.clear();
    },
    close() {
      this.sever();
      return new Promise<void>(r => server.close(() => r()));
    },
  };
}

describe('RedisStreamsPubSub connection resilience and topic cleanup', () => {
  let pubsubs: RedisStreamsPubSub[] = [];
  let inspectors: RedisClientType[] = [];

  function createPubSub(config: ConstructorParameters<typeof RedisStreamsPubSub>[0] = {}): RedisStreamsPubSub {
    const ps = new RedisStreamsPubSub({ url: REDIS_URL, blockMs: 200, ...config });
    pubsubs.push(ps);
    return ps;
  }

  async function createInspector(): Promise<RedisClientType> {
    const client = createClient({ url: REDIS_URL }) as RedisClientType;
    client.on('error', () => {});
    await client.connect();
    inspectors.push(client);
    return client;
  }

  afterEach(async () => {
    await Promise.allSettled(pubsubs.map(ps => ps.close()));
    pubsubs = [];
    await Promise.allSettled(inspectors.map(c => c.destroy()));
    inspectors = [];
  });

  describe('connection drops', () => {
    it('survives a server-side socket close: no unhandled error, publish recovers', async () => {
      const proxy = makeSeverableProxy(REDIS_URL);
      const unhandled: unknown[] = [];
      const onUncaught = (err: unknown) => unhandled.push(err);
      process.on('uncaughtException', onUncaught);

      // Not registered with createPubSub(): this instance must close while the
      // proxy is still up (a client stranded behind a dead proxy retries its
      // reconnect forever, so a later close() would hang the afterEach hook).
      let ps: RedisStreamsPubSub | undefined;
      try {
        const port = await proxy.listening;
        ps = new RedisStreamsPubSub({ url: `redis://127.0.0.1:${port}`, blockMs: 200 });
        const topic = `sever-${randomUUID()}`;
        const received: Event[] = [];
        const cb: EventCallback = (event, ack) => {
          received.push(event);
          void ack?.();
        };
        await ps.subscribe(topic, cb);

        await ps.publish(topic, makeEvent({ data: { n: 1 } }));
        await expect.poll(() => received.length, { timeout: 5000 }).toBe(1);

        // Drop every live connection out from under the client, as a Redis
        // restart would. node-redis reconnects on its own — but only if an
        // 'error' listener exists; without one this test hangs on the next
        // publish and records an uncaughtException.
        proxy.sever();
        await new Promise(r => setTimeout(r, 300));

        const outcome = await Promise.race([
          ps.publish(topic, makeEvent({ data: { n: 2 } })).then(() => 'resolved' as const),
          new Promise<'hung'>(r => setTimeout(() => r('hung'), 8000)),
        ]);
        expect(outcome).toBe('resolved');
        await expect.poll(() => received.length, { timeout: 5000 }).toBe(2);
        expect(unhandled).toEqual([]);
      } finally {
        process.off('uncaughtException', onUncaught);
        // Order matters: close the pubsub while the proxy still forwards, THEN
        // tear the proxy down (see the note on `ps` above).
        if (ps) await ps.close().catch(() => {});
        await proxy.close();
      }
    }, 30_000);
  });

  describe('clearTopic', () => {
    it('deletes the topic stream so finished runs release their memory', async () => {
      const ps = createPubSub();
      const topic = `clear-${randomUUID()}`;
      await ps.publish(topic, makeEvent());
      await ps.publish(topic, makeEvent());

      const inspector = await createInspector();
      const streamKey = `mastra:topic:${topic}`;
      expect(await inspector.exists(streamKey)).toBe(1);

      await ps.clearTopic(topic);
      expect(await inspector.exists(streamKey)).toBe(0);
    }, 15_000);

    it('is a no-op for a topic that was never published to', async () => {
      const ps = createPubSub();
      await expect(ps.clearTopic(`never-${randomUUID()}`)).resolves.toBeUndefined();
    }, 15_000);

    it('lets a still-attached subscriber recover after the stream is deleted', async () => {
      const ps = createPubSub();
      const topic = `clear-live-${randomUUID()}`;
      const received: string[] = [];
      await ps.subscribe(topic, (event, ack) => {
        received.push((event.data as { n: number }).n.toString());
        void ack?.();
      });

      await ps.publish(topic, makeEvent({ data: { n: 1 } }));
      await expect.poll(() => received, { timeout: 5000 }).toContain('1');

      // Delete the stream (and its consumer group) out from under the live
      // reader, then publish again. Without NOGROUP recovery in the read loop
      // the subscriber would be permanently deaf; with it, delivery resumes.
      await ps.clearTopic(topic);
      await ps.publish(topic, makeEvent({ data: { n: 2 } }));
      await expect.poll(() => received, { timeout: 5000 }).toContain('2');
    }, 20_000);
  });

  describe('streamIdleTtlMs', () => {
    it('stamps a rolling TTL on the stream key when configured (atomically with the write)', async () => {
      const ps = createPubSub({ streamIdleTtlMs: 60_000 });
      const topic = `ttl-${randomUUID()}`;
      await ps.publish(topic, makeEvent());

      const inspector = await createInspector();
      // No polling: XADD and PEXPIRE run in one MULTI, so the TTL must already
      // be set the moment publish() resolves. A detached PEXPIRE could fail or
      // be skipped (process exit) after the XADD — and on the topic's *last*
      // write there is no next write to self-heal, leaving an immortal stream
      // despite the TTL.
      const pttl = await inspector.pTTL(`mastra:topic:${topic}`);
      expect(pttl).toBeGreaterThan(0);
      expect(pttl).toBeLessThanOrEqual(60_000);
    }, 15_000);

    it('leaves streams persistent by default', async () => {
      const ps = createPubSub();
      const topic = `nottl-${randomUUID()}`;
      await ps.publish(topic, makeEvent());

      const inspector = await createInspector();
      // -1 = key exists with no TTL.
      expect(await inspector.pTTL(`mastra:topic:${topic}`)).toBe(-1);
    }, 15_000);

    it('rejects an invalid streamIdleTtlMs (negative, NaN, Infinity, or non-integer)', () => {
      // Redis PEXPIRE requires an integer; a bad value would otherwise fail
      // silently on every publish and leave streams unbounded.
      for (const bad of [-1, NaN, Infinity, 1000.5]) {
        expect(() => new RedisStreamsPubSub({ url: REDIS_URL, streamIdleTtlMs: bad })).toThrow(/streamIdleTtlMs/);
      }
    });

    it('refreshes the TTL on a nack retry republish', async () => {
      const ps = createPubSub({ streamIdleTtlMs: 60_000, maxDeliveryAttempts: 3 });
      const topic = `ttl-nack-${randomUUID()}`;
      const inspector = await createInspector();
      const streamKey = `mastra:topic:${topic}`;

      let attempts = 0;
      await ps.subscribe(topic, (_event, ack, nack) => {
        attempts += 1;
        if (attempts === 1) {
          // Force the TTL down to simulate a retry landing near the end of the
          // original window, then nack so it is republished.
          void inspector.pExpire(streamKey, 1000).then(() => nack?.());
        } else {
          void ack?.();
        }
      });

      await ps.publish(topic, makeEvent());
      await expect.poll(() => attempts, { timeout: 5000 }).toBeGreaterThanOrEqual(2);

      // The republish must have refreshed the TTL well above the forced 1000ms.
      await expect.poll(async () => await inspector.pTTL(streamKey), { timeout: 3000 }).toBeGreaterThan(5000);
    }, 15_000);

    it('reapplies the TTL when the read loop recreates a deleted stream (no publish)', async () => {
      const ps = createPubSub({ streamIdleTtlMs: 60_000 });
      const topic = `ttl-recreate-${randomUUID()}`;
      const inspector = await createInspector();
      const streamKey = `mastra:topic:${topic}`;

      await ps.subscribe(topic, (_event, ack) => void ack?.());
      await ps.publish(topic, makeEvent());
      await expect.poll(async () => await inspector.exists(streamKey), { timeout: 5000 }).toBe(1);

      // Delete the stream; the read loop recreates the group via MKSTREAM. With
      // no publish afterwards, the recreated empty stream must still carry a TTL
      // (otherwise it would linger forever).
      await ps.clearTopic(topic);
      await expect.poll(async () => await inspector.pTTL(streamKey), { timeout: 5000 }).toBeGreaterThan(0);
    }, 15_000);

    it('tolerates same-group subscribers racing to recreate a deleted stream (BUSYGROUP in MULTI)', async () => {
      // Two subscribers in one consumer group: deleting the stream sends both
      // read loops into NOGROUP recovery, so the loser's XGROUP CREATE hits
      // BUSYGROUP — which, inside the recovery MULTI, surfaces as a
      // MultiErrorReply whose message does NOT contain "BUSYGROUP" (it lives in
      // err.replies). Recovery must treat that as success: no error logged, TTL
      // still applied, delivery resumed.
      const logged: string[] = [];
      const logger = {
        debug: (msg: unknown) => logged.push(String(msg)),
        warn: (msg: unknown) => logged.push(String(msg)),
      };
      const ps1 = createPubSub({ streamIdleTtlMs: 60_000, logger });
      const ps2 = createPubSub({ streamIdleTtlMs: 60_000, logger });
      const topic = `busygroup-${randomUUID()}`;
      const group = 'workers';
      const received: number[] = [];
      const cb: EventCallback = (event, ack) => {
        received.push((event.data as { n: number }).n);
        void ack?.();
      };
      await ps1.subscribe(topic, cb, { group });
      await ps2.subscribe(topic, cb, { group });

      await ps1.publish(topic, makeEvent({ data: { n: 1 } }));
      await expect.poll(() => received, { timeout: 5000 }).toContain(1);

      const inspector = await createInspector();
      const streamKey = `mastra:topic:${topic}`;
      await ps1.clearTopic(topic);

      // Both loops recover; the recreated stream carries a TTL and delivery works.
      await expect.poll(async () => await inspector.pTTL(streamKey), { timeout: 5000 }).toBeGreaterThan(0);
      await ps1.publish(topic, makeEvent({ data: { n: 2 } }));
      await expect.poll(() => received, { timeout: 5000 }).toContain(2);
      expect(logged.filter(m => m.includes('re-create failed'))).toEqual([]);
    }, 20_000);
  });

  describe('failure observability', () => {
    it('logs clearTopic failures at warn level instead of swallowing them silently', async () => {
      // Point at a port nobody listens on, with reconnection disabled so the
      // lazy connect fails fast. clearTopic must still resolve (callers invoke
      // it fire-and-forget) but the failure has to surface at warn — a failed
      // delete means the memory leak clearTopic exists to prevent is recurring.
      const port = await getFreePort();
      const warns: string[] = [];
      const ps = new RedisStreamsPubSub({
        url: `redis://127.0.0.1:${port}`,
        redisOptions: { socket: { reconnectStrategy: false } },
        logger: { warn: (msg: unknown) => warns.push(String(msg)) },
      });
      await expect(ps.clearTopic('some-topic')).resolves.toBeUndefined();
      expect(warns.some(m => m.includes('clearTopic failed'))).toBe(true);
    }, 15_000);
  });
});
