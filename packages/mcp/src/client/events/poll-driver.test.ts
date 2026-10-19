import { MastraError } from '@mastra/core/error';
import { ProtocolError } from '@modelcontextprotocol/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENTS_ERROR_CODES } from '../../shared/events';
import { FakePort, occurrence, pollResult } from './__fixtures__/fake-port';
import { pollDriver } from './poll-driver';
import { EventSubscription } from './subscription';
import type { MCPEventSubscribeOptions } from './types';

function start(port: FakePort, options: MCPEventSubscribeOptions = {}, args?: Record<string, unknown>) {
  return EventSubscription.start({
    port,
    serverName: 'srv',
    name: 'test.event',
    arguments: args,
    driver: pollDriver,
    options,
    defaultStreamOpenTimeoutMs: 1000,
    random: () => 1,
  });
}

describe('poll delivery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('bootstraps with a null cursor and forwards arguments, maxAgeMs and maxEvents', async () => {
    const port = new FakePort().queuePoll(pollResult({ cursor: 'c1' }));
    const sub = await start(port, { maxAgeMs: 5000, maxEvents: 10 }, { repo: 'a' });

    expect(port.pollCalls[0]).toEqual({
      name: 'test.event',
      arguments: { repo: 'a' },
      cursor: null,
      maxAgeMs: 5000,
      maxEvents: 10,
    });
    expect(sub.mode).toBe('poll');
    expect(sub.cursor).toBe('c1');
    await sub.cancel();
  });

  it('resumes from a caller-supplied cursor', async () => {
    const port = new FakePort().queuePoll(pollResult({ cursor: 'c2' }));
    const sub = await start(port, { cursor: 'saved' });
    expect(port.pollCalls[0]!.cursor).toBe('saved');
    await sub.cancel();
  });

  it('applies the minPollIntervalMs floor to small and absent nextPollMs, and honors larger ones', async () => {
    const port = new FakePort().queuePoll(
      pollResult({ cursor: 'a', nextPollMs: 10 }),
      pollResult({ cursor: 'b' }),
      pollResult({ cursor: 'c', nextPollMs: 5000 }),
      pollResult({ cursor: 'd' }),
    );
    const sub = await start(port);
    expect(port.pollCalls).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(port.pollCalls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(port.pollCalls).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(port.pollCalls).toHaveLength(3);

    await vi.advanceTimersByTimeAsync(4999);
    expect(port.pollCalls).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(port.pollCalls).toHaveLength(4);
    expect(port.pollCalls.map(call => call.cursor)).toEqual([null, 'a', 'b', 'c']);
    await sub.cancel();
  });

  it('drains hasMore pages without waiting', async () => {
    const port = new FakePort().queuePoll(
      pollResult({ events: [occurrence('e1')], cursor: 'a', hasMore: true, nextPollMs: 60_000 }),
      pollResult({ events: [occurrence('e2')], cursor: 'b', hasMore: true }),
      pollResult({ events: [occurrence('e3')], cursor: 'c' }),
    );
    const sub = await start(port);
    await vi.advanceTimersByTimeAsync(0);
    expect(port.pollCalls.map(call => call.cursor)).toEqual([null, 'a', 'b']);

    const iterator = sub[Symbol.asyncIterator]();
    const ids = [];
    for (let i = 0; i < 3; i++) ids.push((await iterator.next()).value.eventId);
    expect(ids).toEqual(['e1', 'e2', 'e3']);
    await sub.cancel();
  });

  it('never replays a null cursor: later polls send null after the server stops offering replay', async () => {
    const port = new FakePort().queuePoll(
      pollResult({ cursor: 'a' }),
      pollResult({ cursor: null }),
      pollResult({ cursor: null }),
    );
    const sub = await start(port, { minPollIntervalMs: 100 });
    expect(sub.cursor).toBe('a');
    await vi.advanceTimersByTimeAsync(100);
    expect(sub.cursor).toBeNull();
    await vi.advanceTimersByTimeAsync(100);
    expect(port.pollCalls.map(call => call.cursor)).toEqual([null, 'a', null]);
    await sub.cancel();
  });

  it('de-duplicates by eventId across polls and forgets ids outside the window', async () => {
    const port = new FakePort().queuePoll(
      pollResult({ events: [occurrence('e1'), occurrence('e2')], cursor: 'a', hasMore: true }),
      pollResult({ events: [occurrence('e2'), occurrence('e3')], cursor: 'b', hasMore: true }),
      // With a window of 2, e1 has been evicted by now and is delivered again.
      pollResult({ events: [occurrence('e3'), occurrence('e1')], cursor: 'c' }),
    );
    const sub = await start(port, { dedupWindow: 2 });
    await vi.advanceTimersByTimeAsync(0);

    const iterator = sub[Symbol.asyncIterator]();
    const ids = [];
    for (let i = 0; i < 4; i++) ids.push((await iterator.next()).value.eventId);
    expect(ids).toEqual(['e1', 'e2', 'e3', 'e1']);
    await sub.cancel();
  });

  it('keeps a reported gap until the first occurrence after it is yielded', async () => {
    const port = new FakePort().queuePoll(
      pollResult({ cursor: 'a', truncated: true }),
      // The gap must survive empty polls that report no gap.
      pollResult({ cursor: 'b' }),
      pollResult({ events: [occurrence('e1'), occurrence('e2')], cursor: 'c' }),
    );
    const sub = await start(port);
    expect(sub.truncated).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(sub.truncated).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);

    const iterator = sub[Symbol.asyncIterator]();
    expect((await iterator.next()).value.eventId).toBe('e1');
    expect(sub.truncated).toBe(true);
    expect((await iterator.next()).value.eventId).toBe('e2');
    expect(sub.truncated).toBe(false);
    await sub.cancel();
  });

  it('flags the events of a truncated page, not the events of the next page', async () => {
    const port = new FakePort().queuePoll(
      pollResult({ cursor: 'a' }),
      pollResult({ events: [occurrence('e1')], cursor: 'b', truncated: true }),
      pollResult({ events: [occurrence('e2')], cursor: 'c' }),
    );
    const sub = await start(port);
    const iterator = sub[Symbol.asyncIterator]();
    await vi.advanceTimersByTimeAsync(1000);
    expect((await iterator.next()).value.eventId).toBe('e1');
    expect(sub.truncated).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect((await iterator.next()).value.eventId).toBe('e2');
    expect(sub.truncated).toBe(false);
    await sub.cancel();
  });

  it('does not move cursor past a buffered batch until its last occurrence is yielded', async () => {
    const port = new FakePort().queuePoll(
      pollResult({ cursor: 'a' }),
      pollResult({ events: [occurrence('e1'), occurrence('e2')], cursor: 'b' }),
      pollResult({ cursor: 'c' }),
    );
    const sub = await start(port);
    expect(sub.cursor).toBe('a');

    await vi.advanceTimersByTimeAsync(1000);
    // The batch is buffered: the next poll already resumes from 'b', but the public cursor waits.
    expect(sub.cursor).toBe('a');

    const iterator = sub[Symbol.asyncIterator]();
    await iterator.next();
    expect(sub.cursor).toBe('a');
    await iterator.next();
    expect(sub.cursor).toBe('b');

    await vi.advanceTimersByTimeAsync(1000);
    expect(port.pollCalls.map(call => call.cursor)).toEqual([null, 'a', 'b']);
    expect(sub.cursor).toBe('c');
    await sub.cancel();
  });

  it('defers a later empty poll cursor behind still-buffered occurrences', async () => {
    const port = new FakePort().queuePoll(
      pollResult({ events: [occurrence('e1')], cursor: 'a' }),
      pollResult({ cursor: 'b' }),
    );
    const sub = await start(port);
    await vi.advanceTimersByTimeAsync(1000);
    expect(port.pollCalls).toHaveLength(2);
    expect(sub.cursor).toBeNull();
    await sub[Symbol.asyncIterator]().next();
    expect(sub.cursor).toBe('b');
    await sub.cancel();
  });

  it('backs off on transient errors, reports them, and resumes from the same cursor', async () => {
    const port = new FakePort().queuePoll(
      pollResult({ cursor: 'a' }),
      new Error('network down'),
      new Error('still down'),
      pollResult({ events: [occurrence('e1')], cursor: 'b' }),
    );
    const sub = await start(port, { minPollIntervalMs: 100 });
    const errors: MastraError[] = [];
    sub.onError(error => errors.push(error));

    await vi.advanceTimersByTimeAsync(100); // second poll fails
    expect(errors.map(error => error.id)).toEqual(['MCP_EVENTS_DELIVERY_INTERRUPTED']);

    await vi.advanceTimersByTimeAsync(999); // first backoff is 1000ms (random pinned to 1)
    expect(port.pollCalls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1); // third poll fails
    expect(port.pollCalls).toHaveLength(3);
    expect(errors).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(1999); // second backoff is 2000ms
    expect(port.pollCalls).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(port.pollCalls.map(call => call.cursor)).toEqual([null, 'a', 'a', 'a']);
    expect(port.ensureConnected).toHaveBeenCalledTimes(2);
    expect((await sub[Symbol.asyncIterator]().next()).value.eventId).toBe('e1');
    expect(sub.cursor).toBe('b');
    await sub.cancel();
  });

  it.each([
    ['InvalidParams', EVENTS_ERROR_CODES.InvalidParams],
    ['NotFound', EVENTS_ERROR_CODES.NotFound],
    ['Forbidden', EVENTS_ERROR_CODES.Forbidden],
    ['Unsupported', EVENTS_ERROR_CODES.Unsupported],
  ])('fails fast on %s when subscribing', async (_label, code) => {
    const port = new FakePort().queuePoll(new ProtocolError(code, 'nope'));
    const error = await start(port).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MastraError);
    expect(error).toMatchObject({ id: 'MCP_EVENTS_SUBSCRIPTION_FAILED', details: { code } });
    expect(port.pollCalls).toHaveLength(1);
  });

  it.each([
    ['InvalidParams', EVENTS_ERROR_CODES.InvalidParams],
    ['NotFound', EVENTS_ERROR_CODES.NotFound],
    ['Forbidden', EVENTS_ERROR_CODES.Forbidden],
    ['Unsupported', EVENTS_ERROR_CODES.Unsupported],
  ])('ends the iterator on %s after the subscription was established', async (_label, code) => {
    const port = new FakePort().queuePoll(
      pollResult({ events: [occurrence('e1')], cursor: 'a' }),
      new ProtocolError(code, 'removed'),
    );
    const sub = await start(port);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(port.pollCalls).toHaveLength(2);

    const iterator = sub[Symbol.asyncIterator]();
    expect((await iterator.next()).value.eventId).toBe('e1');
    await expect(iterator.next()).rejects.toMatchObject({ id: 'MCP_EVENTS_SUBSCRIPTION_FAILED', details: { code } });
    expect(await iterator.next()).toEqual({ value: undefined, done: true });
  });

  it('gives up after retry.maxAttempts consecutive failures', async () => {
    const port = new FakePort().queuePoll(pollResult({ cursor: 'a' }), new Error('x'), new Error('y'), new Error('z'));
    const sub = await start(port, { minPollIntervalMs: 100, retry: { maxAttempts: 2, initialDelayMs: 10 } });
    await vi.advanceTimersByTimeAsync(100); // attempt 1 fails
    await vi.advanceTimersByTimeAsync(10); // attempt 2 fails
    expect(port.pollCalls).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(20); // attempt 3 fails: over the limit
    expect(port.pollCalls).toHaveLength(4);
    await expect(sub[Symbol.asyncIterator]().next()).rejects.toMatchObject({ id: 'MCP_EVENTS_RETRIES_EXHAUSTED' });
  });
});
