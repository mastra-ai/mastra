import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { InMemoryServerCache } from '../cache/inmemory';
import { CachingPubSub } from './caching-pubsub';
import { EventEmitterPubSub } from './event-emitter';
import { PubSub } from './pubsub';
import type { Event, EventCallback, SubscribeOptions } from './types';

/**
 * Minimal non-native PubSub stub. Reports `supportsNativeBatching = false`
 * and provides a synchronous publish-to-subscribers fan-out path so we can
 * drive `CachingPubSub`'s cache-backed batching code path deterministically.
 */
class StubPubSub extends PubSub {
  override get supportsNativeBatching(): boolean {
    return false;
  }

  private subscribers: Map<string, EventCallback[]> = new Map();

  async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void> {
    const subs = this.subscribers.get(topic) ?? [];
    const fullEvent: Event = {
      ...(event as Event),
      id: (event as any).id ?? crypto.randomUUID(),
      createdAt: (event as any).createdAt ?? new Date(),
    };
    for (const cb of subs) {
      cb(
        fullEvent,
        async () => {},
        async () => {},
      );
    }
  }

  async subscribe(topic: string, cb: EventCallback, _options?: SubscribeOptions): Promise<void> {
    const subs = this.subscribers.get(topic) ?? [];
    subs.push(cb);
    this.subscribers.set(topic, subs);
  }

  async unsubscribe(topic: string, cb: EventCallback): Promise<void> {
    const subs = this.subscribers.get(topic) ?? [];
    const idx = subs.indexOf(cb);
    if (idx !== -1) subs.splice(idx, 1);
  }

  async flush(): Promise<void> {}
}

