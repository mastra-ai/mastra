import { ProtocolError } from '@modelcontextprotocol/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENTS_NOTIFICATIONS, EVENTS_SUBSCRIPTION_ID_META_KEY } from '../../shared/events';
import type { StreamEventsRequestParams } from '../../shared/events';
import { EventStreamRouter } from './stream-router';
import type { EventStreamChannel } from './stream-router';
import type { EventStreamSink } from './types';

interface SentRequest {
  params: StreamEventsRequestParams;
  signal: AbortSignal;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
}

class FakeChannel implements EventStreamChannel {
  readonly sent: SentRequest[] = [];
  private readonly handlers = new Map<string, (params: unknown) => void>();

  /** Mirrors the client's transport: JSON-RPC ids 1, 2, 3… in send order, reported as sent. */
  request(params: StreamEventsRequestParams, signal: AbortSignal, onSent: (id: string) => void): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.sent.push({ params, signal, resolve, reject });
      onSent(String(this.sent.length));
      signal.addEventListener('abort', () => reject(new Error('AbortError')), { once: true });
    });
  }

  onNotification(method: string, handler: (params: unknown) => void): void {
    this.handlers.set(method, handler);
  }

  notify(method: string, id: number, params: Record<string, unknown> = {}): void {
    this.handlers.get(method)?.({ ...params, _meta: { [EVENTS_SUBSCRIPTION_ID_META_KEY]: id } });
  }

  event(id: number, eventId: string): void {
    this.notify(EVENTS_NOTIFICATIONS.event, id, { eventId, name: 'e', timestamp: 't', data: {} });
  }
}

function recordingSink() {
  const seen: string[] = [];
  const sink: EventStreamSink = {
    active: () => seen.push('active'),
    event: params => seen.push(`event:${params.eventId}`),
    heartbeat: () => seen.push('heartbeat'),
    error: () => seen.push('error'),
    terminated: () => seen.push('terminated'),
  };
  return { sink, seen };
}

const params = (name: string): StreamEventsRequestParams => ({ name, cursor: null });

