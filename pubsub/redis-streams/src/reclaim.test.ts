import { randomUUID } from 'node:crypto';
import type { Event, EventCallback } from '@mastra/core/events';
import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RedisStreamsPubSub } from './index';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6381';

function makeEvent(overrides: Partial<Omit<Event, 'id' | 'createdAt'>> = {}): Omit<Event, 'id' | 'createdAt'> {
  return { type: 'test', data: {}, runId: 'run-1', ...overrides };
}

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await new Promise(r => setTimeout(r, 25));
  }
  if (!predicate()) throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

describe('RedisStreamsPubSub reclaim loop', () => {
  let pubsubs: RedisStreamsPubSub[] = [];

  function createPubSub(extra: { inFlightTimeoutMs?: number; maxDeliveryAttempts?: number } = {}): RedisStreamsPubSub {
    const ps = new RedisStreamsPubSub({
      url: REDIS_URL,
      blockMs: 200,
      // Aggressive settings so a reclaim pass is a few hundred ms, not 60s.
      reclaimIdleMs: 200,
      reclaimIntervalMs: 100,
      ...extra,
    });
    pubsubs.push(ps);
    return ps;
  }

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(pubsubs.map(p => p.close()));
    pubsubs = [];
  });

  it('does not self-redeliver an in-flight message before ack', async () => {
    // A single grouped consumer whose handler runs longer than reclaimIdleMs
    // and spans several reclaim ticks must be invoked exactly once.
    const ps = createPubSub();
    const topic = `t-${randomUUID()}`;

    let deliveries = 0;
    const cb: EventCallback = async (_event, ack) => {
      deliveries++;
      await sleep(800);
      void ack?.();
    };
    await ps.subscribe(topic, cb, { group: `inflight-${randomUUID()}` });
    await ps.publish(topic, makeEvent({ type: 'long-running' }));

    await sleep(1500);
    expect(deliveries).toBe(1);
  });

  it('does not redeliver during the ack-time settlement window', async () => {
    // The in-flight guard must be cleared only AFTER Redis settles the entry.
    // Slow down xAck on every client so the window between ack() being called
    // and the entry leaving the PEL spans several reclaim ticks.
    const realCreate = createClient;
    vi.spyOn(await import('redis'), 'createClient').mockImplementation(((opts: any) => {
      const client = realCreate(opts) as RedisClientType;
      const origXAck = client.xAck.bind(client);
      (client as any).xAck = async (...args: Parameters<typeof origXAck>) => {
        await sleep(500);
        return origXAck(...args);
      };
      return client;
    }) as any);

    const ps = createPubSub();
    const topic = `t-${randomUUID()}`;

    let deliveries = 0;
    const cb: EventCallback = async (_event, ack) => {
      deliveries++;
      void ack?.();
    };
    await ps.subscribe(topic, cb, { group: `ackwin-${randomUUID()}` });
    await ps.publish(topic, makeEvent({ type: 'ack-window' }));

    await sleep(1500);
    expect(deliveries).toBe(1);
  });

  it('leaves a stalled in-flight entry idle so a sibling can reclaim it', async () => {
    // Consumer A's handler never settles. Its own reclaim loop must not touch
    // the entry (a claim resets the idle clock, which would starve siblings),
    // so B — subscribing later in the same group — reclaims it. A is never
    // invoked a second time.
    const ps = createPubSub();
    const topic = `t-${randomUUID()}`;
    const group = `stalled-${randomUUID()}`;

    let deliveriesA = 0;
    const cbA: EventCallback = () => {
      deliveriesA++;
      // intentionally never ack/nack
    };
    await ps.subscribe(topic, cbA, { group });
    await ps.publish(topic, makeEvent({ type: 'sticky' }));
    await waitFor(() => deliveriesA === 1, 5000);

    // Let A's reclaim loop tick several times against its own pending entry
    // before B exists. If A were claiming-and-skipping, the entry's idle time
    // would be reset on each tick and never reach reclaimIdleMs for B.
    await sleep(700);

    const raw = createClient({ url: REDIS_URL }) as RedisClientType;
    await raw.connect();
    try {
      const [pending] = await raw.xPendingRange(`mastra:topic:${topic}`, group, '-', '+', 10);
      expect(pending).toBeDefined();
      // Never re-claimed by A: idle time kept running and the delivery
      // counter still reflects the single original XREADGROUP delivery.
      expect(Number(pending!.millisecondsSinceLastDelivery)).toBeGreaterThanOrEqual(600);
      expect(Number(pending!.deliveriesCounter)).toBe(1);
    } finally {
      await raw.quit();
    }

    const seenB: Event[] = [];
    const cbB: EventCallback = (event, ack) => {
      seenB.push(event);
      void ack?.();
    };
    await ps.subscribe(topic, cbB, { group });

    await waitFor(() => seenB.length >= 1, 3000);
    expect(seenB[0]!.type).toBe('sticky');
    expect(deliveriesA).toBe(1);
  });

  it('nacks a hung handler on its behalf after inFlightTimeoutMs, honoring the attempt cap', async () => {
    // Single consumer, handler never settles. With inFlightTimeoutMs set the
    // reclaim loop must nack the entry itself: republish with deliveryAttempt
    // + 1 and ack the original. After maxDeliveryAttempts the event is
    // dropped, so total invocations equal the cap.
    const ps = createPubSub({ inFlightTimeoutMs: 300, maxDeliveryAttempts: 3 });
    const topic = `t-${randomUUID()}`;
    const group = `hung-${randomUUID()}`;

    const attempts: number[] = [];
    const cb: EventCallback = event => {
      attempts.push(event.deliveryAttempt ?? 1);
      // intentionally never ack/nack
    };
    await ps.subscribe(topic, cb, { group });
    await ps.publish(topic, makeEvent({ type: 'hung' }));

    await waitFor(() => attempts.length === 3, 5000);
    // Give the loop time to (wrongly) redeliver past the cap if it were going to.
    await sleep(800);
    expect(attempts).toEqual([1, 2, 3]);

    const raw = createClient({ url: REDIS_URL }) as RedisClientType;
    await raw.connect();
    try {
      // Every attempt was settled: nothing left pending in the group.
      const pending = await raw.xPendingRange(`mastra:topic:${topic}`, group, '-', '+', 10);
      expect(pending).toHaveLength(0);
    } finally {
      await raw.quit();
    }
  });

  it('does not time out an in-flight handler that is merely slow', async () => {
    // inFlightTimeoutMs must be measured from delivery, and a handler that
    // settles before the deadline is never nacked or re-invoked.
    const ps = createPubSub({ inFlightTimeoutMs: 1500 });
    const topic = `t-${randomUUID()}`;

    let deliveries = 0;
    const cb: EventCallback = async (_event, ack) => {
      deliveries++;
      await sleep(600);
      void ack?.();
    };
    await ps.subscribe(topic, cb, { group: `slow-${randomUUID()}` });
    await ps.publish(topic, makeEvent({ type: 'slow' }));

    await sleep(2200);
    expect(deliveries).toBe(1);
  });
});
