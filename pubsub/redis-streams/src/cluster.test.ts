import { randomUUID } from 'node:crypto';
import type { Event, EventCallback } from '@mastra/core/events';
import { createClient, createCluster } from 'redis';
import { afterEach, describe, expect, it } from 'vitest';
import { makeStallingProxy } from '../test-fixtures/harness';
import { RedisStreamsPubSub } from './index';

// Single-node cluster from docker-compose.yaml (cluster-mode enabled, all
// slots assigned). Exercises real slot discovery and command routing.
const CLUSTER_URL = process.env.REDIS_CLUSTER_URL ?? 'redis://localhost:6382';

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

describe('RedisStreamsPubSub against Redis Cluster', () => {
  let pubsubs: RedisStreamsPubSub[] = [];

  afterEach(async () => {
    await Promise.all(pubsubs.map(p => p.close()));
    pubsubs = [];
  });

  it('cold-starts many concurrent subscriptions and delivers via the `cluster` option', async () => {
    const ps = new RedisStreamsPubSub({ cluster: { rootNodes: [{ url: CLUSTER_URL }] }, blockMs: 200 });
    pubsubs.push(ps);

    const topics = Array.from({ length: 8 }, () => `t-${randomUUID()}`);
    let received = 0;
    const cb: EventCallback = (_event, ack) => {
      received += 1;
      void ack?.();
    };

    // This is the sequence from #23866: every caller races the writer's first
    // connect() while slot discovery is still running.
    await Promise.all(topics.map(t => ps.subscribe(t, cb)));
    await Promise.all(topics.map(t => ps.publish(t, makeEvent())));
    await waitFor(() => received === 8);
  });

  it('accepts a caller-built cluster client via `client`', async () => {
    const client = createCluster({ rootNodes: [{ url: CLUSTER_URL }] });
    client.on('error', () => {});
    const ps = new RedisStreamsPubSub({ client, blockMs: 200 });
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

  it('runs the single-key Lua paths (lease + nack redelivery) on a cluster', async () => {
    const ps = new RedisStreamsPubSub({
      cluster: { rootNodes: [{ url: CLUSTER_URL }] },
      blockMs: 200,
      maxDeliveryAttempts: 3,
    });
    pubsubs.push(ps);

    // Lease acquire/refresh/release go through EVAL with one key each.
    const lease = `lease-${randomUUID()}`;
    expect((await ps.acquireLease(lease, 'a', 1_000)).acquired).toBe(true);
    expect(await ps.acquireLease(lease, 'b', 1_000)).toEqual({ acquired: false, owner: 'a' });
    expect(await ps.renewLease(lease, 'a', 1_000)).toBe(true);
    await ps.releaseLease(lease, 'a');
    expect((await ps.acquireLease(lease, 'b', 1_000)).acquired).toBe(true);

    // nack republishes via MULTI(XADD, PEXPIRE) then XACK — same key.
    const topic = `t-${randomUUID()}`;
    const attempts: number[] = [];
    await ps.subscribe(topic, (event, ack, nack) => {
      attempts.push((event as Event & { deliveryAttempt?: number }).deliveryAttempt ?? 1);
      if (attempts.length < 3) void nack?.();
      else void ack?.();
    });
    await ps.publish(topic, makeEvent());
    await waitFor(() => attempts.length === 3);
    expect(attempts).toEqual([1, 2, 3]);
  });

  describe('connect timeout', () => {
    const CONNECT_TIMEOUT_MS = 500;
    let proxies: ReturnType<typeof makeStallingProxy>[] = [];

    afterEach(async () => {
      for (const p of proxies) p.resume();
      await Promise.all(pubsubs.map(p => p.close().catch(() => {})));
      pubsubs = [];
      await Promise.all(proxies.map(p => p.close()));
      proxies = [];
    });

    /**
     * Put a stalling proxy in front of every cluster node and route slot
     * discovery through them with nodeAddressMap, so a test can freeze new
     * connections to the whole cluster without touching the shared server.
     */
    async function createProxiedPubSub(name?: string) {
      const probe = createClient({ url: CLUSTER_URL });
      await probe.connect();
      const slots = (await probe.sendCommand(['CLUSTER', 'SLOTS'])) as Array<Array<unknown>>;
      await probe.close();
      const routes = new Map<string, { host: string; port: number }>();
      for (const slot of slots) {
        const [host, port] = slot[2] as [string, number];
        const address = `${host}:${port}`;
        if (routes.has(address)) continue;
        const proxy = makeStallingProxy({ host, port: Number(port) });
        proxies.push(proxy);
        routes.set(address, { host: '127.0.0.1', port: await proxy.listening });
      }
      const root = [...routes.values()][0]!;
      const ps = new RedisStreamsPubSub({
        cluster: {
          rootNodes: [{ url: `redis://${root.host}:${root.port}` }],
          nodeAddressMap: (address: string) => routes.get(address)!,
          defaults: { name, socket: { connectTimeout: CONNECT_TIMEOUT_MS } },
        },
        keyPrefix: `cluster-connect-timeout-${randomUUID()}`,
        blockMs: 200,
      });
      pubsubs.push(ps);
      return { ps, nodes: [...routes.keys()] };
    }

    function settle(promise: Promise<unknown>, ms = 5_000) {
      return Promise.race([
        promise.then(
          () => ({ status: 'resolved' as const }),
          (err: Error) => ({ status: 'rejected' as const, message: err.message }),
        ),
        new Promise<{ status: 'hung' }>(r => setTimeout(() => r({ status: 'hung' }), ms)),
      ]);
    }

    it('rejects subscribe() when the cluster freezes before the first connect, then recovers', async () => {
      const { ps } = await createProxiedPubSub();
      for (const p of proxies) p.stall();

      const started = Date.now();
      expect(await settle(ps.subscribe(`t-${randomUUID()}`, () => {}))).toEqual({
        status: 'rejected',
        message: expect.stringContaining(`write client did not connect to Redis within ${CONNECT_TIMEOUT_MS}ms`),
      });
      expect(Date.now() - started).toBeLessThan(CONNECT_TIMEOUT_MS + 1_000);

      // The timed-out cluster client was destroyed, not wedged: it connects once the nodes answer.
      for (const p of proxies) p.resume();
      const topic = `t-${randomUUID()}`;
      let received = 0;
      await ps.subscribe(topic, (_e, ack) => {
        received += 1;
        void ack?.();
      });
      await ps.publish(topic, makeEvent());
      await waitFor(() => received === 1);
    }, 15_000);

    it("rejects subscribe() when the cluster freezes before the subscription's reader connects", async () => {
      const { ps } = await createProxiedPubSub();
      // Connect the writer first, so only the reader's connection is stalled.
      await ps.publish(`warmup-${randomUUID()}`, makeEvent());
      for (const p of proxies) p.stall();

      expect(await settle(ps.subscribe(`t-${randomUUID()}`, () => {}, { group: 'workers' }))).toEqual({
        status: 'rejected',
        message: expect.stringContaining(`read client did not connect to Redis within ${CONNECT_TIMEOUT_MS}ms`),
      });
    }, 15_000);

    it("leaves no node connections behind when a timed-out connect's nodes answer after close()", async () => {
      const name = `connect-timeout-leak-${randomUUID()}`;
      const { ps, nodes } = await createProxiedPubSub(name);
      for (const p of proxies) p.stall();

      expect(await settle(ps.subscribe(`t-${randomUUID()}`, () => {}))).toMatchObject({ status: 'rejected' });
      await ps.close();
      // The cluster answers late, as after SIGCONT: the abandoned connect's
      // held sockets now complete their handshake.
      for (const p of proxies) p.resume();
      await new Promise(r => setTimeout(r, 1_000));

      const leftover: number[] = [];
      for (const address of nodes) {
        const node = createClient({ url: `redis://${address}` });
        await node.connect();
        leftover.push((await node.clientList()).filter(c => c.name === name).length);
        await node.close();
      }
      expect(leftover).toEqual(nodes.map(() => 0));
    }, 15_000);
  });
});
