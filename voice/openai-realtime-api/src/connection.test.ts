import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import { OpenAIRealtimeVoice } from './index';

vi.mock('ws', async () => {
  const { EventEmitter } = await import('node:events');
  class Socket extends EventEmitter {
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    readyState = 0;
    send = vi.fn();
    close = vi.fn();
  }
  return {
    WebSocket: Object.assign(
      vi.fn(function () {
        return new Socket();
      }),
      {
        OPEN: Socket.OPEN,
        CLOSING: Socket.CLOSING,
        CLOSED: Socket.CLOSED,
      },
    ),
  };
});

function socket() {
  return vi.mocked(WebSocket).mock.results.at(-1)!.value as EventEmitter & {
    readyState: number;
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
}
function created() {
  socket().emit('message', Buffer.from(JSON.stringify({ type: 'session.created', session: {} })));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('connection deadlines and cleanup', () => {
  it.each([undefined, 50])('bounds a socket that never opens (timeout=%s)', async timeout => {
    const voice = new OpenAIRealtimeVoice({ connectTimeoutMs: timeout });
    const connection = voice.connect();
    const rejection = expect(connection).rejects.toThrow(`timed out after ${timeout ?? 15000}ms`);
    await vi.advanceTimersByTimeAsync(timeout ?? 15000);
    await rejection;
    expect(socket().listenerCount('open')).toBe(0);
    expect(socket().listenerCount('close')).toBe(0);
    expect(socket().listenerCount('error')).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(socket().close).toHaveBeenCalledOnce();
  });

  it('uses a total budget rather than restarting the timer after opening', async () => {
    const voice = new OpenAIRealtimeVoice({ connectTimeoutMs: 100 });
    const connection = voice.connect();
    const rejection = expect(connection).rejects.toThrow('timed out after 100ms');
    await vi.advanceTimersByTimeAsync(90);
    socket().emit('open');
    await vi.advanceTimersByTimeAsync(10);
    await rejection;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('handles adjacent open/session events and cancels timers on success', async () => {
    const voice = new OpenAIRealtimeVoice({ connectTimeoutMs: 100 });
    const connection = voice.connect();
    await vi.advanceTimersByTimeAsync(99);
    socket().emit('open');
    created();
    await connection;
    expect(vi.getTimerCount()).toBe(0);
    expect(socket().listenerCount('open')).toBe(0);
    expect(socket().listenerCount('close')).toBe(0);
    const error = new Error('later error');
    const onError = vi.fn();
    voice.on('error', onError);
    socket().emit('error', error);
    expect(onError).toHaveBeenCalledWith(error);
    voice.disconnect();
  });

  it.each([false, true])('rejects transport errors and cleans both waits (opened=%s)', async opened => {
    const voice = new OpenAIRealtimeVoice();
    const connection = voice.connect();
    const rejection = expect(connection).rejects.toThrow('transport failed');
    if (opened) socket().emit('open');
    socket().emit('error', new Error('transport failed'));
    await rejection;
    expect(vi.getTimerCount()).toBe(0);
    expect(socket().listenerCount('open')).toBe(0);
    expect(socket().listenerCount('close')).toBe(0);
    expect(socket().send).not.toHaveBeenCalled();
  });

  it.each([false, true])('rejects socket closure and cleans both waits (opened=%s)', async opened => {
    const voice = new OpenAIRealtimeVoice();
    const connection = voice.connect();
    const rejection = expect(connection).rejects.toThrow('1008: rejected');
    if (opened) socket().emit('open');
    socket().emit('close', 1008, Buffer.from('rejected'));
    await rejection;
    expect(vi.getTimerCount()).toBe(0);
    expect(socket().listenerCount('open')).toBe(0);
    expect(socket().listenerCount('close')).toBe(0);
    expect(socket().send).not.toHaveBeenCalled();
  });

  it('ignores stale socket messages during a subsequent connection', async () => {
    const voice = new OpenAIRealtimeVoice();
    const first = voice.connect();
    const rejection = expect(first).rejects.toThrow('transport failed');
    const stale = socket();
    stale.emit('error', new Error('transport failed'));
    await rejection;

    const onSession = vi.fn();
    voice.on('session.created', onSession);
    const retry = voice.connect();
    socket().emit('open');
    stale.emit('message', Buffer.from(JSON.stringify({ type: 'session.created', session: {} })));
    expect(onSession).not.toHaveBeenCalled();
    created();
    await retry;
    expect(onSession).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    voice.disconnect();
  });

  it.each([0, -1, NaN, Infinity, 2147483648])('rejects invalid timeout %s', connectTimeoutMs => {
    expect(() => new OpenAIRealtimeVoice({ connectTimeoutMs })).toThrow('connectTimeoutMs');
  });
});
