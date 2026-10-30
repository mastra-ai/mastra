/**
 * Proves against a real Redis that connecting is bounded: a server that
 * accepts the TCP connection but never answers the handshake (a SIGSTOPped
 * Redis, or a proxy that stopped forwarding) makes subscribe() reject within
 * `socket.connectTimeout` instead of hanging forever.
 */
import { randomUUID } from 'node:crypto';
import { connect, createServer } from 'node:net';
import type { AddressInfo, Socket } from 'node:net';
import { createClient } from 'redis';
import { afterEach, describe, expect, it } from 'vitest';

// AgentThreadStreamRuntime is internal to @mastra/core with no public export.
import { AgentThreadStreamRuntime } from '../../../packages/core/src/agent/thread-stream-runtime';
import { makeStallingProxy, REDIS_URL } from '../test-fixtures/harness';
import { RedisStreamsPubSub } from './index';

const CONNECT_TIMEOUT_MS = 500;

function settle(promise: Promise<unknown>, ms: number) {
  return Promise.race([
    promise.then(
      () => ({ status: 'resolved' as const }),
      (err: Error) => ({ status: 'rejected' as const, message: err.message }),
    ),
    new Promise<{ status: 'hung' }>(r => setTimeout(() => r({ status: 'hung' }), ms)),
  ]);
}

describe('RedisStreamsPubSub connect timeout', () => {
  let proxy: ReturnType<typeof makeStallingProxy>;
  let pubsub: RedisStreamsPubSub | undefined;
  let keyPrefix: string;

  async function createPubSub() {
    const upstream = new URL(REDIS_URL);
    proxy = makeStallingProxy({ host: upstream.hostname, port: Number(upstream.port) || 6379 });
    const port = await proxy.listening;
    keyPrefix = `connect-timeout-${randomUUID()}`;
    pubsub = new RedisStreamsPubSub({
      url: `redis://127.0.0.1:${port}`,
      keyPrefix,
      blockMs: 200,
      redisOptions: { socket: { connectTimeout: CONNECT_TIMEOUT_MS } },
    });
    return pubsub;
  }

  afterEach(async () => {
    proxy.resume();
    await pubsub?.close().catch(() => {});
    pubsub = undefined;
    await proxy.close();
  });

  it('rejects subscribe() when the server freezes before the first connect, then recovers', async () => {
    const ps = await createPubSub();
    proxy.stall();

    const started = Date.now();
    const outcome = await settle(
      ps.subscribe('topic', () => {}),
      5_000,
    );
    expect(outcome).toEqual({
      status: 'rejected',
      message: expect.stringContaining(`write client did not connect to Redis within ${CONNECT_TIMEOUT_MS}ms`),
    });
    expect(Date.now() - started).toBeLessThan(CONNECT_TIMEOUT_MS + 1_000);

    // The timed-out writer was destroyed, not wedged: it connects once Redis answers.
    proxy.resume();
    const received: string[] = [];
    await ps.subscribe('topic', (event, ack) => {
      received.push(event.runId);
      void ack?.();
    });
    await ps.publish('topic', { type: 'test', data: {}, runId: 'after-recovery' });
    await expect.poll(() => received, { timeout: 5_000 }).toEqual(['after-recovery']);
  }, 15_000);

  it("rejects subscribe() when the server freezes before the subscription's reader connects", async () => {
    const ps = await createPubSub();
    // Connect the writer first, so only the reader's connection is stalled.
    await ps.publish('warmup', { type: 'test', data: {}, runId: 'warmup' });
    proxy.stall();

    const outcome = await settle(
      ps.subscribe('topic', () => {}, { group: 'workers' }),
      5_000,
    );
    expect(outcome).toEqual({
      status: 'rejected',
      message: expect.stringContaining(`read client did not connect to Redis within ${CONNECT_TIMEOUT_MS}ms`),
    });
  }, 15_000);

  it("removes the fan-out group it created when the subscription's reader cannot connect", async () => {
    const ps = await createPubSub();
    await ps.publish('topic', { type: 'test', data: {}, runId: 'warmup' });
    proxy.stall();

    expect(
      await settle(
        ps.subscribe('topic', () => {}),
        5_000,
      ),
    ).toMatchObject({ status: 'rejected' });

    // Without cleanup every timed-out retry leaves another group on a live stream.
    const direct = createClient({ url: REDIS_URL });
    await direct.connect();
    try {
      await expect.poll(() => direct.xInfoGroups(`${keyPrefix}:topic`), { timeout: 2_000 }).toEqual([]);
    } finally {
      await direct.close();
    }
  }, 15_000);

  it('does not throw when close() destroys the writer just before the connect deadline', async () => {
    const ps = await createPubSub();
    proxy.stall();
    const uncaught: unknown[] = [];
    const onUncaught = (err: unknown) => uncaught.push(err);
    process.on('uncaughtException', onUncaught);
    try {
      // close() doesn't wait for lease calls, so it destroys the writer while
      // this call's connect is still pending; the deadline fires right after.
      const lease = settle(ps.acquireLease('lease', 'owner', 5_000), 5_000);
      await new Promise(r => setTimeout(r, CONNECT_TIMEOUT_MS - 50));
      await ps.close();
      expect(await lease).toMatchObject({ status: 'rejected' });
      await new Promise(r => setTimeout(r, CONNECT_TIMEOUT_MS));
    } finally {
      process.off('uncaughtException', onUncaught);
    }
    expect(uncaught).toEqual([]);
  }, 15_000);

  it('rejects subscribeToThread() instead of hanging when the server is frozen', async () => {
    const ps = await createPubSub();
    proxy.stall();

    const agent = { id: 'connect-timeout-agent' } as any;
    const outcome = await settle(
      new AgentThreadStreamRuntime().subscribeToThread(agent, { resourceId: 'r', threadId: randomUUID() }, ps),
      5_000,
    );
    expect(outcome).toEqual({
      status: 'rejected',
      message: expect.stringContaining('did not connect to Redis'),
    });
  }, 15_000);
});

