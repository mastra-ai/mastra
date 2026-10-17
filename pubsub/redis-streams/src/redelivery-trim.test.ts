import { randomUUID } from 'node:crypto';
import type { EventCallback } from '@mastra/core/events';
import { createClient } from 'redis';
import { afterEach, describe, expect, it } from 'vitest';
import { RedisStreamsPubSub } from './index';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6381';

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error(`waitFor timed out after ${timeoutMs}ms`);
    await new Promise(r => setTimeout(r, 25));
  }
}

describe('RedisStreamsPubSub redelivery trimming', () => {
  let pubsubs: RedisStreamsPubSub[] = [];

  afterEach(async () => {
    await Promise.all(pubsubs.map(p => p.close()));
    pubsubs = [];
  });

  it.each(['nack', 'timeout'] as const)(
    'bounds stream growth when redelivering via %s',
    async mode => {
      // Redis trims `MAXLEN ~` in whole stream nodes (100 entries by default), so
      // redeliver well past one node to make an untrimmed stream obvious.
      const redeliveries = 350;
      const ps = new RedisStreamsPubSub({
        url: REDIS_URL,
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

      const client = createClient({ url: REDIS_URL });
      await client.connect();
      try {
        const keys = await client.keys(`*${topic}*`);
        const lengths = await Promise.all(
          keys.map(k => client.type(k).then(t => (t === 'stream' ? client.xLen(k) : 0))),
        );
        expect(Math.max(...lengths)).toBeLessThan(redeliveries);
      } finally {
        await client.quit();
      }
    },
    90_000,
  );
});
