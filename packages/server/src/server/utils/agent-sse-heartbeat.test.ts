import { afterEach, describe, expect, it, vi } from 'vitest';
import { withAgentSseHeartbeat } from './agent-sse-heartbeat';

afterEach(() => vi.useRealTimers());

describe('agent SSE heartbeat', () => {
  it('keeps a pending read alive through heartbeats without losing the finish event', async () => {
    vi.useFakeTimers();
    let source!: ReadableStreamDefaultController<object>;
    const cancel = vi.fn();
    const stream = new ReadableStream<object>({
      start(controller) {
        source = controller;
      },
      cancel,
    });
    const reader = withAgentSseHeartbeat(stream).getReader();
    const first = reader.read();
    await vi.advanceTimersByTimeAsync(25_000);
    expect(await first).toEqual({ done: false, value: ': heartbeat\n\n' });
    const finish = { type: 'finish' };
    source.enqueue(finish);
    expect(await reader.read()).toEqual({ done: false, value: finish });
    source.close();
    expect((await reader.read()).done).toBe(true);
    expect(cancel).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not queue heartbeats while there is no downstream demand', async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const reader = withAgentSseHeartbeat(new ReadableStream({ cancel }), 10).getReader();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(vi.getTimerCount()).toBe(0);
    const read = reader.read();
    await vi.advanceTimersByTimeAsync(10);
    expect((await read).value).toBe(': heartbeat\n\n');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(vi.getTimerCount()).toBe(0);
    await reader.cancel();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('retains one upstream read across many heartbeat intervals', async () => {
    vi.useFakeTimers();
    let source!: ReadableStreamDefaultController;
    const stream = new ReadableStream({
      start(controller) {
        source = controller;
      },
    });
    const getReader = vi.spyOn(stream, 'getReader');
    const reader = withAgentSseHeartbeat(stream, 1).getReader();
    const upstream = getReader.mock.results[0]!.value;
    const read = vi.spyOn(upstream, 'read');
    for (let index = 0; index < 100; index++) {
      const next = reader.read();
      await vi.advanceTimersByTimeAsync(1);
      expect((await next).value).toBe(': heartbeat\n\n');
    }
    expect(read).toHaveBeenCalledTimes(1);
    source.enqueue({ type: 'finish' });
    expect((await reader.read()).value).toEqual({ type: 'finish' });
    await reader.cancel();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('handles an already aborted observer and repeated cancellation', async () => {
    const abort = new AbortController();
    abort.abort();
    const cancel = vi.fn();
    const reader = withAgentSseHeartbeat(new ReadableStream({ cancel }), 10, abort.signal).getReader();
    expect((await reader.read()).done).toBe(true);
    await reader.cancel();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('disables comments without changing stream identity', () => {
    const stream = new ReadableStream();
    expect(withAgentSseHeartbeat(stream, 0)).toBe(stream);
  });

  it('cancels an outstanding upstream read once on abort', async () => {
    vi.useFakeTimers();
    const abort = new AbortController();
    const cancel = vi.fn();
    const reader = withAgentSseHeartbeat(new ReadableStream({ cancel }), 10, abort.signal).getReader();
    const read = reader.read();
    await vi.advanceTimersByTimeAsync(1);
    abort.abort();
    expect((await read).done).toBe(true);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('propagates upstream errors and clears the timer', async () => {
    vi.useFakeTimers();
    let source!: ReadableStreamDefaultController;
    const reader = withAgentSseHeartbeat(
      new ReadableStream({
        start(controller) {
          source = controller;
        },
      }),
      10,
    ).getReader();
    const read = reader.read();
    const assertion = expect(read).rejects.toThrow('upstream failed');
    source.error(new Error('upstream failed'));
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
});
