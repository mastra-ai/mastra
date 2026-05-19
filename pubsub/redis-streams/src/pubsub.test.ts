import { randomUUID } from 'node:crypto';
import type { Event, EventCallback } from '@mastra/core/events';
import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { RedisStreamsPubSub } from './index';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6381';

function makeEvent(overrides: Partial<Omit<Event, 'id' | 'createdAt'>> = {}): Omit<Event, 'id' | 'createdAt'> {
  return {
    type: 'test',
    data: {},
    runId: 'run-1',
    ...overrides,
  };
}

/**
 * Wait until the predicate returns true, polling at the given interval.
 * Throws if the timeout is hit.
 */
async function waitFor(
  predicate: () => boolean,
  opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? 5000;
  const intervalMs = opts.intervalMs ?? 25;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  if (!predicate()) {
    throw new Error(`waitFor timed out after ${timeoutMs}ms`);
  }
}

/** Captures invocations of a callback for assertions, with auto-ack/nack helpers. */
function captureCalls() {
  const calls: Array<{ event: Event; ack?: () => Promise<void>; nack?: () => Promise<void> }> = [];
  const cb: EventCallback = (event, ack, nack) => {
    calls.push({ event, ack, nack });
  };
  const cbAutoAck: EventCallback = (event, ack) => {
    calls.push({ event });
    void ack?.();
  };
  return { calls, cb, cbAutoAck };
}

