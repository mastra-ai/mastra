import type { Event, EventCallback } from '@mastra/core/events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RedisStreamsPubSub } from './index';

const clients = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('redis', () => ({ createClient: clients.create }));

describe('local-only redelivery', () => {
  let ps: RedisStreamsPubSub;
  let stopRead: () => void;
  let xAdd: ReturnType<typeof vi.fn>;
  let xGroupCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    const stops: (() => void)[] = [];
    stopRead = () => stops.forEach(stop => stop());
    xAdd = vi.fn();
    xGroupCreate = vi.fn();
    const writer = {
      on: vi.fn(),
      connect: vi.fn(),
      quit: vi.fn(),
      isOpen: true,
      xGroupCreate,
      xGroupDestroy: vi.fn(),
      xAdd,
      duplicate: vi.fn(() => {
        let stop!: () => void;
        const read = new Promise<null>(resolve => {
          stop = () => resolve(null);
        });
        stops.push(stop);
        return { on: vi.fn(), connect: vi.fn(), quit: vi.fn(stop), xReadGroup: vi.fn(() => read) };
      }),
    };
    clients.create.mockReset().mockReturnValue(writer);
    ps = new RedisStreamsPubSub({ reclaimIntervalMs: 0 });
  });

  afterEach(async () => {
    stopRead();
    await ps.close();
    vi.useRealTimers();
  });

  const publish = (pubsub: RedisStreamsPubSub, data = {}) =>
    pubsub.publish('topic', { type: 'test', runId: 'run', data }, { localOnly: true });

  it('backs off only the failed callback, preserving identity and live payloads', async () => {
    class Payload {
      value() {
        return 'live';
      }
    }
    const payload = new Payload();
    const seen: Event[] = [];
    const cb: EventCallback = async (event, ack, nack) => {
      seen.push(event);
      if (seen.length < 3) await nack!();
      else await ack!();
    };
    const other = vi.fn(async (_event, ack) => ack());
    await ps.subscribe('topic', cb, { group: 'retry' });
    await ps.subscribe('topic', other, { group: 'other' });
    await publish(ps, payload);
    await vi.advanceTimersByTimeAsync(999);
    expect(seen).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(seen).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1999);
    expect(seen).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(seen.map(e => e.deliveryAttempt)).toEqual([1, 2, 3]);
    for (const event of seen) {
      expect(event.id).toBe(seen[0]!.id);
      expect(event.createdAt).toBe(seen[0]!.createdAt);
      expect(event.data).toBe(payload);
      expect(event.data).toBeInstanceOf(Payload);
    }
    expect(other).toHaveBeenCalledTimes(1);
    expect(other.mock.calls[0]![0].deliveryAttempt).toBe(1);
    expect(xAdd).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60000);
    expect(seen).toHaveLength(3);
  });

  it.each(['throw', 'reject'])('retries callback %s', async mode => {
    const cb = vi.fn(() => {
      if (mode === 'throw') throw new Error('transient');
      return Promise.reject(new Error('transient'));
    });
    await ps.subscribe('topic', cb);
    await publish(ps);
    await vi.advanceTimersByTimeAsync(1000);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it.each(['ack-nack', 'nack-ack', 'nack-nack', 'ack-throw', 'nack-reject'])('settles once for %s', async mode => {
    const cb: EventCallback = vi.fn(async (_event, ack, nack) => {
      if (mode.startsWith('ack')) await ack!();
      else await nack!();
      if (mode.endsWith('nack')) await nack!();
      if (mode.endsWith('ack') && mode !== 'nack-nack') await ack!();
      if (mode.endsWith('throw') || mode.endsWith('reject')) throw new Error('after settlement');
    });
    await ps.subscribe('topic', cb);
    await publish(ps);
    await vi.advanceTimersByTimeAsync(1000);
    expect(cb).toHaveBeenCalledTimes(mode.startsWith('ack') ? 1 : 2);
  });

  it('cancels local retries and removes the registration when subscribe fails', async () => {
    let reject!: (error: Error) => void;
    xGroupCreate.mockReturnValueOnce(
      new Promise<void>((_resolve, rejectPromise) => {
        reject = rejectPromise;
      }),
    );
    const cb = vi.fn<EventCallback>(async (_event, _ack, nack) => nack!());
    const subscribing = ps.subscribe('topic', cb, { group: 'retry' });
    const failed = expect(subscribing).rejects.toThrow('connection lost');
    await publish(ps);
    expect(vi.getTimerCount()).toBe(1);
    reject(new Error('connection lost'));
    await failed;
    expect(vi.getTimerCount()).toBe(0);
    await publish(ps);
    await vi.advanceTimersByTimeAsync(1000);
    expect(cb).toHaveBeenCalledTimes(1);
    await ps.subscribe('topic', cb, { group: 'retry' });
    await publish(ps);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('cancels all concurrent event retries for a registration', async () => {
    const cb = vi.fn<EventCallback>(async (_event, _ack, nack) => nack!());
    await ps.subscribe('topic', cb);
    await publish(ps);
    await publish(ps);
    expect(vi.getTimerCount()).toBe(2);
    stopRead();
    await ps.unsubscribe('topic', cb);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it.each([1, 3, 0])('honors maxDeliveryAttempts=%s and caps the delay', async cap => {
    await ps.close();
    ps = new RedisStreamsPubSub({ maxDeliveryAttempts: cap, reclaimIntervalMs: 0 });
    const cb = vi.fn(async (_event, _ack, nack) => nack());
    await ps.subscribe('topic', cb);
    await publish(ps);
    await vi.advanceTimersByTimeAsync(1000 + 2000 + 4000 + 8000 + 16000);
    expect(cb).toHaveBeenCalledTimes(cap || 6);
    await vi.advanceTimersByTimeAsync(29999);
    expect(cb).toHaveBeenCalledTimes(cap || 6);
    await vi.advanceTimersByTimeAsync(1);
    expect(cb).toHaveBeenCalledTimes(cap || 7);
  });

  it.each(['close', 'unsubscribe'])('cancels pending retries on %s', async action => {
    const cb = vi.fn(async (_event, _ack, nack) => nack());
    await ps.subscribe('topic', cb);
    await publish(ps);
    const closing = action === 'close' ? ps.close() : ps.unsubscribe('topic', cb);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(60000);
    expect(cb).toHaveBeenCalledTimes(1);
    stopRead();
    await closing;
  });

  it.each(['close', 'unsubscribe', 'resubscribe'])('ignores a late rejection after %s', async action => {
    let reject!: (error: Error) => void;
    const cb = vi.fn(
      () =>
        new Promise<void>((_resolve, fail) => {
          reject = fail;
        }),
    );
    await ps.subscribe('topic', cb);
    await publish(ps);
    stopRead();
    if (action === 'close') await ps.close();
    else await ps.unsubscribe('topic', cb);
    if (action === 'resubscribe') await ps.subscribe('topic', cb);
    reject(new Error('late failure'));
    await vi.advanceTimersByTimeAsync(60000);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['close', 'unsubscribe', 'resubscribe'])('ignores a late nack after %s', async action => {
    let lateNack!: () => Promise<void>;
    const cb = vi.fn((_event, _ack, nack) => {
      lateNack = nack;
    });
    await ps.subscribe('topic', cb);
    await publish(ps);
    stopRead();
    if (action === 'close') await ps.close();
    else await ps.unsubscribe('topic', cb);
    if (action === 'resubscribe') await ps.subscribe('topic', cb);
    await lateNack();
    await vi.advanceTimersByTimeAsync(60000);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
