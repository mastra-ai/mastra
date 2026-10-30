/**
 * Proves against a real Redis that connecting is bounded: a server that
 * accepts the TCP connection but never answers the handshake (a SIGSTOPped
 * Redis, or a proxy that stopped forwarding) makes subscribe() reject within
 * `socket.connectTimeout` instead of hanging forever.
 */
import { randomUUID } from 'node:crypto';
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

  async function createPubSub() {
    const upstream = new URL(REDIS_URL);
    proxy = makeStallingProxy({ host: upstream.hostname, port: Number(upstream.port) || 6379 });
    const port = await proxy.listening;
    pubsub = new RedisStreamsPubSub({
      url: `redis://127.0.0.1:${port}`,
      keyPrefix: `connect-timeout-${randomUUID()}`,
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
