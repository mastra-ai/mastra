import { randomUUID } from 'node:crypto';
import type { Event, EventCallback } from '@mastra/core/events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClient } from './client';
import type { ValkeyClientType } from './client';
import { ValkeyStreamsPubSub } from './index';

const VALKEY_URL = process.env.VALKEY_URL ?? 'valkey://localhost:6381';

// Lets individual tests wrap the clients the pubsub creates (to slow down or
// intercept a command) without reaching into private fields.
const hooks = vi.hoisted(() => ({ wrap: undefined as undefined | ((client: any) => any) }));
vi.mock('./client', async importOriginal => {
  const mod = await importOriginal<typeof import('./client')>();
  return {
    ...mod,
    createClient: (options: Parameters<typeof mod.createClient>[0]) => {
      const client = mod.createClient(options);
      return hooks.wrap ? hooks.wrap(client) : client;
    },
  };
});

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

async function rawClient(): Promise<ValkeyClientType> {
  const raw = createClient({ url: VALKEY_URL });
  await raw.connect();
  return raw;
}

async function xLen(raw: ValkeyClientType, key: string): Promise<number> {
  return Number(await raw.command(['XLEN', key]));
}

/** ID of the newest stream entry. GLIDE decodes XREVRANGE entries as `{ key, value }` records. */
async function xLastId(raw: ValkeyClientType, key: string): Promise<string> {
  const [last] = (await raw.command(['XREVRANGE', key, '+', '-', 'COUNT', '1'])) as Array<{ key: string }>;
  return last!.key;
}

async function xClaimForce(raw: ValkeyClientType, key: string, group: string, consumer: string, id: string) {
  await raw.command(['XCLAIM', key, group, consumer, '0', id, 'FORCE']);
}

