import type { MastraError } from '@mastra/core/error';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakePort, occurrence, pollResult } from './__fixtures__/fake-port';
import { selectDeliveryMode } from './mode';
import { pollDriver } from './poll-driver';
import { pushDriver } from './push-driver';
import { EventSubscription } from './subscription';
import type { EventSubscriptionConfig } from './subscription';

function startPoll(port: FakePort, overrides: Partial<EventSubscriptionConfig> = {}) {
  return EventSubscription.start({
    port,
    serverName: 'srv',
    name: 'test.event',
    driver: pollDriver,
    defaultStreamOpenTimeoutMs: 1000,
    random: () => 1,
    ...overrides,
  });
}

describe('EventSubscription', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('cancel() ends a pending iteration with done and stops polling', async () => {
    const port = new FakePort().queuePoll(pollResult({ cursor: 'a' }));
    const onClose = vi.fn();
    const sub = await startPoll(port, { onClose });
    const pending = sub[Symbol.asyncIterator]().next();

    await sub.cancel();
    await expect(pending).resolves.toEqual({ value: undefined, done: true });
    expect(onClose).toHaveBeenCalledWith(sub);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(port.pollCalls).toHaveLength(1);
  });

  it('still yields occurrences buffered before cancel', async () => {
    const port = new FakePort().queuePoll(pollResult({ events: [occurrence('e1')], cursor: 'a' }));
    const sub = await startPoll(port);
    await sub.cancel();
    const iterator = sub[Symbol.asyncIterator]();
    expect((await iterator.next()).value.eventId).toBe('e1');
    expect((await iterator.next()).done).toBe(true);
  });

  it('aborting options.signal cancels the subscription and the in-flight request', async () => {
    const port = new FakePort();
    const controller = new AbortController();
    const pending = EventSubscription.start({
      port,
      serverName: 'srv',
      name: 'test.event',
      driver: pushDriver,
      options: { signal: controller.signal },
      defaultStreamOpenTimeoutMs: 1000,
    });
    await vi.advanceTimersByTimeAsync(0);
    port.lastStream.confirm();
    const sub = await pending;
    const next = sub[Symbol.asyncIterator]().next();

    controller.abort();
    await expect(next).resolves.toEqual({ value: undefined, done: true });
    expect(port.lastStream.aborted).toBe(true);
  });

  it('rejects start when the signal is already aborted', async () => {
    const port = new FakePort();
    const controller = new AbortController();
    controller.abort();
    await expect(startPoll(port, { options: { signal: controller.signal } })).rejects.toMatchObject({
      id: 'MCP_EVENTS_SUBSCRIPTION_CANCELLED',
    });
    expect(port.pollCalls).toHaveLength(0);
  });

  it('leaving a for-await loop early cancels the subscription', async () => {
    const port = new FakePort().queuePoll(pollResult({ events: [occurrence('e1'), occurrence('e2')], cursor: 'a' }));
    const sub = await startPoll(port);
    for await (const event of sub) {
      expect(event.eventId).toBe('e1');
      break;
    }
    await vi.advanceTimersByTimeAsync(60_000);
    expect(port.pollCalls).toHaveLength(1);
  });

  it('onReconnected() cuts a backoff wait short', async () => {
    const port = new FakePort().queuePoll(
      pollResult({ cursor: 'a' }),
      new Error('connection closed'),
      pollResult({ cursor: 'b' }),
    );
    const sub = await startPoll(port, { options: { minPollIntervalMs: 100, retry: { initialDelayMs: 30_000 } } });
    sub.onError(() => {});
    await vi.advanceTimersByTimeAsync(100);
    expect(port.pollCalls).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(port.pollCalls).toHaveLength(2);
    sub.onReconnected();
    await vi.advanceTimersByTimeAsync(0);
    expect(port.pollCalls).toHaveLength(3);
    expect(port.pollCalls[2]!.cursor).toBe('a');
    await sub.cancel();
  });

  it('keeps the default backoff when a retry field is passed as undefined', async () => {
    const port = new FakePort().queuePoll(
      pollResult({ cursor: 'a' }),
      new Error('connection closed'),
      pollResult({ cursor: 'b' }),
    );
    const sub = await startPoll(port, {
      options: { minPollIntervalMs: 100, retry: { initialDelayMs: undefined, maxAttempts: undefined } },
    });
    sub.onError(() => {});
    await vi.advanceTimersByTimeAsync(100);
    expect(port.pollCalls).toHaveLength(2);

    // The default initial delay is 1000 ms (random() is 1 here), not a ~1 ms NaN timeout.
    await vi.advanceTimersByTimeAsync(500);
    expect(port.pollCalls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(500);
    expect(port.pollCalls).toHaveLength(3);
    await sub.cancel();
  });

  it("removes its abort listener from the caller's signal when it ends", async () => {
    const port = new FakePort().queuePoll(pollResult({ cursor: 'a' }));
    const controller = new AbortController();
    const added = vi.spyOn(controller.signal, 'addEventListener');
    const removed = vi.spyOn(controller.signal, 'removeEventListener');
    const sub = await startPoll(port, { options: { signal: controller.signal } });
    expect(added).toHaveBeenCalledWith('abort', expect.any(Function), { once: true });

    await sub.cancel();
    expect(removed).toHaveBeenCalledWith('abort', added.mock.calls[0]![1]);
  });

  it('onError returns an unsubscribe function, and errors without a handler are logged', async () => {
    const port = new FakePort().queuePoll(pollResult({ cursor: 'a' }), new Error('one'), new Error('two'));
    const sub = await startPoll(port, { options: { minPollIntervalMs: 100, retry: { initialDelayMs: 10 } } });
    const errors: MastraError[] = [];
    const off = sub.onError(error => errors.push(error));

    await vi.advanceTimersByTimeAsync(100);
    expect(errors).toHaveLength(1);
    off();
    await vi.advanceTimersByTimeAsync(10);
    expect(errors).toHaveLength(1);
    expect(port.log).toHaveBeenCalledWith(
      'warning',
      expect.stringContaining('two'),
      expect.objectContaining({ id: 'MCP_EVENTS_DELIVERY_INTERRUPTED' }),
    );
    await sub.cancel();
  });
});

