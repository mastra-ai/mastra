import { describe, it, expect, vi } from 'vitest';
import type { Event } from '../types';
import { AckHandleBuffer } from './ack-handle-buffer';
import type { BatchPolicyDeps, BatchPolicyTimerHandle } from './batch-policy';

function makeFakeClock(): { deps: BatchPolicyDeps; advance: (ms: number) => Promise<void> } {
  let now = 1000;
  let nextId = 1;
  const pending = new Map<number, { fireAt: number; cb: () => void }>();
  const toHandle = (id: number): BatchPolicyTimerHandle => id as unknown as BatchPolicyTimerHandle;
  const fromHandle = (handle: BatchPolicyTimerHandle): number => handle as unknown as number;
  const deps: BatchPolicyDeps = {
    now: () => now,
    setTimeout: (cb, ms) => {
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
      await Promise.resolve();
    }
    now = target;
  };
  return { deps, advance };
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

describe('AckHandleBuffer', () => {
  it('delivers events one-by-one when maxSize is reached', async () => {
    const { deps } = makeFakeClock();
    const cb = vi.fn();
    const buffer = new AckHandleBuffer(cb, { maxSize: 3 }, deps);

    await buffer.push(makeEvent({ id: 'a' }));
    await buffer.push(makeEvent({ id: 'b' }));
    await buffer.push(makeEvent({ id: 'c' }));

    expect(cb).toHaveBeenCalledTimes(3);
    expect(cb.mock.calls.map(c => c[0].id)).toEqual(['a', 'b', 'c']);
  });

  it('flush() drains the queue regardless of policy state', async () => {
    const { deps } = makeFakeClock();
    const cb = vi.fn();
    const buffer = new AckHandleBuffer(cb, { maxSize: 100, maxWaitMs: 10_000 }, deps);

    await buffer.push(makeEvent({ id: 'a' }));
    await buffer.push(makeEvent({ id: 'b' }));
    expect(cb).not.toHaveBeenCalled();

    await buffer.flush();
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('calls ack for coalesced-out events without invoking cb on them', async () => {
    const { deps } = makeFakeClock();
    const cb = vi.fn();
    const ackA = vi.fn().mockResolvedValue(undefined);
    const ackB = vi.fn().mockResolvedValue(undefined);
    const ackC = vi.fn().mockResolvedValue(undefined);

    const buffer = new AckHandleBuffer(
      cb,
      {
        maxSize: 3,
        // Drop events whose data.drop === true.
        coalesce: events => events.filter(e => !e.data?.drop),
      },
      deps,
    );

    await buffer.push(makeEvent({ id: 'a', data: { drop: false } }), ackA);
    await buffer.push(makeEvent({ id: 'b', data: { drop: true } }), ackB);
    await buffer.push(makeEvent({ id: 'c', data: { drop: false } }), ackC);

    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb.mock.calls.map(c => c[0].id)).toEqual(['a', 'c']);
    expect(ackB).toHaveBeenCalledTimes(1); // dropped event acked
    // delivered events: their ack/nack are passed through to cb but not
    // invoked by the buffer itself.
    expect(ackA).not.toHaveBeenCalled();
    expect(ackC).not.toHaveBeenCalled();
  });

  it('treats a contract-violating coalesce (returns fresh objects) as drop-all', async () => {
    // The coalesce contract requires returning a subset of input events by
    // reference identity. A coalesce that constructs fresh Event objects —
    // even with the same `id` — is a contract violation: the buffer can't
    // route ack/nack to the original transport handles for "merged" events.
    // The defensive behavior is to drop everything in the violating batch
    // (acking each original) rather than silently deliver bogus references
    // with no ack/nack wired up.
    const { deps } = makeFakeClock();
    const cb = vi.fn();
    const ackA = vi.fn().mockResolvedValue(undefined);
    const ackB = vi.fn().mockResolvedValue(undefined);

    const buffer = new AckHandleBuffer(
      cb,
      {
        maxSize: 2,
        // Returns a fresh object with a matching id — contract violation.
        coalesce: events => events.map(e => ({ ...e })),
      },
      deps,
    );

    await buffer.push(makeEvent({ id: 'a' }), ackA);
    await buffer.push(makeEvent({ id: 'b' }), ackB);

    // No bogus deliveries.
    expect(cb).not.toHaveBeenCalled();
    // Both originals were acked (treated as drops).
    expect(ackA).toHaveBeenCalledTimes(1);
    expect(ackB).toHaveBeenCalledTimes(1);
  });

  it('isolates failures: a throwing cb does not block subsequent events', async () => {
    const { deps } = makeFakeClock();
    const cb = vi.fn().mockImplementation((event: Event) => {
      if (event.id === 'b') throw new Error('boom');
    });
    const buffer = new AckHandleBuffer(cb, { maxSize: 3 }, deps);

    await buffer.push(makeEvent({ id: 'a' }));
    await buffer.push(makeEvent({ id: 'b' }));
    await buffer.push(makeEvent({ id: 'c' }));

    expect(cb).toHaveBeenCalledTimes(3);
    expect(cb.mock.calls.map(c => c[0].id)).toEqual(['a', 'b', 'c']);
  });

  it('passes ack/nack through to the user callback for delivered events', async () => {
    const { deps } = makeFakeClock();
    const cb = vi.fn();
    const ack = vi.fn();
    const nack = vi.fn();
    const buffer = new AckHandleBuffer(cb, { maxSize: 1 }, deps);

    await buffer.push(makeEvent({ id: 'x' }), ack, nack);

    expect(cb).toHaveBeenCalledTimes(1);
    const [, gotAck, gotNack] = cb.mock.calls[0]!;
    expect(gotAck).toBe(ack);
    expect(gotNack).toBe(nack);
  });

  it('dispose() prevents further pushes from reaching cb', async () => {
    const { deps, advance } = makeFakeClock();
    const cb = vi.fn();
    const buffer = new AckHandleBuffer(cb, { maxWaitMs: 100 }, deps);

    await buffer.push(makeEvent({ id: 'a' }));
    buffer.dispose();
    await buffer.push(makeEvent({ id: 'b' }));

    await advance(500);
    expect(cb).not.toHaveBeenCalled();
  });

  // Regression: policy.onFlushed(delivered.length) used to ignore dropped events,
  // so policy.size drifted upward by `dropped.length` after every flush that
  // coalesced anything. Subsequent batches then triggered maxSize prematurely.
  it('does not drift policy.size after a flush with dropped events', async () => {
    const { deps } = makeFakeClock();
    const cb = vi.fn();
    const buffer = new AckHandleBuffer(
      cb,
      {
        maxSize: 3,
        coalesce: events => events.filter(e => !e.data?.drop),
      },
      deps,
    );

    // First batch: a, b(drop), c → flush at maxSize=3, deliver [a, c], drop [b].
    await buffer.push(makeEvent({ id: 'a', data: { drop: false } }));
    await buffer.push(makeEvent({ id: 'b', data: { drop: true } }));
    await buffer.push(makeEvent({ id: 'c', data: { drop: false } }));
    expect(cb).toHaveBeenCalledTimes(2);

    // After the first flush the buffer is empty. Pushing two more non-drop
    // events should NOT trip maxSize=3 — but if policy.size still carries the
    // dropped 'b' it will, and cb will fire after only 2 pushes.
    cb.mockClear();
    await buffer.push(makeEvent({ id: 'd', data: { drop: false } }));
    await buffer.push(makeEvent({ id: 'e', data: { drop: false } }));
    expect(cb).not.toHaveBeenCalled();

    // The third push (f) hits maxSize=3 and flushes [d, e, f].
    await buffer.push(makeEvent({ id: 'f', data: { drop: false } }));
    expect(cb).toHaveBeenCalledTimes(3);
    expect(cb.mock.calls.map(c => c[0].id)).toEqual(['d', 'e', 'f']);
  });

  // Regression: flush() on an empty buffer used to call policy.onFlushed(0),
  // which bumped `lastDeliveredAt` and silently extended the minIntervalMs
  // floor. Callers that flush() defensively at run boundaries must not see
  // their cadence corrupted.
  it('flush() on an empty buffer does not bump minIntervalMs floor', async () => {
    const { deps, advance } = makeFakeClock();
    const cb = vi.fn();
    const buffer = new AckHandleBuffer(cb, { maxSize: 1, minIntervalMs: 100 }, deps);

    await buffer.flush(); // empty — should be a no-op
    await advance(1);

    await buffer.push(makeEvent({ id: 'a' }));
    // With a fresh policy (lastDeliveredAt = 0), maxSize: 1 should fire
    // immediately. If the empty flush had bumped lastDeliveredAt, the
    // 100ms floor would block this delivery.
    expect(cb).toHaveBeenCalledTimes(1);
  });

  // Regression: when a cb calls buffer.dispose() mid-delivery, the buffer
  // must stop invoking the cb for remaining events in the same flush pass.
  // Otherwise the "no callbacks after dispose" contract is broken — the
  // subscriber asked to be torn down and we kept feeding them events.
  it('stops delivering once dispose() is called from inside a cb', async () => {
    const { deps } = makeFakeClock();
    let buffer!: AckHandleBuffer;
    const seen: string[] = [];
    const cb = vi.fn().mockImplementation((event: Event) => {
      seen.push(event.id);
      if (event.id === 'a') {
        buffer.dispose();
      }
    });
    buffer = new AckHandleBuffer(cb, { maxSize: 3 }, deps);

    await buffer.push(makeEvent({ id: 'a' }));
    await buffer.push(makeEvent({ id: 'b' }));
    await buffer.push(makeEvent({ id: 'c' }));

    expect(seen).toEqual(['a']);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  // Regression: a push() that arrives while a flush is mid-delivery and
  // requests flush-now must not be dropped. Previously flush() bailed on
  // `if (this.flushing) return;` and those events sat until the policy
  // timer fired, adding up to `maxWaitMs` of unintended latency.
  it('honors flush-now requests that arrive during an in-flight flush', async () => {
    const { deps } = makeFakeClock();
    let buffer!: AckHandleBuffer;
    const seen: string[] = [];
    const cb = vi.fn().mockImplementation(async (event: Event) => {
      seen.push(event.id);
      // The first delivery, while the outer flush is still running,
      // pushes another flush-now event. Without the reflush latch
      // this push never gets delivered until the policy timer fires.
      if (event.id === 'a') {
        await buffer.push(makeEvent({ id: 'b' }));
      }
    });
    // maxSize=1 makes every push() request flush-now.
    buffer = new AckHandleBuffer(cb, { maxSize: 1 }, deps);

    await buffer.push(makeEvent({ id: 'a' }));

    expect(seen).toEqual(['a', 'b']);
    expect(cb).toHaveBeenCalledTimes(2);
  });
});
