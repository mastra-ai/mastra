import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventRingBuffer } from './ring-buffer';
import { EventStream } from './stream';
import type { StreamNotification } from './stream';

const SUBSCRIPTION = 'io.modelcontextprotocol/subscriptionId';

function setup(options: { heartbeatIntervalMs?: number; match?: (data: Record<string, unknown>) => boolean } = {}) {
  const sent: StreamNotification[] = [];
  const stream = new EventStream({
    subscriptionId: 7,
    notify: async notification => void sent.push(notification),
    heartbeatIntervalMs: options.heartbeatIntervalMs ?? 30_000,
    match: options.match,
  });
  const buffer = new EventRingBuffer('boot/test', 10);
  const emit = (data: Record<string, unknown>) =>
    stream.deliver(
      buffer.push({ eventId: `e${buffer.head}`, name: 'test', timestamp: new Date().toISOString(), data }),
    );
  const methods = () => sent.map(notification => notification.method.replace('notifications/events/', ''));
  return { stream, sent, buffer, emit, methods };
}

describe('EventStream', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends active first, then replayed and live events, all stamped with the subscription id', async () => {
    const { stream, sent, buffer, emit, methods } = setup();
    const replayed = buffer.push({ eventId: 'r1', name: 'test', timestamp: new Date().toISOString(), data: {} });
    stream.start({ cursor: 'start', truncated: true, replay: [{ ...replayed.occurrence, cursor: replayed.cursor }] });
    emit({ live: true });
    await vi.advanceTimersByTimeAsync(0);

    expect(methods()).toEqual(['active', 'event', 'event']);
    expect(sent[0]!.params).toMatchObject({ cursor: 'start', truncated: true });
    expect(sent[2]!.params).toMatchObject({ data: { live: true }, cursor: buffer.head });
    for (const notification of sent) expect(notification.params._meta).toEqual({ [SUBSCRIPTION]: 7 });
    stream.close();
  });

  it('sends a heartbeat carrying the current cursor once the interval passes without other messages', async () => {
    const { stream, sent, methods } = setup();
    stream.start({ cursor: 'c0', truncated: false });
    await vi.advanceTimersByTimeAsync(29_999);
    expect(methods()).toEqual(['active']);

    await vi.advanceTimersByTimeAsync(1);
    expect(methods()).toEqual(['active', 'heartbeat']);
    expect(sent[1]!.params).toEqual({ cursor: 'c0', _meta: { [SUBSCRIPTION]: 7 } });

    await vi.advanceTimersByTimeAsync(30_000);
    expect(methods()).toEqual(['active', 'heartbeat', 'heartbeat']);
    stream.close();
  });

  it('re-arms the heartbeat after every message', async () => {
    const { stream, emit, methods, buffer, sent } = setup();
    stream.start({ cursor: null, truncated: false });
    await vi.advanceTimersByTimeAsync(20_000);
    emit({});
    await vi.advanceTimersByTimeAsync(20_000);
    expect(methods()).toEqual(['active', 'event']);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(methods()).toEqual(['active', 'event', 'heartbeat']);
    expect(sent[2]!.params.cursor).toBe(buffer.head);
    stream.close();
  });

  it('honours a custom interval', async () => {
    const { stream, methods } = setup({ heartbeatIntervalMs: 1_000 });
    stream.start({ cursor: null, truncated: false });
    await vi.advanceTimersByTimeAsync(3_000);
    expect(methods()).toEqual(['active', 'heartbeat', 'heartbeat', 'heartbeat']);
    stream.close();
  });

  it('skips non-matching events but advances the heartbeat cursor past them', async () => {
    const { stream, emit, methods, sent, buffer } = setup({ match: data => data.keep === true });
    stream.start({ cursor: null, truncated: false });
    emit({ keep: false });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(methods()).toEqual(['active', 'heartbeat']);
    expect(sent[1]!.params.cursor).toBe(buffer.head);
    stream.close();
  });

  it('reports a throwing match as a recoverable error and keeps streaming', async () => {
    let fail = true;
    const { stream, emit, methods } = setup({
      match: () => {
        if (fail) throw new Error('boom');
        return true;
      },
    });
    stream.start({ cursor: null, truncated: false });
    emit({});
    fail = false;
    emit({});
    await vi.advanceTimersByTimeAsync(0);
    expect(methods()).toEqual(['active', 'error', 'event']);
    stream.close();
  });

  it('releases its timer and cleanups on close and sends nothing afterwards', async () => {
    const { stream, emit, methods } = setup();
    const cleanup = vi.fn();
    stream.onClose(cleanup);
    stream.start({ cursor: null, truncated: false });
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(1);

    stream.close();
    await stream.closed;
    expect(cleanup).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    emit({});
    await vi.advanceTimersByTimeAsync(60_000);
    expect(methods()).toEqual(['active']);
  });

  it('closes when a notification cannot be delivered', async () => {
    const stream = new EventStream({
      subscriptionId: 1,
      notify: async () => {
        throw new Error('connection gone');
      },
      heartbeatIntervalMs: 30_000,
    });
    stream.start({ cursor: null, truncated: false });
    await stream.closed;
    expect(vi.getTimerCount()).toBe(0);
  });
});
