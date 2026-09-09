import type { EventCallback } from '@mastra/core/events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RedisStreamsPubSub } from './index';

const clients = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('redis', () => ({ createClient: clients.create }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
const entries = Array.from({ length: 10 }, (_, i) => ({
  id: `${i + 1}-0`,
  message: { event: JSON.stringify({ id: String(i), type: 'test', data: {}, runId: 'run' }) },
}));
type ReadReply = { name: string; messages: typeof entries }[] | null;

describe('unsubscribe acquired batches', () => {
  let ps: RedisStreamsPubSub;
  let read: ReturnType<typeof deferred<ReadReply>>;
  let claim: ReturnType<typeof deferred<{ messages: ((typeof entries)[number] | null)[] }>>;
  let writer: {
    isOpen: boolean;
    on: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
    quit: ReturnType<typeof vi.fn>;
    xGroupCreate: ReturnType<typeof vi.fn>;
    xGroupDestroy: ReturnType<typeof vi.fn>;
    xAutoClaim: ReturnType<typeof vi.fn>;
  };
  let reader: {
    on: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
    quit: ReturnType<typeof vi.fn>;
    xReadGroup: ReturnType<typeof vi.fn>;
  };
  beforeEach(() => {
    vi.useFakeTimers();
    read = deferred<ReadReply>();
    claim = deferred<{ messages: ((typeof entries)[number] | null)[] }>();
    writer = {
      isOpen: true,
      on: vi.fn(),
      connect: vi.fn(),
      quit: vi.fn(),
      xGroupCreate: vi.fn(),
      xGroupDestroy: vi.fn(),
      xAutoClaim: vi.fn(() => claim.promise),
    };
    reader = { on: vi.fn(), connect: vi.fn(), quit: vi.fn(), xReadGroup: vi.fn(() => read.promise) };
    clients.create.mockReset().mockReturnValueOnce(writer).mockReturnValueOnce(reader);
    ps = new RedisStreamsPubSub({ reclaimIntervalMs: 10 });
  });
  afterEach(async () => {
    read.resolve(null);
    claim.resolve({ messages: [] });
    await ps.close();
    vi.useRealTimers();
  });

  it.each([true, false])('drains the read batch with grouped=%s without awaiting callbacks', async grouped => {
    const delivered: string[] = [];
    const stopped = deferred<void>();
    const callbackGate = deferred<void>();
    const cb: EventCallback = async event => {
      delivered.push(event.id);
      if (delivered.length === 1) {
        await ps.unsubscribe('topic', cb);
        stopped.resolve();
      } else await callbackGate.promise;
    };
    try {
      await ps.subscribe('topic', cb, grouped ? { group: 'workers' } : undefined);
      read.resolve([{ name: 'topic', messages: entries }]);
      await stopped.promise;
      expect(delivered).toEqual(entries.map((_, i) => String(i)));
      expect(reader.xReadGroup).toHaveBeenCalledTimes(1);
      expect(writer.xGroupDestroy).toHaveBeenCalledTimes(grouped ? 0 : 1);
    } finally {
      callbackGate.resolve();
    }
  });

  it('joins a read reply returned after stop, including overlapping close and unsubscribe', async () => {
    const cb = vi.fn();
    await ps.subscribe('topic', cb);
    const stop = ps.unsubscribe('topic', cb);
    let secondStopFinished = false;
    const secondStop = ps.unsubscribe('topic', cb).then(() => {
      secondStopFinished = true;
    });
    const close = ps.close();
    await vi.advanceTimersByTimeAsync(0);
    expect(secondStopFinished).toBe(false);
    expect(writer.quit).not.toHaveBeenCalled();
    read.resolve([{ name: 'topic', messages: entries }]);
    await Promise.all([stop, secondStop, close]);
    expect(cb).toHaveBeenCalledTimes(10);
    expect(writer.xGroupDestroy.mock.invocationCallOrder[0]).toBeGreaterThan(cb.mock.invocationCallOrder[9]!);
    expect(writer.quit.mock.invocationCallOrder[0]).toBeGreaterThan(writer.xGroupDestroy.mock.invocationCallOrder[0]!);
  });

  it.each(['unsubscribe', 'close', 'before-reply'] as const)('drains an active claim on %s', async mode => {
    const delivered: string[] = [];
    let stop: Promise<void> | undefined;
    const cb: EventCallback = event => {
      delivered.push(event.id);
      if (delivered.length === 1 && mode !== 'before-reply') {
        stop = mode === 'close' ? ps.close() : ps.unsubscribe('topic', cb);
        read.resolve(null);
      }
    };
    await ps.subscribe('topic', cb, { group: 'workers' });
    await vi.advanceTimersByTimeAsync(10);
    expect(writer.xAutoClaim).toHaveBeenCalledTimes(1);
    if (mode === 'before-reply') {
      stop = Promise.all([ps.unsubscribe('topic', cb), ps.close()]).then(() => {});
      read.resolve(null);
      let finished = false;
      void stop.then(() => {
        finished = true;
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(finished).toBe(false);
      expect(writer.quit).not.toHaveBeenCalled();
    }
    claim.resolve({ messages: [null, ...entries] });
    await vi.advanceTimersByTimeAsync(0);
    await stop;
    expect(delivered).toHaveLength(10);
    await vi.advanceTimersByTimeAsync(100);
    expect(writer.xAutoClaim).toHaveBeenCalledTimes(1);
    expect(writer.xGroupDestroy).not.toHaveBeenCalled();
  });

  it('joins a failed in-flight claim without rescheduling', async () => {
    const cb = vi.fn();
    await ps.subscribe('topic', cb, { group: 'workers' });
    await vi.advanceTimersByTimeAsync(10);
    const stop = ps.unsubscribe('topic', cb);
    read.resolve(null);
    claim.reject(new Error('connection lost'));
    await stop;
    await vi.advanceTimersByTimeAsync(100);
    expect(writer.xAutoClaim).toHaveBeenCalledTimes(1);
    expect(cb).not.toHaveBeenCalled();
  });
});
