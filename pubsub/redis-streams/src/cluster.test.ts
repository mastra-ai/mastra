import { randomUUID } from 'node:crypto';
import type { Event, EventCallback } from '@mastra/core/events';
import { createCluster } from 'redis';
import { afterEach, describe, expect, it } from 'vitest';
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
});