describe('ValkeyStreamsPubSub reclaim loop', () => {
  let pubsubs: ValkeyStreamsPubSub[] = [];

  function createPubSub(
    extra: { inFlightTimeoutMs?: number; maxDeliveryAttempts?: number; reclaimIdleMs?: number } = {},
  ): ValkeyStreamsPubSub {
    const ps = new ValkeyStreamsPubSub({
      url: VALKEY_URL,
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
    hooks.wrap = undefined;
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
    // The in-flight guard must be cleared only AFTER the entry is settled.
    // Slow down xAck on every client so the window between ack() being called
    // and the entry leaving the PEL spans several reclaim ticks.
    hooks.wrap = client => {
      const origXAck = client.xAck.bind(client);
      client.xAck = async (...args: Parameters<typeof origXAck>) => {
        await sleep(500);
        return origXAck(...args);
      };
      return client;
    };

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

    const raw = await rawClient();
    try {
      const [pending] = await raw.xPendingRange(`mastra:topic:${topic}`, group, 10);
      expect(pending).toBeDefined();
      // Never re-claimed by A: idle time kept running and the delivery
      // counter still reflects the single original XREADGROUP delivery.
      expect(pending!.millisecondsSinceLastDelivery).toBeGreaterThanOrEqual(600);
      expect(pending!.deliveriesCounter).toBe(1);
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

    const raw = await rawClient();
    try {
      // Every attempt was settled: nothing left pending in the group.
      expect(await raw.xPendingRange(`mastra:topic:${topic}`, group, 10)).toHaveLength(0);
    } finally {
      await raw.quit();
    }
  });

  it('recovers a hung fan-out (ungrouped) handler after inFlightTimeoutMs', async () => {
    // Fan-out subscriptions use a private group, so there is never a sibling
    // to reclaim from and inFlightTimeoutMs is their only recovery path. The
    // reclaim loop must still run its expiry pass for them.
    const ps = createPubSub({ inFlightTimeoutMs: 300, maxDeliveryAttempts: 3 });
    const topic = `t-${randomUUID()}`;

    const attempts: number[] = [];
    const cb: EventCallback = event => {
      attempts.push(event.deliveryAttempt ?? 1);
      // intentionally never ack/nack
    };
    await ps.subscribe(topic, cb);
    await ps.publish(topic, makeEvent({ type: 'hung-fanout' }));

    await waitFor(() => attempts.length === 3, 5000);
    await sleep(800);
    expect(attempts).toEqual([1, 2, 3]);
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

  it('scans past a full page of locally in-flight entries to reach a reclaimable one', async () => {
    // Locally in-flight entries stay in the PEL by design and are listed on
    // every tick. If more than one XPENDING page of them sort before a
    // reclaimable entry, a single fixed-size page would never reach it.
    const ps = createPubSub();
    const topic = `t-${randomUUID()}`;
    const group = `page-${randomUUID()}`;
    const streamKey = `mastra:topic:${topic}`;
    const IN_FLIGHT = 120;

    let hung = 0;
    let ghostDeliveries = 0;
    const cb: EventCallback = async (event, ack) => {
      if (event.type === 'ghost') {
        // Count only once the XACK has settled, so the forged pending entry
        // below cannot be raced away by the original ack.
        await ack?.();
        ghostDeliveries++;
        return;
      }
      hung++;
      // intentionally never ack/nack
    };
    await ps.subscribe(topic, cb, { group });
    for (let i = 0; i < IN_FLIGHT; i++) await ps.publish(topic, makeEvent({ type: 'hung' }));
    await waitFor(() => hung === IN_FLIGHT, 10_000);

    // The ghost entry sorts after all in-flight ones. Let the subscription
    // read + ack it, then forge a pending entry for it under a consumer that
    // no longer exists (XCLAIM FORCE re-adds an acked entry to the PEL).
    await ps.publish(topic, makeEvent({ type: 'ghost' }));
    await waitFor(() => ghostDeliveries === 1, 5000);
    const raw = await rawClient();
    try {
      const lastId = await xLastId(raw, streamKey);
      await xClaimForce(raw, streamKey, group, 'ghost-consumer', lastId);
      expect(await raw.xPendingRange(streamKey, group, 1000)).toHaveLength(IN_FLIGHT + 1);
    } finally {
      await raw.quit();
    }

    // Reclaim must find the ghost's entry behind the 120 in-flight ones and
    // deliver it to the live handler.
    await waitFor(() => ghostDeliveries === 2, 5000);
    expect(hung).toBe(IN_FLIGHT);
  });

  it('does not nack on timeout once a sibling has reclaimed the entry', async () => {
    // A's handler hangs; before A's inFlightTimeoutMs elapses, B (same
    // group) reclaims the idle entry and starts processing it. A's timeout
    // must notice the entry is no longer owned by A and disown it locally —
    // NOT republish a duplicate and xAck B's pending entry out from under it.
    //
    // A's own reclaim threshold is set high so A cannot legitimately reclaim
    // the entry back from B while B holds it; that path is B's concern.
    const psA = createPubSub({ inFlightTimeoutMs: 1000, reclaimIdleMs: 5000 });
    const psB = createPubSub();
    const topic = `t-${randomUUID()}`;
    const group = `owner-${randomUUID()}`;
    const streamKey = `mastra:topic:${topic}`;

    const attemptsA: number[] = [];
    const cbA: EventCallback = event => {
      attemptsA.push(event.deliveryAttempt ?? 1);
      // intentionally never ack/nack
    };
    await psA.subscribe(topic, cbA, { group });
    await psA.publish(topic, makeEvent({ type: 'shared' }));
    await waitFor(() => attemptsA.length === 1, 5000);

    // B joins after the entry is idle >= B's reclaimIdleMs but before A's
    // timeout, and holds the message past A's timeout before acking.
    await sleep(400);
    const attemptsB: number[] = [];
    const cbB: EventCallback = async (event, ack) => {
      attemptsB.push(event.deliveryAttempt ?? 1);
      await sleep(1200);
      void ack?.();
    };
    await psB.subscribe(topic, cbB, { group });
    await waitFor(() => attemptsB.length === 1, 3000);

    // Cover A's timeout (t≈1000ms) and B's ack (t≈1600ms) with margin.
    await sleep(2000);
    expect(attemptsA).toEqual([1]);
    expect(attemptsB).toEqual([1]);

    const raw = await rawClient();
    try {
      // B's ack settled the only entry; nothing republished, nothing pending.
      expect(await raw.xPendingRange(streamKey, group, 10)).toHaveLength(0);
      expect(await xLen(raw, streamKey)).toBe(1);
    } finally {
      await raw.quit();
    }
  });

  it('does not republish or xAck when a sibling claims the entry inside the timeout settlement', async () => {
    // The tightest possible race: the sibling's XCLAIM lands after the timeout
    // path has decided to nack but before the nack reaches the server. A
    // separate ownership check followed by republish+xAck would still lose
    // here; the settlement must verify ownership and settle in one atomic step.
    //
    // Simulate it by intercepting the write client's script call and moving
    // the entry to a sibling immediately before it is sent.
    const topic = `t-${randomUUID()}`;
    const group = `atomic-${randomUUID()}`;
    const streamKey = `mastra:topic:${topic}`;

    const raw = await rawClient();

    let claimedInWindow = 0;
    hooks.wrap = client => {
      const origEval = client.eval.bind(client);
      client.eval = async (...args: Parameters<typeof origEval>) => {
        const [pending] = await raw.xPendingRange(streamKey, group, 1);
        if (pending) {
          await xClaimForce(raw, streamKey, group, 'sibling', pending.id);
          claimedInWindow++;
        }
        return origEval(...args);
      };
      return client;
    };

    const ps = createPubSub({ inFlightTimeoutMs: 300, reclaimIdleMs: 60_000 });
    const attempts: number[] = [];
    const cb: EventCallback = event => {
      attempts.push(event.deliveryAttempt ?? 1);
      // intentionally never ack/nack
    };
    await ps.subscribe(topic, cb, { group });
    await ps.publish(topic, makeEvent({ type: 'atomic' }));
    await waitFor(() => attempts.length === 1, 5000);

    try {
      // Cover the timeout (t≈300ms) and its settlement with margin.
      await sleep(1000);

      expect(attempts).toEqual([1]);
      // Nothing republished, and the sibling still owns the untouched entry.
      expect(await xLen(raw, streamKey)).toBe(1);
      const pending = await raw.xPendingRange(streamKey, group, 10);
      expect(pending).toHaveLength(1);
      expect(pending[0]!.consumer).toBe('sibling');
      expect(claimedInWindow).toBe(1);
    } finally {
      await raw.quit();
    }
  });
});
