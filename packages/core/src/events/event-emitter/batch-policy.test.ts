import { describe, it, expect, vi } from 'vitest';
import type { Event } from '../types';
import type { BatchPolicyDeps, BatchPolicyTimerHandle } from './batch-policy';
import { BatchPolicy } from './batch-policy';

/**
 * Manual fake clock — avoids vi.useFakeTimers global state and gives us
 * total control over the order of (now → setTimeout → clearTimeout) calls
 * that BatchPolicy makes.
 *
 * Why not `vi.useFakeTimers()`? BatchPolicy interleaves timer scheduling
 * with promise microtasks (`flushHandler` returns a Promise). vi's global
 * timer mock swaps Date/setTimeout for the whole test, which has historically
 * raced with our async flush handler resolution and produced flaky ordering.
 * Injecting a clock through `BatchPolicyDeps` keeps timer control local to
 * the test and decoupled from the runtime's microtask queue.
 */
function makeFakeClock(): {
  deps: BatchPolicyDeps;
  advance: (ms: number) => Promise<void>;
  current: () => number;
} {
  let now = 1000;
  let nextId = 1;
  const pending = new Map<number, { fireAt: number; cb: () => void }>();

  // Round-trip a numeric id through the brand. Production stores Node's
  // Timeout the same way — the handle is opaque to BatchPolicy either way.
  const toHandle = (id: number): BatchPolicyTimerHandle => id as unknown as BatchPolicyTimerHandle;
  const fromHandle = (handle: BatchPolicyTimerHandle): number => handle as unknown as number;

  const deps: BatchPolicyDeps = {
    now: () => now,
    setTimeout: (cb: () => void, ms: number) => {
      const id = nextId++;
      pending.set(id, { fireAt: now + Math.max(0, ms), cb });
      return toHandle(id);
    },
    clearTimeout: handle => {
      pending.delete(fromHandle(handle));
    },
  };

  const advance = async (ms: number): Promise<void> => {
    const target = now + ms;
    // Repeatedly find the next timer that fires <= target and run it, since
    // timer callbacks can themselves schedule new timers.
    while (true) {
      let nextHandle: number | null = null;
      let nextFireAt = Number.POSITIVE_INFINITY;
      for (const [id, t] of pending) {
        if (t.fireAt <= target && t.fireAt < nextFireAt) {
          nextFireAt = t.fireAt;
          nextHandle = id;
        }
      }
      if (nextHandle === null) break;
      const entry = pending.get(nextHandle)!;
      pending.delete(nextHandle);
      now = entry.fireAt;
      entry.cb();
      // allow any microtasks queued by cb to run
      await Promise.resolve();
    }
    now = target;
  };

  return { deps, advance, current: () => now };
}

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    type: 'test',
    id: `id-${Math.random().toString(36).slice(2)}`,
    data: {},
    runId: 'run-1',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('BatchPolicy', () => {
  describe('maxSize', () => {
    it('returns flush-now once size reaches maxSize', () => {
      const { deps } = makeFakeClock();
      const policy = new BatchPolicy({ maxSize: 3 }, deps);

      expect(policy.onEnqueue(makeEvent())).toBe('wait');
      expect(policy.onEnqueue(makeEvent())).toBe('wait');
      expect(policy.onEnqueue(makeEvent())).toBe('flush-now');
    });

    it('after flush, next enqueue arms a fresh window', async () => {
      const { deps } = makeFakeClock();
      const policy = new BatchPolicy({ maxSize: 3 }, deps);

      policy.onEnqueue(makeEvent());
      policy.onEnqueue(makeEvent());
      const decision = policy.onEnqueue(makeEvent());
      expect(decision).toBe('flush-now');
      policy.onFlushed(3);

      expect(policy.onEnqueue(makeEvent())).toBe('wait');
      expect(policy.onEnqueue(makeEvent())).toBe('wait');
      expect(policy.onEnqueue(makeEvent())).toBe('flush-now');
    });
  });

  describe('maxWaitMs', () => {
    it('fires the bound flushHandler after maxWaitMs elapses', async () => {
      const { deps, advance } = makeFakeClock();
      const policy = new BatchPolicy({ maxWaitMs: 100 }, deps);
      const flush = vi.fn();
      policy.bindFlushHandler(flush);

      policy.onEnqueue(makeEvent());

      await advance(99);
      expect(flush).not.toHaveBeenCalled();

      await advance(1);
      expect(flush).toHaveBeenCalledTimes(1);
    });

    it('does not fire when buffer is empty (timer never armed)', async () => {
      const { deps, advance } = makeFakeClock();
      const policy = new BatchPolicy({ maxWaitMs: 100 }, deps);
      const flush = vi.fn();
      policy.bindFlushHandler(flush);

      await advance(1000);
      expect(flush).not.toHaveBeenCalled();
    });
  });

  describe('minIntervalMs floor', () => {
    it('defers maxWaitMs-triggered flush until interval floor', async () => {
      const { deps, advance } = makeFakeClock();
      const policy = new BatchPolicy({ maxWaitMs: 100, minIntervalMs: 500 }, deps);
      const flush = vi.fn();
      policy.bindFlushHandler(flush);

      // First delivery establishes lastDeliveredAt = current time.
      policy.onEnqueue(makeEvent());
      await advance(100);
      expect(flush).toHaveBeenCalledTimes(1);
      policy.onFlushed(1);

      // Next enqueue immediately — maxWaitMs would fire at +100 but
      // minIntervalMs floor pushes it to +500 from lastDeliveredAt.
      policy.onEnqueue(makeEvent());
      await advance(100);
      expect(flush).toHaveBeenCalledTimes(1); // not yet
      await advance(400);
      expect(flush).toHaveBeenCalledTimes(2);
    });

    it('maxSize trigger waits for interval floor', async () => {
      const { deps, advance } = makeFakeClock();
      const policy = new BatchPolicy({ maxSize: 2, minIntervalMs: 500 }, deps);
      const flush = vi.fn();
      policy.bindFlushHandler(flush);

      policy.onEnqueue(makeEvent());
      policy.onEnqueue(makeEvent());
      // First batch flushes immediately (lastDeliveredAt starts at -Infinity).
      // Calling onFlushed simulates that delivery.
      policy.onFlushed(2);

      // Second wave hits maxSize before the floor:
      expect(policy.onEnqueue(makeEvent())).toBe('wait');
      const decision = policy.onEnqueue(makeEvent());
      expect(decision).toBe('wait'); // floor not reached
      await advance(500);
      expect(flush).toHaveBeenCalledTimes(1); // fires after floor
    });
  });

  describe('isImmediate', () => {
    it('returns flush-now when the immediate predicate matches', () => {
      const { deps } = makeFakeClock();
      const policy = new BatchPolicy({ isImmediate: e => e.type === 'urgent' }, deps);

      expect(policy.onEnqueue(makeEvent({ type: 'normal' }))).toBe('wait');
      expect(policy.onEnqueue(makeEvent({ type: 'urgent' }))).toBe('flush-now');
    });

    it('defers immediate event until interval floor when within minIntervalMs', async () => {
      const { deps, advance } = makeFakeClock();
      const policy = new BatchPolicy({ minIntervalMs: 500, isImmediate: e => e.type === 'urgent' }, deps);
      const flush = vi.fn();
      policy.bindFlushHandler(flush);

      policy.onEnqueue(makeEvent({ type: 'urgent' }));
      // First flush is allowed (lastDeliveredAt is -Infinity).
      // Simulate delivery.
      expect(flush).not.toHaveBeenCalled(); // policy returns flush-now but doesn't itself flush
      policy.onFlushed(1);

      // Now within the floor, an immediate event is held until lastDeliveredAt + 500.
      const decision = policy.onEnqueue(makeEvent({ type: 'urgent' }));
      expect(decision).toBe('wait');

      await advance(500);
      expect(flush).toHaveBeenCalledTimes(1);
    });
  });

  describe('prepareBatch — coalesce', () => {
    it('runs the coalesce fn and treats removed events as dropped', () => {
      const { deps } = makeFakeClock();
      const events = [
        makeEvent({ data: { path: 'a' } }),
        makeEvent({ data: { path: 'b' } }),
        makeEvent({ data: { path: 'a' } }),
      ];
      const policy = new BatchPolicy(
        {
          coalesce: input => {
            // Keep only the latest per `path`, preserving order.
            const seen = new Set<string>();
            const reversed = [...input].reverse();
            const kept: Event[] = [];
            for (const e of reversed) {
              if (!seen.has(e.data.path)) {
                seen.add(e.data.path);
                kept.push(e);
              }
            }
            return kept.reverse();
          },
        },
        deps,
      );

      const { delivered, dropped } = policy.prepareBatch(events);
      expect(delivered.map(e => e.data.path)).toEqual(['b', 'a']);
      // The first 'a' is dropped (older duplicate).
      expect(dropped).toHaveLength(1);
      expect(dropped[0]!.data.path).toBe('a');
    });

    it('preserves order for kept events', () => {
      const { deps } = makeFakeClock();
      const events = [makeEvent({ id: '1' }), makeEvent({ id: '2' }), makeEvent({ id: '3' })];
      const policy = new BatchPolicy({ coalesce: e => e.filter(x => x.id !== '2') }, deps);

      const { delivered } = policy.prepareBatch(events);
      expect(delivered.map(e => e.id)).toEqual(['1', '3']);
    });
  });

  describe('prepareBatch — overflow', () => {
    it('drops oldest when over maxBufferSize with default overflow', () => {
      const { deps } = makeFakeClock();
      const policy = new BatchPolicy({ maxBufferSize: 4 }, deps);
      const events = Array.from({ length: 6 }, (_, i) => makeEvent({ id: String(i) }));

      const { delivered, dropped } = policy.prepareBatch(events);
      expect(delivered.map(e => e.id)).toEqual(['2', '3', '4', '5']);
      expect(dropped.map(e => e.id).sort()).toEqual(['0', '1']);
    });

    it('drops newest when overflow is drop-newest', () => {
      const { deps } = makeFakeClock();
      const policy = new BatchPolicy({ maxBufferSize: 4, overflow: 'drop-newest' }, deps);
      const events = Array.from({ length: 6 }, (_, i) => makeEvent({ id: String(i) }));

      const { delivered, dropped } = policy.prepareBatch(events);
      expect(delivered.map(e => e.id)).toEqual(['0', '1', '2', '3']);
      expect(dropped.map(e => e.id).sort()).toEqual(['4', '5']);
    });

    it('never drops immediate-flagged events even when over budget', () => {
      const { deps } = makeFakeClock();
      const policy = new BatchPolicy({ maxBufferSize: 2, isImmediate: e => e.type === 'urgent' }, deps);
      const events = [
        makeEvent({ id: '1', type: 'urgent' }),
        makeEvent({ id: '2', type: 'normal' }),
        makeEvent({ id: '3', type: 'normal' }),
        makeEvent({ id: '4', type: 'urgent' }),
      ];

      const { delivered, dropped } = policy.prepareBatch(events);
      expect(delivered.map(e => e.id).filter(id => id === '1' || id === '4')).toEqual(['1', '4']);
      expect(dropped.every(d => d.type === 'normal')).toBe(true);
    });
  });

  describe('dispose', () => {
    it('clears any pending timer', async () => {
      const { deps, advance } = makeFakeClock();
      const policy = new BatchPolicy({ maxWaitMs: 100 }, deps);
      const flush = vi.fn();
      policy.bindFlushHandler(flush);

      policy.onEnqueue(makeEvent());
      policy.dispose();

      await advance(500);
      expect(flush).not.toHaveBeenCalled();
    });
  });

  describe('maxWaitMs anchoring', () => {
    // Regression: maxWaitMs is anchored to firstQueuedAt, not the most recent
    // enqueue. Late events sliding into the same window should still fire at
    // firstQueuedAt + maxWaitMs.
    it('fires at firstQueuedAt + maxWaitMs even with later enqueues sliding the tail', async () => {
      const { deps, advance } = makeFakeClock();
      const policy = new BatchPolicy({ maxWaitMs: 100 }, deps);
      const flush = vi.fn();
      policy.bindFlushHandler(flush);

      // t=0: enqueue A
      policy.onEnqueue(makeEvent({ id: 'a' }));
      // t=50: enqueue B
      await advance(50);
      policy.onEnqueue(makeEvent({ id: 'b' }));
      // t=80: enqueue C
      await advance(30);
      policy.onEnqueue(makeEvent({ id: 'c' }));

      // Should fire at t=100 (anchored to A's enqueue), not t=180.
      expect(flush).not.toHaveBeenCalled();
      await advance(20);
      expect(flush).toHaveBeenCalledTimes(1);
    });
  });
});