describe('CachingPubSub — batching', () => {
  let cache: InMemoryServerCache;

  beforeEach(() => {
    cache = new InMemoryServerCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('subscribe without batch delegates straight through (existing behavior)', async () => {
    const inner = new StubPubSub();
    const caching = new CachingPubSub(inner, cache);
    const cb = vi.fn();

    await caching.subscribe('topic-a', cb);
    await caching.publish('topic-a', { type: 't', data: {}, runId: 'r' });

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('subscribe with batch delegates to inner when inner.supportsNativeBatching is true', async () => {
    const inner = new EventEmitterPubSub(); // native
    const caching = new CachingPubSub(inner, cache);
    const cb = vi.fn();

    // Spy on inner.subscribe to assert it received the batch option.
    const innerSubscribe = vi.spyOn(inner, 'subscribe');

    await caching.subscribe('topic-a', cb, { batch: { maxSize: 2, subscriberId: 'sub-1' } });

    expect(innerSubscribe).toHaveBeenCalledTimes(1);
    const opts = innerSubscribe.mock.calls[0]![2];
    expect(opts?.batch?.maxSize).toBe(2);
  });

  it('throws when batch is provided on a non-native inner without subscriberId', async () => {
    const inner = new StubPubSub();
    const caching = new CachingPubSub(inner, cache);
    const cb = vi.fn();

    await expect(caching.subscribe('topic-a', cb, { batch: { maxSize: 2 } })).rejects.toThrow(/subscriberId/);
  });

  it('delivers events through cache-backed batching when inner is non-native', async () => {
    const inner = new StubPubSub();
    const caching = new CachingPubSub(inner, cache);
    const cb = vi.fn();

    await caching.subscribe('topic-a', cb, { batch: { maxSize: 3, subscriberId: 'sub-1' } });

    await caching.publish('topic-a', { type: 'a', data: {}, runId: 'r' });
    await caching.publish('topic-a', { type: 'b', data: {}, runId: 'r' });
    expect(cb).not.toHaveBeenCalled();

    await caching.publish('topic-a', { type: 'c', data: {}, runId: 'r' });

    // Drain microtasks queued by the batched subscriber.
    await new Promise(r => setTimeout(r, 10));

    expect(cb).toHaveBeenCalledTimes(3);
    expect(cb.mock.calls.map(c => c[0].type)).toEqual(['a', 'b', 'c']);
  });

  it('advances the cursor in the cache after a successful delivery', async () => {
    const inner = new StubPubSub();
    const caching = new CachingPubSub(inner, cache, { keyPrefix: 'pfx:' });
    const cb = vi.fn();

    await caching.subscribe('topic-a', cb, { batch: { maxSize: 2, subscriberId: 'sub-1' } });

    await caching.publish('topic-a', { type: 'a', data: {}, runId: 'r' });
    await caching.publish('topic-a', { type: 'b', data: {}, runId: 'r' });
    await new Promise(r => setTimeout(r, 10));

    expect(cb).toHaveBeenCalledTimes(2);
    const cursor = await cache.get('pfx:topic-a:batch:sub-1:cursor');
    expect(cursor).toBe(1); // 0-indexed; second event has index 1
  });

  it('does not advance the cursor when cb throws; retries the same range on next flush', async () => {
    const inner = new StubPubSub();
    const caching = new CachingPubSub(inner, cache, { keyPrefix: 'pfx:' });

    let shouldThrow = true;
    const seen: string[] = [];
    const cb = vi.fn().mockImplementation((event: Event) => {
      seen.push(event.type);
      if (shouldThrow) throw new Error('first attempt fails');
    });

    await caching.subscribe('topic-a', cb, { batch: { maxSize: 2, subscriberId: 'sub-1' } });

    await caching.publish('topic-a', { type: 'a', data: {}, runId: 'r' });
    await caching.publish('topic-a', { type: 'b', data: {}, runId: 'r' });
    await new Promise(r => setTimeout(r, 10));

    // First flush: cb saw 'a', threw, and the loop broke. 'b' was not attempted.
    expect(seen).toEqual(['a']);
    const cursorAfterFail = await cache.get('pfx:topic-a:batch:sub-1:cursor');
    expect(cursorAfterFail).toBeUndefined();

    // Allow next attempt to succeed and trigger another flush by publishing
    // a third event, which makes pending == 3 and re-triggers flush-now.
    shouldThrow = false;
    await caching.publish('topic-a', { type: 'c', data: {}, runId: 'r' });
    await new Promise(r => setTimeout(r, 10));

    // After retry, seen is exactly ['a', 'a', 'b', 'c'] — the 'a' from the
    // failed attempt, then the full successful re-flush.
    expect(seen).toEqual(['a', 'a', 'b', 'c']);
    const cursorAfterRetry = await cache.get('pfx:topic-a:batch:sub-1:cursor');
    expect(cursorAfterRetry).toBe(2);
  });

  // Re-entrancy: with a slow cb, a maxSize trigger could otherwise overlap
  // with a follow-up enqueue and double-deliver or double-advance the cursor.
  it('serializes overlapping flushes; each event delivered exactly once', async () => {
    const inner = new StubPubSub();
    const caching = new CachingPubSub(inner, cache, { keyPrefix: 'pfx:' });

    let release!: () => void;
    let gate = new Promise<void>(r => (release = r));
    const seen: string[] = [];
    let cbInvocations = 0;
    const cb = vi.fn().mockImplementation(async (event: Event) => {
      cbInvocations += 1;
      seen.push(event.type);
      if (cbInvocations === 1) {
        // While the first cb is awaiting, the third event arrives and would
        // otherwise trigger an overlapping flush.
        await gate;
      }
    });

    await caching.subscribe('topic-a', cb, { batch: { maxSize: 2, subscriberId: 'sub-1' } });

    await caching.publish('topic-a', { type: 'a', data: {}, runId: 'r' });
    await caching.publish('topic-a', { type: 'b', data: {}, runId: 'r' });
    // First flush is now in-flight, awaiting `gate` mid-'a'.
    // Publish 'c' — this would normally fire another flush-now, but the
    // re-entrancy guard should defer it until the current pass finishes.
    await caching.publish('topic-a', { type: 'c', data: {}, runId: 'r' });

    // Release the first cb so flushing can complete.
    release();
    // Drain microtasks + a macrotask tick instead of sleeping on wall time
    // (20ms is short enough that a CI GC pause can race past it).
    await new Promise(r => setImmediate(r));
    for (let i = 0; i < 5; i++) await Promise.resolve();

    // Each event delivered exactly once, in publish order.
    expect(seen).toEqual(['a', 'b', 'c']);
    const cursor = await cache.get('pfx:topic-a:batch:sub-1:cursor');
    expect(cursor).toBe(2);
  });

  // caching.flush() must drain in-flight cache-backed batches before
  // delegating to inner.flush(). Without this, callers using flush() to
  // force-deliver at run boundaries silently drop pending events.
  it('flush() drains in-flight cache-backed batches before resolving', async () => {
    const inner = new StubPubSub();
    const caching = new CachingPubSub(inner, cache, { keyPrefix: 'pfx:' });
    const cb = vi.fn();

    // maxWaitMs is effectively infinite, so without flush() these events
    // would sit in the buffer forever.
    await caching.subscribe('topic-a', cb, {
      batch: { maxSize: 100, maxWaitMs: 60_000, subscriberId: 'sub-1' },
    });

    await caching.publish('topic-a', { type: 'a', data: {}, runId: 'r' });
    await caching.publish('topic-a', { type: 'b', data: {}, runId: 'r' });
    // Let the wrappedCb microtasks (which push into pendingIndices) settle.
    await new Promise(r => setTimeout(r, 5));
    expect(cb).not.toHaveBeenCalled();

    await caching.flush();

    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb.mock.calls.map(c => c[0].type)).toEqual(['a', 'b']);
  });

  // Rehydration: on startup, a fresh CachingPubSub against a cache that
  // already has pending indices for a subscriber must replay every one.
  it('rehydrates pending indices on subscribe and delivers them', async () => {
    const inner = new StubPubSub();
    const caching = new CachingPubSub(inner, cache, { keyPrefix: 'pfx:' });

    // Pre-populate the cache: 3 events with indices 0, 1, 2 and a pending
    // list listing all three for sub-1.
    const events: Event[] = [
      { type: 'a', id: 'id-a', data: {}, runId: 'r', index: 0, createdAt: new Date() },
      { type: 'b', id: 'id-b', data: {}, runId: 'r', index: 1, createdAt: new Date() },
      { type: 'c', id: 'id-c', data: {}, runId: 'r', index: 2, createdAt: new Date() },
    ];
    await cache.set('pfx:topic-a', events);
    await cache.set('pfx:topic-a:batch:sub-1:pending', [0, 1, 2]);

    const cb = vi.fn();
    await caching.subscribe('topic-a', cb, { batch: { maxSize: 3, subscriberId: 'sub-1' } });

    // Allow rehydration-driven flush microtasks to run.
    await new Promise(r => setTimeout(r, 10));

    expect(cb).toHaveBeenCalledTimes(3);
    expect(cb.mock.calls.map(c => c[0].type)).toEqual(['a', 'b', 'c']);
  });

  // Regression: flushOnce used `advanceTo = max(lastDeliveredIndex, droppedMaxIndex)`
  // and removed every pending index <= advanceTo. If the cb threw partway
  // through delivery AND a higher-indexed event was dropped by coalesce, the
  // cb-errored event got purged from the pending list and was lost.
  it('keeps cb-errored events pending when a higher-indexed event is dropped by coalesce', async () => {
    const inner = new StubPubSub();
    const caching = new CachingPubSub(inner, cache, { keyPrefix: 'pfx:' });

    let throwOnB = true;
    const seen: string[] = [];
    const cb = vi.fn().mockImplementation(async (event: Event) => {
      seen.push(event.type);
      if (event.type === 'b' && throwOnB) {
        throw new Error('boom');
      }
    });

    await caching.subscribe('topic-a', cb, {
      batch: {
        maxSize: 3,
        subscriberId: 'sub-1',
        // Drop events whose data.drop === true.
        coalesce: events => events.filter(e => !e.data?.drop),
      },
    });

    // a (keep), b (keep, cb throws), c (drop by coalesce, index > b)
    await caching.publish('topic-a', { type: 'a', data: { drop: false }, runId: 'r' });
    await caching.publish('topic-a', { type: 'b', data: { drop: false }, runId: 'r' });
    await caching.publish('topic-a', { type: 'c', data: { drop: true }, runId: 'r' });

    // Allow flush microtasks to settle.
    await new Promise(r => setTimeout(r, 10));

    // First pass: 'a' delivered, 'b' attempted (threw), 'c' dropped by coalesce.
    expect(seen).toEqual(['a', 'b']);
    // Cursor reflects the highest contiguously-delivered index, which is 'a' (0).
    const cursorAfterFail = await cache.get('pfx:topic-a:batch:sub-1:cursor');
    expect(cursorAfterFail).toBe(0);

    // 'b' must still be pending — the bug would have purged it because
    // droppedMaxIndex (2 = 'c') > b's index (1).
    const pendingAfterFail = (await cache.get('pfx:topic-a:batch:sub-1:pending')) as number[];
    expect(pendingAfterFail).toEqual([1]);

    // Stop throwing and force another flush. 'b' should be retried and delivered.
    throwOnB = false;
    await caching.flush();
    await new Promise(r => setTimeout(r, 5));

    expect(seen).toEqual(['a', 'b', 'b']);
    const cursorAfterRetry = await cache.get('pfx:topic-a:batch:sub-1:cursor');
    expect(cursorAfterRetry).toBe(1);
    const pendingAfterRetry = (await cache.get('pfx:topic-a:batch:sub-1:pending')) as number[];
    expect(pendingAfterRetry).toEqual([]);
  });

  // Regression: when a batched cb throws in the cache-backed path, the log
  // line must include the event index and id so the failing event can be
  // identified across deployments. Earlier passes shipped this change with
  // no assertion on log content.
  it('includes event index and id in the cb-error log message', async () => {
    const error = vi.fn();
    const inner = new StubPubSub();
    const caching = new CachingPubSub(inner, cache, {
      keyPrefix: 'pfx:',
      logger: { error, warn: vi.fn(), info: vi.fn(), debug: vi.fn() } as any,
    });

    const cb = vi.fn().mockRejectedValue(new Error('boom'));
    await caching.subscribe('topic-cb-log', cb, {
      batch: { maxSize: 1, subscriberId: 'sub-1' },
    });
    await caching.publish('topic-cb-log', { type: 'x', data: {}, runId: 'r' });
    await new Promise(r => setTimeout(r, 5));

    const matching = error.mock.calls.find(
      call => typeof call[0] === 'string' && /cache-backed batch cb failed/.test(call[0]),
    );
    expect(matching).toBeDefined();
    expect(matching![0]).toMatch(/at index 0/);
    expect(matching![0]).toMatch(/id=/);
  });

  // Bug: `wrappedCb` runs as `void (async () => {...})()`. If `flush()`
  // rejects from a non-cb path (e.g. a throwing `coalesce` inside
  // `policy.prepareBatch`), the rejection escapes the IIFE as an unhandled
  // rejection. In production this gets observed as a global noise event or,
  // worse, crashes the process under `--unhandled-rejections=strict`.
  it('does not leak unhandled rejections when flush throws inside wrappedCb', async () => {
    const rejections: unknown[] = [];
    const handler = (e: unknown) => rejections.push(e);
    process.on('unhandledRejection', handler);
    try {
      const error = vi.fn();
      const inner = new StubPubSub();
      const caching = new CachingPubSub(inner, cache, {
        keyPrefix: 'pfx:',
        logger: { error, warn: vi.fn(), info: vi.fn(), debug: vi.fn() } as any,
      });
      const cb = vi.fn();
      await caching.subscribe('topic-leak', cb, {
        batch: {
          maxSize: 1,
          subscriberId: 'sub-1',
          coalesce: () => {
            throw new Error('coalesce blew up');
          },
        },
      });
      await caching.publish('topic-leak', { type: 'x', data: {}, runId: 'r' });
      // Let the IIFE chain settle and any unhandled rejection surface.
      // setImmediate gives Node a turn to fire `unhandledRejection` without
      // depending on wall-clock timing.
      await new Promise(r => setImmediate(r));
      for (let i = 0; i < 5; i++) await Promise.resolve();
      expect(rejections).toEqual([]);
      // The error must still be observable somewhere — the logger.
      expect(error).toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', handler);
    }
  });

  // Bug: if the pending list survived but the cached event at that index was
  // evicted (cache truncation, TTL, etc.), `subscribeBatched` would skip the
  // index silently. Operators have no signal to investigate stuck pending
  // entries. A single aggregated `warn` log makes it diagnosable without
  // log spam if many indices are orphaned at once.
  it('warns once with aggregated count when rehydrated indices have no event in cache', async () => {
    const orphanCount = 12;
    const orphans = Array.from({ length: orphanCount }, (_, i) => i + 100);
    await cache.set('pfx:topic-orphan:batch:sub-1:pending', orphans);
    const warn = vi.fn();
    const inner = new StubPubSub();
    const caching = new CachingPubSub(inner, cache, {
      keyPrefix: 'pfx:',
      logger: { error: vi.fn(), warn, info: vi.fn(), debug: vi.fn() } as any,
    });

    const cb = vi.fn();
    await caching.subscribe('topic-orphan', cb, {
      batch: { maxSize: 5, subscriberId: 'sub-1' },
    });

    // Exactly one warning, not 12.
    const orphanCalls = warn.mock.calls.filter(c => typeof c[0] === 'string' && /orphan/i.test(c[0]));
    expect(orphanCalls.length).toBe(1);
    // Message mentions total count and includes at least one sample index.
    expect(orphanCalls[0]![0]).toMatch(String(orphanCount));
    const meta = orphanCalls[0]![1] as Record<string, unknown> | undefined;
    expect(meta?.orphanCount).toBe(orphanCount);
    expect(Array.isArray(meta?.firstFew)).toBe(true);
  });

  // Regression: unsubscribe of a batched cache-backed subscriber must dispose
  // its BatchPolicy and stop delivering further events. No timer leak, no
  // ghost cb invocations on subsequent publishes.
  it('stops delivering to a batched subscriber after unsubscribe', async () => {
    const inner = new StubPubSub();
    const cache = new InMemoryServerCache();
    const caching = new CachingPubSub(inner, cache, { keyPrefix: 'pfx:' });
    const cb = vi.fn();

    await caching.subscribe('topic-unsub', cb, {
      batch: { maxSize: 2, subscriberId: 'sub-unsub' },
    });

    await caching.publish('topic-unsub', { type: '1', data: {}, runId: 'r' });
    await caching.publish('topic-unsub', { type: '2', data: {}, runId: 'r' });
    await Promise.resolve();
    await Promise.resolve();
    expect(cb).toHaveBeenCalledTimes(2);

    await caching.unsubscribe('topic-unsub', cb);

    await caching.publish('topic-unsub', { type: '3', data: {}, runId: 'r' });
    await caching.publish('topic-unsub', { type: '4', data: {}, runId: 'r' });
    await caching.publish('topic-unsub', { type: '5', data: {}, runId: 'r' });
    for (let i = 0; i < 5; i++) await Promise.resolve();

    expect(cb).toHaveBeenCalledTimes(2);
  });

  // Regression: when `cache.increment` fails, publish() used to fall through
  // with `index = 0`, causing every counter-failed event to land at the same
  // cursor key. With batching, that poisons the pending list. After the fix,
  // counter failure yields `index = undefined` and the batched subscriber's
  // index guard skips the event entirely.
  it('does not poison batching state when cache.increment fails', async () => {
    const inner = new StubPubSub();
    let failNext = false;
    const flakyCache = new InMemoryServerCache();
    const origIncrement = flakyCache.increment.bind(flakyCache);
    flakyCache.increment = async (key: string) => {
      if (failNext) {
        failNext = false;
        throw new Error('increment failed');
      }
      return origIncrement(key);
    };
    const caching = new CachingPubSub(inner, flakyCache, { keyPrefix: 'pfx:' });
    const cb = vi.fn();

    await caching.subscribe('topic-poison', cb, {
      batch: { maxSize: 3, subscriberId: 'sub-poison' },
    });

    await caching.publish('topic-poison', { type: 'a', data: {}, runId: 'r' });
    failNext = true;
    await caching.publish('topic-poison', { type: 'b-fails', data: {}, runId: 'r' });
    await caching.publish('topic-poison', { type: 'c', data: {}, runId: 'r' });
    await Promise.resolve();
    await Promise.resolve();

    // Two successful publishes, one counter-failed. Pending list must not
    // contain index=0 twice — that would corrupt the cursor on restart.
    const pending = (await flakyCache.listFromTo('pfx:topic-poison:batch:sub-poison:pending', 0)) as number[];
    const counts = new Map<number, number>();
    for (const i of pending) counts.set(i, (counts.get(i) ?? 0) + 1);
    for (const [, c] of counts) expect(c).toBe(1);

    // maxSize=3 not yet hit (only 2 events accounted for), so cb has not fired.
    expect(cb).not.toHaveBeenCalled();

    // One more real event triggers maxSize.
    await caching.publish('topic-poison', { type: 'd', data: {}, runId: 'r' });
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(cb).toHaveBeenCalledTimes(3);
    expect(cb.mock.calls.map(c => c[0].type)).toEqual(['a', 'c', 'd']);
  });

  // Regression: an event arriving at `wrappedCb` without `index` (counter
  // failure, custom inner adapter, etc.) early-returns *before* `policy.onEnqueue`.
  // If that ever flips, `policy.size` accumulates ghost events and triggers
  // maxSize flushes against an empty pending list.
  it('does not advance policy.size when wrappedCb receives an index-less event', async () => {
    const inner = new StubPubSub();
    const caching = new CachingPubSub(inner, cache, { keyPrefix: 'pfx:' });
    const cb = vi.fn();

    await caching.subscribe('topic-noidx', cb, {
      batch: { maxSize: 2, subscriberId: 'sub-noidx' },
    });

    // Bypass CachingPubSub.publish so the inner emits an event with no index.
    await inner.publish('topic-noidx', { type: 'a', data: {}, runId: 'r' } as Event);
    await inner.publish('topic-noidx', { type: 'b', data: {}, runId: 'r' } as Event);
    await Promise.resolve();
    await Promise.resolve();

    // Two index-less events must not have flushed anything.
    expect(cb).not.toHaveBeenCalled();

    // Now publish a single real event through CachingPubSub. It gets index=0.
    // If policy.size had drifted to 2, this one event would trigger a flush
    // against an empty/sparse pending list. Instead the policy should see
    // size=1 and wait.
    await caching.publish('topic-noidx', { type: 'real', data: {}, runId: 'r' });
    await Promise.resolve();
    await Promise.resolve();
    expect(cb).not.toHaveBeenCalled();

    // One more real event reaches maxSize=2 and flushes both.
    await caching.publish('topic-noidx', { type: 'real2', data: {}, runId: 'r' });
    await Promise.resolve();
    await Promise.resolve();
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb.mock.calls.map(c => c[0].type)).toEqual(['real', 'real2']);
  });
});