describe('EventSubscription buffer bound', () => {
  it('drops the oldest unread occurrences past maxBufferedEvents, flags the next one and reports once', async () => {
    const port = new FakePort();
    const pending = EventSubscription.start({
      port,
      serverName: 'srv',
      name: 'test.event',
      driver: pushDriver,
      options: { maxBufferedEvents: 3 },
      defaultStreamOpenTimeoutMs: 1000,
      random: () => 1,
    });
    await vi.waitFor(() => expect(port.streams).toHaveLength(1));
    port.lastStream.confirm({ cursor: 'c0' });
    const sub = await pending;
    const errors: MastraError[] = [];
    sub.onError(error => errors.push(error));
    // A server floods the stream while nobody reads.
    for (let i = 1; i <= 10; i++) port.lastStream.event(`e${i}`, `c${i}`);

    const iterator = sub[Symbol.asyncIterator]();
    const read: Array<[string, boolean]> = [];
    for (let i = 0; i < 3; i++) {
      const { value } = await iterator.next();
      read.push([value.eventId, sub.truncated]);
    }
    expect(read).toEqual([
      ['e8', true],
      ['e9', false],
      ['e10', false],
    ]);
    expect(sub.cursor).toBe('c10');
    expect(errors.map(error => error.id)).toEqual(['MCP_EVENTS_BUFFER_OVERFLOW']);

    // Catching up re-arms the report for the next overflow.
    for (let i = 11; i <= 15; i++) port.lastStream.event(`e${i}`, `c${i}`);
    expect(errors).toHaveLength(2);
    await sub.cancel();
  });
});

describe('selectDeliveryMode', () => {
  const details = { serverName: 'srv', eventName: 'e' };

  it('prefers push over poll', () => {
    expect(selectDeliveryMode(['poll', 'push'], undefined, details)).toBe('push');
    expect(selectDeliveryMode(['poll'], undefined, details)).toBe('poll');
  });

  it('ignores modes it does not know', () => {
    expect(selectDeliveryMode(['carrier-pigeon', 'poll'], undefined, details)).toBe('poll');
    expect(() => selectDeliveryMode(['webhook', 'carrier-pigeon'], undefined, details)).toThrow(
      expect.objectContaining({ id: 'MCP_EVENTS_NO_COMPATIBLE_DELIVERY_MODE' }),
    );
  });

  it('honors a forced mode only when it is offered', () => {
    expect(selectDeliveryMode(['poll', 'push'], 'poll', details)).toBe('poll');
    expect(() => selectDeliveryMode(['poll'], 'push', details)).toThrow(
      expect.objectContaining({ id: 'MCP_EVENTS_NO_COMPATIBLE_DELIVERY_MODE' }),
    );
  });
});