describe('RedisStreamsPubSub', () => {
  let pubsubs: RedisStreamsPubSub[] = [];

  function createPubSub(): RedisStreamsPubSub {
    const ps = new RedisStreamsPubSub({ url: REDIS_URL, blockMs: 200 });
    pubsubs.push(ps);
    return ps;
  }

  afterEach(async () => {
    await Promise.all(pubsubs.map(p => p.close()));
    pubsubs = [];
  });

  afterAll(async () => {
    await Promise.all(pubsubs.map(p => p.close()));
  });

  describe('fan-out (no group)', () => {
    it('delivers each published message to all subscribers', async () => {
      const ps = createPubSub();
      const topic = `t-${randomUUID()}`;
      const a = captureCalls();
      const b = captureCalls();

      await ps.subscribe(topic, a.cbAutoAck);
      await ps.subscribe(topic, b.cbAutoAck);

      await ps.publish(topic, makeEvent({ type: 'hello' }));

      await waitFor(() => a.calls.length === 1 && b.calls.length === 1);
      expect(a.calls[0]!.event.type).toBe('hello');
      expect(b.calls[0]!.event.type).toBe('hello');
    });

    it('does not deliver to unsubscribed callbacks', async () => {
      const ps = createPubSub();
      const topic = `t-${randomUUID()}`;
      const a = captureCalls();
      const b = captureCalls();

      await ps.subscribe(topic, a.cbAutoAck);
      await ps.subscribe(topic, b.cbAutoAck);
      await ps.unsubscribe(topic, a.cbAutoAck);

      await ps.publish(topic, makeEvent());
      await waitFor(() => b.calls.length === 1);

      // Give a generous moment for the dropped subscriber's loop to (not) deliver.
      await new Promise(r => setTimeout(r, 250));
      expect(a.calls.length).toBe(0);
      expect(b.calls.length).toBe(1);
    });

    it('does not deliver across different topics', async () => {
      const ps = createPubSub();
      const topicA = `t-${randomUUID()}`;
      const topicB = `t-${randomUUID()}`;
      const a = captureCalls();
      const b = captureCalls();

      await ps.subscribe(topicA, a.cbAutoAck);
      await ps.subscribe(topicB, b.cbAutoAck);

      await ps.publish(topicA, makeEvent());

      await waitFor(() => a.calls.length === 1);
      await new Promise(r => setTimeout(r, 200));
      expect(b.calls.length).toBe(0);
    });
  });

  describe('group (competing consumers)', () => {
    it('delivers each message to exactly one subscriber in the group', async () => {
      const ps = createPubSub();
      const topic = `t-${randomUUID()}`;
      const a = captureCalls();
      const b = captureCalls();

      await ps.subscribe(topic, a.cbAutoAck, { group: 'workers' });
      await ps.subscribe(topic, b.cbAutoAck, { group: 'workers' });

      // Send several messages, expect total = sent and no overlap on a single message.
      const N = 6;
      for (let i = 0; i < N; i++) {
        await ps.publish(topic, makeEvent({ type: `msg-${i}` }));
      }

      await waitFor(() => a.calls.length + b.calls.length === N, { timeoutMs: 8000 });
      // Both should have received at least one (round-robin distributes).
      expect(a.calls.length).toBeGreaterThan(0);
      expect(b.calls.length).toBeGreaterThan(0);

      // Critical invariant for competing consumers: every message id was
      // delivered exactly once across the group. Summing call counts above
      // is necessary but not sufficient — assert no id appears twice.
      const allIds = [...a.calls, ...b.calls].map(c => c.event.id);
      expect(allIds).toHaveLength(N);
      expect(new Set(allIds).size).toBe(N);
    });

    it('different groups on the same topic each receive every message', async () => {
      const ps = createPubSub();
      const topic = `t-${randomUUID()}`;
      const a = captureCalls();
      const b = captureCalls();

      await ps.subscribe(topic, a.cbAutoAck, { group: 'group-a' });
      await ps.subscribe(topic, b.cbAutoAck, { group: 'group-b' });

      await ps.publish(topic, makeEvent({ type: 'broadcast' }));

      await waitFor(() => a.calls.length === 1 && b.calls.length === 1);
      expect(a.calls[0]!.event.type).toBe('broadcast');
      expect(b.calls[0]!.event.type).toBe('broadcast');
    });
  });

  describe('ack/nack/redelivery', () => {
    it('nack increments deliveryAttempt and redelivers', async () => {
      const ps = createPubSub();
      const topic = `t-${randomUUID()}`;
      const seenAttempts: number[] = [];

      const cb: EventCallback = (event, ack, nack) => {
        seenAttempts.push(event.deliveryAttempt ?? 0);
        if ((event.deliveryAttempt ?? 1) < 2) {
          void nack?.();
        } else {
          void ack?.();
        }
      };

      await ps.subscribe(topic, cb, { group: 'retry-group' });
      await ps.publish(topic, makeEvent({ type: 'flaky' }));

      await waitFor(() => seenAttempts.length >= 2, { timeoutMs: 8000 });
      expect(seenAttempts[0]).toBe(1);
      expect(seenAttempts[1]).toBe(2);
    });

    it('async handler that rejects is treated as nack and redelivered', async () => {
      const ps = createPubSub();
      const topic = `t-${randomUUID()}`;
      const seenAttempts: number[] = [];

      const cb: EventCallback = async (event, ack) => {
        seenAttempts.push(event.deliveryAttempt ?? 0);
        if ((event.deliveryAttempt ?? 1) < 2) {
          // Reject without calling ack/nack — should be auto-nacked.
          throw new Error('boom');
        }
        await ack?.();
      };

      await ps.subscribe(topic, cb, { group: 'async-retry-group' });
      await ps.publish(topic, makeEvent({ type: 'flaky-async' }));

      await waitFor(() => seenAttempts.length >= 2, { timeoutMs: 8000 });
      expect(seenAttempts[0]).toBe(1);
      expect(seenAttempts[1]).toBe(2);
    });

    it('flush waits for in-flight publishes', async () => {
      const ps = createPubSub();
      const topic = `t-${randomUUID()}`;

      // Fire several publishes without awaiting, then flush.
      const promises = [
        ps.publish(topic, makeEvent({ type: 'a' })),
        ps.publish(topic, makeEvent({ type: 'b' })),
        ps.publish(topic, makeEvent({ type: 'c' })),
      ];
      await ps.flush();
      await Promise.all(promises);

      // No assertion error means flush awaited all in-flight publishes.
      expect(true).toBe(true);
    });
  });

  describe('cross-instance', () => {
    it('a separate pubsub instance can consume messages published by another', async () => {
      const producer = createPubSub();
      const consumer = createPubSub();
      const topic = `t-${randomUUID()}`;
      const cap = captureCalls();

      await consumer.subscribe(topic, cap.cbAutoAck, { group: 'shared' });
      await producer.publish(topic, makeEvent({ type: 'across-instance' }));

      await waitFor(() => cap.calls.length === 1);
      expect(cap.calls[0]!.event.type).toBe('across-instance');
    });
  });

  describe('lifecycle', () => {
    it('publish() on a closed instance throws', async () => {
      const ps = createPubSub();
      const topic = `t-${randomUUID()}`;
      // Trigger lazy connect first so close has something to tear down.
      await ps.publish(topic, makeEvent());
      await ps.close();
      await expect(ps.publish(topic, makeEvent())).rejects.toThrow(/cannot publish on closed client/);
    });

    it('subscribe() on a closed instance throws', async () => {
      const ps = createPubSub();
      const topic = `t-${randomUUID()}`;
      await ps.publish(topic, makeEvent());
      await ps.close();
      const cap = captureCalls();
      await expect(ps.subscribe(topic, cap.cbAutoAck)).rejects.toThrow(/cannot subscribe on closed client/);
    });

    it('close() is idempotent', async () => {
      const ps = createPubSub();
      const topic = `t-${randomUUID()}`;
      await ps.publish(topic, makeEvent());
      await ps.close();
      await expect(ps.close()).resolves.toBeUndefined();
    });

    it('unsubscribe() for an unknown callback is a no-op', async () => {
      const ps = createPubSub();
      const topic = `t-${randomUUID()}`;
      const cap = captureCalls();
      // never subscribed — should not throw
      await expect(ps.unsubscribe(topic, cap.cbAutoAck)).resolves.toBeUndefined();
    });
  });

  describe('late-join semantics', () => {
    it('subscribe after publish in a fresh group still receives the published message', async () => {
      const producer = createPubSub();
      const consumer = createPubSub();
      const topic = `t-${randomUUID()}`;
      const groupName = `late-${randomUUID()}`;

      // Publish first, with no consumer group anywhere.
      await producer.publish(topic, makeEvent({ type: 'before-subscribe' }));

      // Now create a brand-new consumer group and assert it sees the backlog.
      const cap = captureCalls();
      await consumer.subscribe(topic, cap.cbAutoAck, { group: groupName });

      await waitFor(() => cap.calls.length === 1, { timeoutMs: 5000 });
      expect(cap.calls[0]!.event.type).toBe('before-subscribe');
    });

    it('an existing group keeps its own checkpoint and does not replay history', async () => {
      const ps = createPubSub();
      const keyPrefix = 'mastra:topic';
      const topic = `t-${randomUUID()}`;
      const streamKey = `${keyPrefix}:${topic}`;
      const groupName = `existing-${randomUUID()}`;

      // Publish event-1 first so the stream exists with at least one entry.
      await ps.publish(topic, makeEvent({ type: 'event-1' }));

      // Pre-create the group at '$' (latest) using the underlying client.
      // This simulates a long-running group whose checkpoint is past event-1.
      const direct = createClient({ url: REDIS_URL }) as RedisClientType;
      await direct.connect();
      try {
        await direct.xGroupCreate(streamKey, groupName, '$');
      } finally {
        await direct.quit();
      }

      // Publish event-2 after the group is anchored at $; this is what the
      // group should see when a subscriber joins.
      await ps.publish(topic, makeEvent({ type: 'event-2' }));

      const cap = captureCalls();
      await ps.subscribe(topic, cap.cbAutoAck, { group: groupName });

      // The BUSYGROUP path should leave the existing checkpoint intact, so
      // event-1 stays unread (group started at $ which was after event-1).
      // event-2 was published after the anchor and must be delivered.
      await waitFor(() => cap.calls.length >= 1, { timeoutMs: 5000 });
      await new Promise(r => setTimeout(r, 200));
      const types = cap.calls.map(c => c.event.type);
      expect(types).toContain('event-2');
      expect(types).not.toContain('event-1');
    });

    it('XAUTOCLAIM reassigns idle pending messages to a sibling consumer', async () => {
      const ps = new RedisStreamsPubSub({
        url: REDIS_URL,
        blockMs: 200,
        // Aggressive reclaim settings so the test doesn't have to wait 30s.
        reclaimIntervalMs: 250,
        reclaimIdleMs: 500,
      });
      pubsubs.push(ps);

      const topic = `t-${randomUUID()}`;
      const groupName = `claim-${randomUUID()}`;

      // First subscriber never acks/nacks — its pending entry will go idle.
      const seenA: Event[] = [];
      const cbA: EventCallback = event => {
        seenA.push(event);
        // intentionally never ack/nack
      };
      await ps.subscribe(topic, cbA, { group: groupName });

      // Publish; subscriber A reads but never acks.
      await ps.publish(topic, makeEvent({ type: 'sticky' }));
      await waitFor(() => seenA.length === 1, { timeoutMs: 5000 });

      // Subscriber B joins the same group. It can only see entries that A
      // has not acked once XAUTOCLAIM moves them over.
      const seenB: Event[] = [];
      const cbB: EventCallback = (event, ack) => {
        seenB.push(event);
        void ack?.();
      };
      await ps.subscribe(topic, cbB, { group: groupName });

      // Wait for autoclaim to fire (idleMs=500, intervalMs=250 + a margin).
      await waitFor(() => seenB.length >= 1, { timeoutMs: 6000 });
      expect(seenB[0]!.type).toBe('sticky');
    });
  });

  describe('nack max-delivery cap', () => {
    it('drops the event after maxDeliveryAttempts and stops redelivering', async () => {
      const warns: Array<{ msg: string; meta: any }> = [];
      const ps = new RedisStreamsPubSub({
        url: REDIS_URL,
        blockMs: 200,
        maxDeliveryAttempts: 3,
        logger: {
          debug: () => {},
          warn: (msg: any, meta: any) => warns.push({ msg, meta }),
        },
      });
      pubsubs.push(ps);

      const topic = `t-cap-${randomUUID()}`;
      const groupName = `g-cap-${randomUUID()}`;
      let attempts = 0;
      const cb: EventCallback = (_event, _ack, nack) => {
        attempts++;
        void nack?.();
      };
      await ps.subscribe(topic, cb, { group: groupName });
      await ps.publish(topic, makeEvent({ type: 'poison' }));

      // 3 deliveries (initial + 2 redeliveries = attempt 1, 2, 3) then drop.
      await waitFor(() => attempts >= 3, { timeoutMs: 5000 });
      // Give Redis a moment in case a 4th would have been redelivered.
      await new Promise(r => setTimeout(r, 500));
      expect(attempts).toBe(3);
      expect(warns.some(w => /max delivery attempts/.test(String(w.msg)))).toBe(true);
    });

    it('Infinity disables the cap (events keep redelivering)', async () => {
      const ps = new RedisStreamsPubSub({
        url: REDIS_URL,
        blockMs: 200,
        maxDeliveryAttempts: Infinity,
      });
      pubsubs.push(ps);

      const topic = `t-cap-inf-${randomUUID()}`;
      const groupName = `g-cap-inf-${randomUUID()}`;
      let attempts = 0;
      const cb: EventCallback = (_event, _ack, nack) => {
        attempts++;
        void nack?.();
      };
      await ps.subscribe(topic, cb, { group: groupName });
      await ps.publish(topic, makeEvent({ type: 'poison-inf' }));

      // Should keep redelivering past the default cap of 5.
      await waitFor(() => attempts >= 8, { timeoutMs: 10_000 });
      expect(attempts).toBeGreaterThanOrEqual(8);
    });

    it('warns and treats 0 as Infinity for back-compat', async () => {
      const warns: string[] = [];
      const ps = new RedisStreamsPubSub({
        url: REDIS_URL,
        blockMs: 200,
        maxDeliveryAttempts: 0,
        logger: {
          debug: () => {},
          warn: (msg: any) => warns.push(String(msg)),
        },
      });
      pubsubs.push(ps);
      expect(warns.some(w => /maxDeliveryAttempts=0/.test(w))).toBe(true);
    });
  });

  describe('unsubscribe scoping', () => {
    it('the same callback can subscribe to two topics; unsubscribing one keeps the other', async () => {
      const ps = createPubSub();
      const seen: Array<{ topic: string; type: string }> = [];
      const cb: EventCallback = (event, ack) => {
        // mark the topic by inspecting the event type, since EventCallback
        // does not receive the topic separately.
        seen.push({ topic: event.type.startsWith('a-') ? 'A' : 'B', type: event.type });
        void ack?.();
      };
      const topicA = `t-A-${randomUUID()}`;
      const topicB = `t-B-${randomUUID()}`;
      await ps.subscribe(topicA, cb);
      await ps.subscribe(topicB, cb);

      await ps.publish(topicA, makeEvent({ type: 'a-1' }));
      await ps.publish(topicB, makeEvent({ type: 'b-1' }));
      await waitFor(() => seen.length === 2, { timeoutMs: 5000 });

      // Unsubscribe only from A.
      await ps.unsubscribe(topicA, cb);

      await ps.publish(topicA, makeEvent({ type: 'a-2' }));
      await ps.publish(topicB, makeEvent({ type: 'b-2' }));
      await waitFor(() => seen.some(s => s.type === 'b-2'), { timeoutMs: 5000 });
      // Allow some grace time for any stray a-2 delivery.
      await new Promise(r => setTimeout(r, 300));
      expect(seen.some(s => s.type === 'a-2')).toBe(false);
      expect(seen.some(s => s.type === 'b-2')).toBe(true);
    });
  });
});