describe('EventStreamRouter', () => {
  let channel: FakeChannel;
  let log: ReturnType<typeof vi.fn>;
  let router: EventStreamRouter;

  beforeEach(() => {
    vi.useFakeTimers();
    channel = new FakeChannel();
    log = vi.fn();
    router = new EventStreamRouter(channel, log);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('serializes opens and binds each confirmation to the stream that is waiting for it', async () => {
    const a = recordingSink();
    const b = recordingSink();
    const openA = router.open(params('a'), a.sink, { signal: new AbortController().signal, openTimeoutMs: 1000 });
    const openB = router.open(params('b'), b.sink, { signal: new AbortController().signal, openTimeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(0);
    // B is not sent until A is confirmed, so the next unbound `active` can only be A's.
    expect(channel.sent.map(request => request.params.name)).toEqual(['a']);

    channel.notify(EVENTS_NOTIFICATIONS.active, 1);
    await openA;
    await vi.advanceTimersByTimeAsync(0);
    expect(channel.sent.map(request => request.params.name)).toEqual(['a', 'b']);

    channel.notify(EVENTS_NOTIFICATIONS.active, 2);
    await openB;

    channel.event(2, 'for-b');
    channel.event(1, 'for-a');
    channel.notify(EVENTS_NOTIFICATIONS.heartbeat, 2, { cursor: null });
    expect(a.seen).toEqual(['active', 'event:for-a']);
    expect(b.seen).toEqual(['active', 'event:for-b', 'heartbeat']);
  });

  it('times out an open that is never confirmed, aborts it, and lets the next open proceed', async () => {
    const a = recordingSink();
    const b = recordingSink();
    const openA = router.open(params('a'), a.sink, { signal: new AbortController().signal, openTimeoutMs: 500 });
    const openB = router.open(params('b'), b.sink, { signal: new AbortController().signal, openTimeoutMs: 500 });
    const failedA = expect(openA).rejects.toMatchObject({ id: 'MCP_EVENTS_STREAM_OPEN_TIMEOUT' });

    await vi.advanceTimersByTimeAsync(500);
    await failedA;
    expect(channel.sent[0]!.signal.aborted).toBe(true);
    expect(channel.sent.map(request => request.params.name)).toEqual(['a', 'b']);

    channel.notify(EVENTS_NOTIFICATIONS.active, 2);
    await openB;
    expect(b.seen).toEqual(['active']);
    expect(a.seen).toEqual([]);
  });

  it('rejects an open with the JSON-RPC error and releases the lock for the next opener', async () => {
    const a = recordingSink();
    const b = recordingSink();
    const openA = router.open(params('a'), a.sink, { signal: new AbortController().signal, openTimeoutMs: 1000 });
    const openB = router.open(params('b'), b.sink, { signal: new AbortController().signal, openTimeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(0);

    channel.sent[0]!.reject(new ProtocolError(-32602, 'bad arguments'));
    await expect(openA).rejects.toMatchObject({ code: -32602 });
    await vi.advanceTimersByTimeAsync(0);
    expect(channel.sent).toHaveLength(2);
    channel.notify(EVENTS_NOTIFICATIONS.active, 2);
    await expect(openB).resolves.toBeDefined();
  });

  it('drops notifications for streams it does not own', async () => {
    channel.event(99, 'stray');
    channel.notify(EVENTS_NOTIFICATIONS.active, 99);
    const owner = recordingSink();
    const open = router.open(params('a'), owner.sink, { signal: new AbortController().signal, openTimeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(0);
    channel.event(99, 'stray-again');
    expect(log).toHaveBeenCalledWith('debug', expect.stringContaining('unknown event stream 99'));
    channel.notify(EVENTS_NOTIFICATIONS.active, 1);
    await open;
    expect(owner.seen).toEqual(['active']);
  });

  it('stops routing and cancels the request on abort, and resolves done on a graceful close', async () => {
    const a = recordingSink();
    const b = recordingSink();
    const openA = router.open(params('a'), a.sink, { signal: new AbortController().signal, openTimeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(0);
    channel.notify(EVENTS_NOTIFICATIONS.active, 1);
    const handleA = await openA;

    const openB = router.open(params('b'), b.sink, { signal: new AbortController().signal, openTimeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(0);
    channel.notify(EVENTS_NOTIFICATIONS.active, 2);
    const handleB = await openB;

    handleA.abort();
    expect(channel.sent[0]!.signal.aborted).toBe(true);
    await expect(handleA.done).rejects.toThrow();
    channel.event(1, 'late');
    expect(a.seen).toEqual(['active']);

    channel.sent[1]!.resolve({});
    await expect(handleB.done).resolves.toBeUndefined();
    channel.event(2, 'after-close');
    expect(b.seen).toEqual(['active']);
  });

  it('never binds a pending open to a late active from a released stream', async () => {
    const a = recordingSink();
    const b = recordingSink();
    const openA = router.open(params('a'), a.sink, { signal: new AbortController().signal, openTimeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(0);
    channel.notify(EVENTS_NOTIFICATIONS.active, 1);
    const handleA = await openA;
    handleA.abort();
    await expect(handleA.done).rejects.toThrow();

    const openB = router.open(params('b'), b.sink, { signal: new AbortController().signal, openTimeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(channel.sent.map(request => request.params.name)).toEqual(['a', 'b']);
    // A's notifications can trail its cancellation, including a mid-stream `active` on a gap.
    channel.notify(EVENTS_NOTIFICATIONS.active, 1, { truncated: true });
    channel.event(1, 'late-a');
    expect(b.seen).toEqual([]);

    channel.notify(EVENTS_NOTIFICATIONS.active, 2);
    await openB;
    channel.event(2, 'for-b');
    expect(b.seen).toEqual(['active', 'event:for-b']);
    expect(a.seen).toEqual(['active']);
    expect(log).toHaveBeenCalledWith('debug', expect.stringContaining('unknown event stream 1'));
  });

  it('drops a late active for an open that timed out instead of binding the next open to it', async () => {
    const a = recordingSink();
    const b = recordingSink();
    const openA = router.open(params('a'), a.sink, { signal: new AbortController().signal, openTimeoutMs: 500 });
    const openB = router.open(params('b'), b.sink, { signal: new AbortController().signal, openTimeoutMs: 1000 });
    const failedA = expect(openA).rejects.toMatchObject({ id: 'MCP_EVENTS_STREAM_OPEN_TIMEOUT' });
    await vi.advanceTimersByTimeAsync(500);
    await failedA;
    expect(channel.sent.map(request => request.params.name)).toEqual(['a', 'b']);

    // Over stdio the server can confirm A after the client gave up on it, while B is pending.
    channel.notify(EVENTS_NOTIFICATIONS.active, 1);
    channel.event(1, 'from-a-stream');
    expect(b.seen).toEqual([]);

    channel.notify(EVENTS_NOTIFICATIONS.active, 2);
    await openB;
    channel.event(2, 'for-b');
    expect(b.seen).toEqual(['active', 'event:for-b']);
    expect(a.seen).toEqual([]);
  });

  it('binds a pending open only to the id its request was sent with', async () => {
    const owner = recordingSink();
    const open = router.open(params('a'), owner.sink, { signal: new AbortController().signal, openTimeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(0);
    channel.notify(EVENTS_NOTIFICATIONS.active, 42);
    expect(owner.seen).toEqual([]);
    channel.notify(EVENTS_NOTIFICATIONS.active, 1);
    await open;
    expect(owner.seen).toEqual(['active']);
  });

  it('ignores a late active from a stream that ended on its own', async () => {
    const a = recordingSink();
    const b = recordingSink();
    const openA = router.open(params('a'), a.sink, { signal: new AbortController().signal, openTimeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(0);
    channel.notify(EVENTS_NOTIFICATIONS.active, 1);
    const handleA = await openA;
    channel.sent[0]!.resolve({});
    await handleA.done;

    const openB = router.open(params('b'), b.sink, { signal: new AbortController().signal, openTimeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(0);
    channel.notify(EVENTS_NOTIFICATIONS.active, 1);
    expect(b.seen).toEqual([]);
    channel.notify(EVENTS_NOTIFICATIONS.active, 2);
    await openB;
    expect(b.seen).toEqual(['active']);
  });

  it('aborting the caller signal while waiting for confirmation rejects the open', async () => {
    const controller = new AbortController();
    const open = router.open(params('a'), recordingSink().sink, { signal: controller.signal, openTimeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await expect(open).rejects.toThrow();
    expect(channel.sent[0]!.signal.aborted).toBe(true);
  });
});
