import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Event } from '../types';
import { EventEmitterPubSub } from './index';

function makeEvent(overrides: Partial<Omit<Event, 'id' | 'createdAt'>> = {}): Omit<Event, 'id' | 'createdAt'> {
  return {
    type: 'test',
    data: {},
    runId: 'run-1',
    ...overrides,
  };
}

describe('EventEmitterPubSub — batching', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
    vi.useRealTimers();
  });

  it('declares supportsNativeBatching = true', () => {
    expect(pubsub.supportsNativeBatching).toBe(true);
  });

  it('without options.batch, behavior is unchanged (one cb per event)', async () => {
    const cb = vi.fn();
    await pubsub.subscribe('topic-a', cb);

    await pubsub.publish('topic-a', makeEvent({ type: 'one' }));
    await pubsub.publish('topic-a', makeEvent({ type: 'two' }));

    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('with batch.maxSize, delivers callbacks once size reached', async () => {
    const cb = vi.fn();
    await pubsub.subscribe('topic-a', cb, { batch: { maxSize: 3 } });

    await pubsub.publish('topic-a', makeEvent({ type: 'a' }));
    await pubsub.publish('topic-a', makeEvent({ type: 'b' }));
    expect(cb).not.toHaveBeenCalled();

    await pubsub.publish('topic-a', makeEvent({ type: 'c' }));

    // Allow microtasks to drain the buffer.
    await Promise.resolve();
    await Promise.resolve();

    expect(cb).toHaveBeenCalledTimes(3);
    expect(cb.mock.calls.map(c => c[0].type)).toEqual(['a', 'b', 'c']);
  });

  it('with batch.maxWaitMs, holds events until the timer fires', async () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    await pubsub.subscribe('topic-a', cb, { batch: { maxWaitMs: 100 } });

    await pubsub.publish('topic-a', makeEvent({ type: 'a' }));
    expect(cb).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(99);
    expect(cb).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('flush() drains a partial batch', async () => {
    const cb = vi.fn();
    await pubsub.subscribe('topic-a', cb, { batch: { maxSize: 10, maxWaitMs: 60_000 } });

    await pubsub.publish('topic-a', makeEvent({ type: 'a' }));
    await pubsub.publish('topic-a', makeEvent({ type: 'b' }));
    expect(cb).not.toHaveBeenCalled();

    await pubsub.flush();
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('unsubscribe disposes the buffer; subsequent events do not reach cb', async () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    await pubsub.subscribe('topic-a', cb, { batch: { maxWaitMs: 100 } });

    await pubsub.publish('topic-a', makeEvent({ type: 'a' }));
    await pubsub.unsubscribe('topic-a', cb);

    await pubsub.publish('topic-a', makeEvent({ type: 'b' }));
    await vi.advanceTimersByTimeAsync(500);

    expect(cb).not.toHaveBeenCalled();
  });

  it('two subscribers on the same topic with different batch policies operate independently', async () => {
    vi.useFakeTimers();
    const fast = vi.fn();
    const slow = vi.fn();

    await pubsub.subscribe('topic-a', fast, { batch: { maxSize: 1 } });
    await pubsub.subscribe('topic-a', slow, { batch: { maxWaitMs: 200 } });

    await pubsub.publish('topic-a', makeEvent({ type: 'one' }));
    // Let microtasks settle so the maxSize:1 buffer can flush.
    await Promise.resolve();
    await Promise.resolve();
    expect(fast).toHaveBeenCalledTimes(1);
    expect(slow).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(200);
    expect(slow).toHaveBeenCalledTimes(1);
  });

  it('group subscribers also honor batch options', async () => {
    const cb = vi.fn();
    await pubsub.subscribe('topic-a', cb, { group: 'workers', batch: { maxSize: 2 } });

    await pubsub.publish('topic-a', makeEvent({ type: 'a' }));
    expect(cb).not.toHaveBeenCalled();

    await pubsub.publish('topic-a', makeEvent({ type: 'b' }));
    await Promise.resolve();
    await Promise.resolve();
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('isImmediate event flushes pending buffer immediately', async () => {
    const cb = vi.fn();
    await pubsub.subscribe('topic-a', cb, {
      batch: { maxSize: 100, maxWaitMs: 60_000, isImmediate: e => e.type === 'urgent' },
    });

    await pubsub.publish('topic-a', makeEvent({ type: 'normal' }));
    await pubsub.publish('topic-a', makeEvent({ type: 'normal' }));
    expect(cb).not.toHaveBeenCalled();

    await pubsub.publish('topic-a', makeEvent({ type: 'urgent' }));
    await Promise.resolve();
    await Promise.resolve();

    expect(cb).toHaveBeenCalledTimes(3);
    expect(cb.mock.calls.map(c => c[0].type)).toEqual(['normal', 'normal', 'urgent']);
  });

  // Group + batch with 2 members. Each member has its own buffer; round-robin
  // delivery means each member sees exactly half the events.
  it('round-robins batched delivery across two group members', async () => {
    const cbA = vi.fn();
    const cbB = vi.fn();
    await pubsub.subscribe('topic-a', cbA, { group: 'g1', batch: { maxSize: 2 } });
    await pubsub.subscribe('topic-a', cbB, { group: 'g1', batch: { maxSize: 2 } });

    await pubsub.publish('topic-a', makeEvent({ type: '1' }));
    await pubsub.publish('topic-a', makeEvent({ type: '2' }));
    await pubsub.publish('topic-a', makeEvent({ type: '3' }));
    await pubsub.publish('topic-a', makeEvent({ type: '4' }));

    // Allow buffer microtasks to settle.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Round-robin: member A gets events 1 & 3, member B gets 2 & 4. Each
    // member's buffer (maxSize: 2) fires after its second event.
    expect(cbA).toHaveBeenCalledTimes(2);
    expect(cbB).toHaveBeenCalledTimes(2);
    expect(cbA.mock.calls.map(c => c[0].type)).toEqual(['1', '3']);
    expect(cbB.mock.calls.map(c => c[0].type)).toEqual(['2', '4']);
  });

  // Group with mixed batched/non-batched members: deliverToGroup routes
  // per-member, so each member's batch decision must be honored independently.
  it('delivers per-member batch policy when group has mixed batched/non-batched members', async () => {
    const cbBatched = vi.fn();
    const cbDirect = vi.fn();
    await pubsub.subscribe('topic-mixed', cbBatched, { group: 'g1', batch: { maxSize: 3 } });
    await pubsub.subscribe('topic-mixed', cbDirect, { group: 'g1' });

    // 6 events round-robin across 2 members -> 3 each.
    for (let i = 0; i < 6; i++) {
      await pubsub.publish('topic-mixed', makeEvent({ type: `e${i}` }));
    }
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Non-batched member receives each event as it arrives.
    expect(cbDirect).toHaveBeenCalledTimes(3);
    // Batched member's buffer fires only after the 3rd event hits maxSize.
    expect(cbBatched).toHaveBeenCalledTimes(3);
  });

  // flush() contract: every batch buffer must be drained and every cb must
  // settle before flush() resolves. A regression that fire-and-forgot the
  // drains would let flush() resolve while the cb was still running.
  it('flush() awaits all pending batched cb invocations before resolving', async () => {
    let release!: () => void;
    const gate = new Promise<void>(r => (release = r));
    const observed: string[] = [];
    const cb = vi.fn().mockImplementation(async (event: Event) => {
      observed.push(`start:${event.type}`);
      await gate;
      observed.push(`end:${event.type}`);
    });

    await pubsub.subscribe('topic-a', cb, { batch: { maxSize: 10, maxWaitMs: 60_000 } });

    await pubsub.publish('topic-a', makeEvent({ type: 'a' }));
    await pubsub.publish('topic-a', makeEvent({ type: 'b' }));
    await pubsub.publish('topic-a', makeEvent({ type: 'c' }));

    // Sanity: none of the events have flushed yet (well under maxSize).
    expect(cb).not.toHaveBeenCalled();

    let flushResolved = false;
    const flushPromise = pubsub.flush().then(() => {
      flushResolved = true;
    });

    // Let flush() start its drain and the first cb begin awaiting the gate.
    await Promise.resolve();
    await Promise.resolve();
    expect(flushResolved).toBe(false);
    expect(observed).toEqual(['start:a']);

    // Release the gate so each cb can finish in sequence.
    release();
    await flushPromise;

    expect(flushResolved).toBe(true);
    expect(cb).toHaveBeenCalledTimes(3);
    expect(observed).toEqual(['start:a', 'end:a', 'start:b', 'end:b', 'start:c', 'end:c']);
  });

  // EventEmitterPubSub.flush() uses Promise.allSettled when draining batch
  // buffers. Errors from non-cb paths (e.g. a throwing `coalesce`) propagate
  // out of AckHandleBuffer.flush as rejections. Surfacing requires either a
  // re-throw or a logger call — otherwise shutdown silently loses signals.
  it('surfaces non-cb buffer rejections during flush()', async () => {
    const error = vi.fn();
    const local = new EventEmitterPubSub(undefined, {
      logger: { error, warn: vi.fn(), info: vi.fn(), debug: vi.fn() } as any,
    });
    try {
      const cb = vi.fn();
      // A `coalesce` that throws will reject AckHandleBuffer.flush from the
      // policy.prepareBatch call, outside any per-event try/catch.
      await local.subscribe('topic-coalesce-throws', cb, {
        batch: {
          maxSize: 10,
          maxWaitMs: 60_000,
          coalesce: () => {
            throw new Error('coalesce blew up');
          },
        },
      });
      await local.publish('topic-coalesce-throws', makeEvent({ type: 'a' }));
      await local.flush();
      expect(error).toHaveBeenCalled();
      const message = error.mock.calls[0]?.[0];
      expect(typeof message).toBe('string');
    } finally {
      await local.close();
    }
  });

  // Regression guard: flush() drains batch buffers FIRST, then waits on
  // pendingNacks. If a batched cb nacks an event, the redelivery is queued
  // via setTimeout(..., 0) and lands in pendingNacks. flush() must wait
  // for that redelivery to land before resolving — otherwise callers using
  // flush() at run boundaries would miss the redelivered event.
  it('flush() awaits nack redeliveries triggered from inside a batched cb', async () => {
    const seen: string[] = [];
    let nacked = false;
    const cb = vi.fn().mockImplementation(async (event: Event, _ack, nack) => {
      seen.push(`${event.type}#${event.deliveryAttempt}`);
      if (event.type === 'a' && !nacked && nack) {
        nacked = true;
        await nack();
      }
    });

    await pubsub.subscribe('topic-nack-batched', cb, {
      group: 'g',
      batch: { maxSize: 2 },
    });

    await pubsub.publish('topic-nack-batched', makeEvent({ type: 'a' }));
    await pubsub.publish('topic-nack-batched', makeEvent({ type: 'b' }));
    // Both events are now in the batch buffer (maxSize=2 triggers flush).
    await pubsub.flush();

    // First pass delivered a (attempt 1, nacked) and b (attempt 1).
    // flush() must have waited for a's redelivery (attempt 2) before resolving.
    expect(seen).toEqual(['a#1', 'b#1', 'a#2']);
  });

  // Regression: the logger option exists on EventEmitterPubSub specifically so
  // batched-delivery errors are surfaced. If the wiring breaks (or the option
  // is dropped) the error would silently fall through to console.error.
  it('routes batched cb errors through the injected logger', async () => {
    const error = vi.fn();
    const local = new EventEmitterPubSub(undefined, {
      logger: { error, warn: vi.fn(), info: vi.fn(), debug: vi.fn() } as any,
    });
    try {
      const cb = vi.fn().mockRejectedValue(new Error('boom'));
      await local.subscribe('topic-logger', cb, { batch: { maxSize: 1 } });
      await local.publish('topic-logger', makeEvent({ type: 'x' }));
      await local.flush();
      expect(error).toHaveBeenCalled();
      const firstCallArgs = error.mock.calls[0];
      expect(firstCallArgs?.[0]).toEqual(expect.stringContaining('batched cb failed'));
    } finally {
      await local.close();
    }
  });

  // Regression: the fan-out path schedules `buffer.push` fire-and-forget
  // off the EventEmitter's synchronous emit. If push rejects (e.g. user
  // `coalesce` throws inside an inline flush-now), the rejection used to
  // escape as an UnhandledPromiseRejection. It must be surfaced through
  // the configured logger instead.
  it('surfaces buffer.push rejections through the logger (fan-out path)', async () => {
    const error = vi.fn();
    const local = new EventEmitterPubSub(undefined, {
      logger: { error, warn: vi.fn(), info: vi.fn(), debug: vi.fn() } as any,
    });
    try {
      const cb = vi.fn();
      await local.subscribe('topic-push-reject', cb, {
        batch: {
          maxSize: 1,
          // maxSize=1 forces flush-now on every push; a throwing coalesce
          // makes prepareBatch (and therefore push) reject.
          coalesce: () => {
            throw new Error('coalesce-boom');
          },
        },
      });

      await local.publish('topic-push-reject', makeEvent({ type: 'x' }));
      // Give the fire-and-forget catch a tick to log.
      await new Promise<void>(r => setImmediate(r));

      expect(error).toHaveBeenCalled();
      const firstCallArgs = error.mock.calls[0];
      expect(firstCallArgs?.[0]).toEqual(expect.stringContaining('batched cb failed'));
    } finally {
      await local.close();
    }
  });

  // Regression: the deadline timer (maxWaitMs) fires `flush()` fire-and-forget
  // from BatchPolicy.scheduleAt — the returned promise is discarded. A throwing
  // `coalesce` rejects that flush from prepareBatch, outside the per-event
  // try/catch. Unlike flush-now / explicit flush(), nothing awaits the timer
  // flush, so the rejection used to escape as an UnhandledPromiseRejection. It
  // must be routed through the configured logger instead.
  it('surfaces timer-triggered flush rejections through the logger (maxWaitMs path)', async () => {
    vi.useFakeTimers();
    const error = vi.fn();
    const local = new EventEmitterPubSub(undefined, {
      logger: { error, warn: vi.fn(), info: vi.fn(), debug: vi.fn() } as any,
    });
    try {
      const cb = vi.fn();
      // maxWaitMs with no maxSize: the publish only schedules the deadline
      // timer (onEnqueue returns 'wait'), so the flush is purely timer-driven.
      await local.subscribe('topic-timer-reject', cb, {
        batch: {
          maxWaitMs: 100,
          coalesce: () => {
            throw new Error('coalesce-timer-boom');
          },
        },
      });

      await local.publish('topic-timer-reject', makeEvent({ type: 'x' }));
      expect(error).not.toHaveBeenCalled();

      // Fire the deadline timer — this triggers the rejecting flush.
      await vi.advanceTimersByTimeAsync(100);

      expect(cb).not.toHaveBeenCalled();
      expect(error).toHaveBeenCalled();
      const firstCallArgs = error.mock.calls[0];
      expect(firstCallArgs?.[0]).toEqual(expect.stringContaining('batched cb failed'));
    } finally {
      await local.close();
    }
  });
});