describe('RedisStreamsPubSub connect timeout with a fully frozen server', () => {
  it('rejects subscribe() without waiting on group cleanup when the whole server freezes', async () => {
    // Unlike makeStallingProxy, this also stops forwarding on connections that
    // are already open, so the writer is frozen when the reader times out.
    let frozen = false;
    const sockets: Socket[] = [];
    const upstream = new URL(REDIS_URL);
    const server = createServer(client => {
      sockets.push(client);
      client.on('error', () => {});
      if (frozen) return;
      const redis = connect(Number(upstream.port) || 6379, upstream.hostname);
      sockets.push(redis);
      redis.on('error', () => {});
      client.on('data', d => void (frozen || redis.write(d)));
      redis.on('data', d => void (frozen || client.write(d)));
    });
    await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));
    const ps = new RedisStreamsPubSub({
      url: `redis://127.0.0.1:${(server.address() as AddressInfo).port}`,
      keyPrefix: `connect-timeout-${randomUUID()}`,
      blockMs: 200,
      redisOptions: { socket: { connectTimeout: CONNECT_TIMEOUT_MS } },
    });
    try {
      await ps.publish('warmup', { type: 'test', data: {}, runId: 'warmup' });
      server.once('connection', () => void (frozen = true));

      expect(
        await settle(
          ps.subscribe('topic', () => {}),
          5_000,
        ),
      ).toEqual({
        status: 'rejected',
        message: expect.stringContaining(`read client did not connect to Redis within ${CONNECT_TIMEOUT_MS}ms`),
      });
    } finally {
      for (const s of sockets) s.destroy();
      server.close();
      await settle(ps.close(), 2_000);
    }
  }, 15_000);
});
