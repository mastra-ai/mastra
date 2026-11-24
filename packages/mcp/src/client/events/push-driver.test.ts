import type { MastraError } from '@mastra/core/error';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENTS_ERROR_CODES } from '../../shared/events';
import { FakePort } from './__fixtures__/fake-port';
import { pushDriver } from './push-driver';
import { EventSubscription } from './subscription';
import type { MCPEventSubscribeOptions } from './types';

async function start(port: FakePort, options: MCPEventSubscribeOptions = {}, random = () => 0) {
  const started = EventSubscription.start({
    port,
    serverName: 'srv',
    name: 'test.event',
    arguments: { repo: 'a' },
    driver: pushDriver,
    options: { heartbeatTimeoutMs: 1000, ...options },
    defaultStreamOpenTimeoutMs: 1000,
    random,
  });
  await vi.advanceTimersByTimeAsync(0);
  return started;
}

function collectErrors(sub: EventSubscription) {
  const errors: MastraError[] = [];
  sub.onError(error => errors.push(error));
  return errors;
}

describe('push delivery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens one stream with the subscription parameters and resolves once confirmed', async () => {
    const port = new FakePort();
    const pending = start(port, { cursor: 'saved', maxAgeMs: 500 });
    await vi.advanceTimersByTimeAsync(0);
    expect(port.streams).toHaveLength(1);
    expect(port.lastStream.params).toEqual({
      name: 'test.event',
      arguments: { repo: 'a' },
      cursor: 'saved',
      maxAgeMs: 500,
    });

    port.lastStream.confirm({ cursor: 'c0', truncated: true });
    const sub = await pending;
    expect(sub.mode).toBe('push');
    expect(sub.cursor).toBe('c0');
    expect(sub.truncated).toBe(true);
    await sub.cancel();
  });

  it('flags only the first occurrence after a gap', async () => {
    const port = new FakePort();
    const pending = start(port, { cursor: 'saved' });
    await vi.advanceTimersByTimeAsync(0);
    port.lastStream.confirm({ cursor: 'c0', truncated: true });
    const sub = await pending;
    const iterator = sub[Symbol.asyncIterator]();
    port.lastStream.event('e1', 'c1');
    port.lastStream.event('e2', 'c2');
    expect((await iterator.next()).value.eventId).toBe('e1');
    expect(sub.truncated).toBe(true);
    expect((await iterator.next()).value.eventId).toBe('e2');
    expect(sub.truncated).toBe(false);
    await sub.cancel();
  });

  it('delivers occurrences without the routing meta and advances the cursor per occurrence', async () => {
    const port = new FakePort();
    const pending = start(port);
    await vi.advanceTimersByTimeAsync(0);
    port.lastStream.confirm({ cursor: 'c0' });
    const sub = await pending;
    const iterator = sub[Symbol.asyncIterator]();

    port.lastStream.event('e1', 'c1', { n: 1 });
    port.lastStream.event('e1', 'c1', { n: 1 }); // duplicate
    port.lastStream.event('e2', 'c2', { n: 2 });
    expect(sub.cursor).toBe('c0');

    const first = (await iterator.next()).value;
    expect(first).toEqual({
      eventId: 'e1',
      name: 'test.event',
      timestamp: new Date(0).toISOString(),
      data: { n: 1 },
      cursor: 'c1',
    });
    expect(sub.cursor).toBe('c1');
    expect((await iterator.next()).value.eventId).toBe('e2');
    expect(sub.cursor).toBe('c2');
    await sub.cancel();
  });

  it('applies heartbeat cursors only once buffered occurrences are yielded', async () => {
    const port = new FakePort();
    const pending = start(port);
    await vi.advanceTimersByTimeAsync(0);
    port.lastStream.confirm({ cursor: 'c0' });
    const sub = await pending;

    port.lastStream.event('e1', 'c1');
    port.lastStream.heartbeat('h1');
    expect(sub.cursor).toBe('c0');
    await sub[Symbol.asyncIterator]().next();
    expect(sub.cursor).toBe('h1');

    port.lastStream.heartbeat('h2');
    expect(sub.cursor).toBe('h2');
    await sub.cancel();
  });

  it('reopens from the last cursor when the stream goes silent past heartbeatTimeoutMs', async () => {
    const port = new FakePort();
    const pending = start(port);
    await vi.advanceTimersByTimeAsync(0);
    port.lastStream.confirm({ cursor: 'c0' });
    const sub = await pending;
    const errors = collectErrors(sub);

    await vi.advanceTimersByTimeAsync(500);
    port.lastStream.heartbeat('h1');
    await vi.advanceTimersByTimeAsync(999);
    expect(port.streams).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(errors.map(error => error.id)).toEqual(['MCP_EVENTS_HEARTBEAT_TIMEOUT']);
    expect(port.streams[0]!.aborted).toBe(true);
    await vi.runOnlyPendingTimersAsync(); // zero backoff (random pinned to 0)
    expect(port.streams).toHaveLength(2);
    expect(port.lastStream.params.cursor).toBe('h1');
    expect(port.ensureConnected).toHaveBeenCalledTimes(1);

    port.lastStream.confirm({ cursor: 'h1' });
    await vi.advanceTimersByTimeAsync(0);
    await sub.cancel();
  });

  it('keeps the stream while heartbeats keep arriving', async () => {
    const port = new FakePort();
    const pending = start(port);
    await vi.advanceTimersByTimeAsync(0);
    port.lastStream.confirm();
    const sub = await pending;
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(800);
      port.lastStream.heartbeat(`h${i}`);
    }
    expect(port.streams).toHaveLength(1);
    expect(port.lastStream.aborted).toBe(false);
    await sub.cancel();
    expect(port.lastStream.aborted).toBe(true);
  });

  it('reports server error notifications and keeps the stream open', async () => {
    const port = new FakePort();
    const pending = start(port);
    await vi.advanceTimersByTimeAsync(0);
    port.lastStream.confirm();
    const sub = await pending;
    const errors = collectErrors(sub);

    port.lastStream.error(EVENTS_ERROR_CODES.ResourceExhausted, 'upstream rate limited');
    port.lastStream.event('e1', 'c1');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      id: 'MCP_EVENTS_STREAM_ERROR',
      details: { code: EVENTS_ERROR_CODES.ResourceExhausted },
    });
    expect((await sub[Symbol.asyncIterator]().next()).value.eventId).toBe('e1');
    expect(port.streams).toHaveLength(1);
    await sub.cancel();
  });

  it('ends the iterator when the server terminates the subscription', async () => {
    const port = new FakePort();
    const pending = start(port);
    await vi.advanceTimersByTimeAsync(0);
    port.lastStream.confirm();
    const sub = await pending;
    const iterator = sub[Symbol.asyncIterator]();

    port.lastStream.event('e1', 'c1');
    port.lastStream.terminated(EVENTS_ERROR_CODES.NotFound, 'event removed');
    await vi.advanceTimersByTimeAsync(0);

    expect((await iterator.next()).value.eventId).toBe('e1');
    await expect(iterator.next()).rejects.toMatchObject({
      id: 'MCP_EVENTS_SUBSCRIPTION_TERMINATED',
      details: { code: EVENTS_ERROR_CODES.NotFound },
    });
    expect(port.lastStream.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(port.streams).toHaveLength(1);
  });

  it('reopens after backoff when the server closes the stream without terminating it', async () => {
    const port = new FakePort();
    const pending = start(port, {}, () => 1);
    await vi.advanceTimersByTimeAsync(0);
    port.lastStream.confirm({ cursor: 'c0' });
    const sub = await pending;
    const errors = collectErrors(sub);

    port.lastStream.close();
    await vi.advanceTimersByTimeAsync(999);
    expect(port.streams).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(port.streams).toHaveLength(2);
    expect(port.lastStream.params.cursor).toBe('c0');
    expect(errors).toHaveLength(0);
    port.lastStream.confirm({ cursor: 'c0' });
    await vi.advanceTimersByTimeAsync(0);
    await sub.cancel();
  });

  it('reopens after a transport failure and reports it', async () => {
    const port = new FakePort();
    const pending = start(port);
    await vi.advanceTimersByTimeAsync(0);
    port.lastStream.confirm({ cursor: 'c0' });
    const sub = await pending;
    const errors = collectErrors(sub);

    port.lastStream.fail(new Error('socket hang up'));
    await vi.advanceTimersByTimeAsync(0);
    expect(errors.map(error => error.id)).toEqual(['MCP_EVENTS_DELIVERY_INTERRUPTED']);
    expect(port.streams).toHaveLength(2);
    await sub.cancel();
  });

  it('rejects subscribe when the stream fails before it is confirmed', async () => {
    const port = new FakePort();
    const pending = start(port);
    await vi.advanceTimersByTimeAsync(0);
    port.lastStream.rejectOpenWith(new Error('open failed'));
    await expect(pending).rejects.toMatchObject({ id: 'MCP_EVENTS_SUBSCRIPTION_FAILED' });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(port.streams).toHaveLength(1);
  });
});
