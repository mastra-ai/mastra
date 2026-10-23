import { randomUUID } from 'node:crypto';
import type { EventCallback } from '@mastra/core/events';
import { afterEach, describe, expect, it } from 'vitest';
import { createClient } from './client';
import { ValkeyStreamsPubSub } from './index';

const VALKEY_URL = process.env.VALKEY_URL ?? 'valkey://localhost:6381';

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error(`waitFor timed out after ${timeoutMs}ms`);
    await new Promise(r => setTimeout(r, 25));
  }
}

describe('ValkeyStreamsPubSub redelivery trimming', () => {
  let pubsubs: ValkeyStreamsPubSub[] = [];

  afterEach(async () => {
    await Promise.all(pubsubs.map(p => p.close()));
    pubsubs = [];
  });

  it.each(['nack', 'timeout'] as const)(
    'bounds stream growth when redelivering via %s',
    async mode => {
      // `MAXLEN ~` trims in whole stream nodes (100 entries by default), so
      // redeliver well past one node to make an untrimmed stream obvious.
      const redeliveries = 350;
      const ps = new ValkeyStreamsPubSub({
        url: VALKEY_URL,
        blockMs: 50,
        maxStreamLength: 10,
        maxDeliveryAttempts: redeliveries + 10,
        ...(mode === 'timeout' ? { inFlightTimeoutMs: 1, reclaimIntervalMs: 5 } : {}),
      });
      pubsubs.push(ps);
      const topic = `t-${randomUUID()}`;
      let deliveries = 0;
      const cb: EventCallback = (_event, _ack, nack) => {
        deliveries++;
        if (mode === 'nack') void nack?.();
      };
      await ps.subscribe(topic, cb, { group: 'g' });
      await ps.publish(topic, { type: 'test', data: {}, runId: 'run-1' });
      await waitFor(() => deliveries >= redeliveries, 60_000);

      const raw = createClient({ url: VALKEY_URL });
      await raw.connect();
      try {
        expect(Number(await raw.command(['XLEN', `mastra:topic:${topic}`]))).toBeLessThan(redeliveries);
      } finally {
        await raw.quit();
      }
    },
    90_000,
  );

  it('bounds stream growth when a late fan-out subscriber nacks replayed entries', async () => {
    const seeded = 300;
    const ps = new ValkeyStreamsPubSub({ url: VALKEY_URL, blockMs: 50, maxStreamLength: 10 });
    pubsubs.push(ps);
    const topic = `t-${randomUUID()}`;
    const key = `mastra:topic:${topic}`;
    const raw = createClient({ url: VALKEY_URL });
    await raw.connect();
    try {
      let acked = 0;
      await ps.subscribe(topic, async (_event, ack) => {
        acked++;
        await ack?.();
      });
      // Seed untrimmed entries directly so the late subscriber replays more than one
      // `MAXLEN ~` node; its republishes are the only writes that can trim the stream.
      for (let i = 0; i < seeded; i++) {
        const event = JSON.stringify({
          id: randomUUID(),
          type: 'test',
          data: {},
          runId: 'run-1',
          createdAt: new Date(),
        });
        await raw.command(['XADD', key, '*', 'event', event]);
      }
      await waitFor(() => acked >= seeded, 30_000);

      let republished = 0;
      await ps.subscribe(topic, async (event, ack, nack) => {
        if ((event.deliveryAttempt ?? 1) === 1) {
          await nack?.();
          republished++;
        } else {
          await ack?.();
        }
      });
      await waitFor(() => republished >= seeded, 30_000);

      expect(Number(await raw.command(['XLEN', key]))).toBeLessThan(seeded);
    } finally {
      await raw.quit();
    }
  }, 90_000);
});
