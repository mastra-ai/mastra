import { describe, expect, it, vi } from 'vitest';
import { createTimeoutAbortSignal, isMastraTimeoutError, MastraTimeoutError, raceAgainstAbort } from './timeout';

const tick = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('createTimeoutAbortSignal', () => {
  it('aborts with a MastraTimeoutError once the budget elapses', async () => {
    const { signal, cleanup } = createTimeoutAbortSignal({ timeoutMs: 20, timeoutType: 'total' });

    expect(signal?.aborted).toBe(false);
    await tick(40);

    expect(signal?.aborted).toBe(true);
    expect(isMastraTimeoutError(signal?.reason)).toBe(true);
    expect((signal?.reason as MastraTimeoutError).timeoutType).toBe('total');
    expect((signal?.reason as MastraTimeoutError).timeoutMs).toBe(20);
    cleanup();
  });

  it('rejects timeoutPromise with the same error', async () => {
    const { timeoutPromise, cleanup } = createTimeoutAbortSignal({ timeoutMs: 10, timeoutType: 'step' });

    await expect(timeoutPromise).rejects.toThrow(MastraTimeoutError);
    await expect(timeoutPromise).rejects.toMatchObject({ timeoutType: 'step', timeoutMs: 10 });
    cleanup();
  });

  it('is a pass-through when no timeout is configured', () => {
    const parent = new AbortController();
    const { signal, timeoutPromise, cleanup } = createTimeoutAbortSignal({
      parentSignal: parent.signal,
      timeoutType: 'total',
    });

    expect(signal).toBe(parent.signal);
    expect(timeoutPromise).toBeUndefined();
    cleanup();
  });

  it('ignores non-positive and non-finite budgets', () => {
    for (const timeoutMs of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const { timeoutPromise } = createTimeoutAbortSignal({ timeoutMs, timeoutType: 'step' });
      expect(timeoutPromise).toBeUndefined();
    }
  });

  it('propagates a parent abort and preserves the parent reason', async () => {
    const parent = new AbortController();
    const { signal, cleanup } = createTimeoutAbortSignal({
      parentSignal: parent.signal,
      timeoutMs: 10_000,
      timeoutType: 'total',
    });

    const reason = new Error('user cancelled');
    parent.abort(reason);
    await tick(0);

    expect(signal?.aborted).toBe(true);
    expect(signal?.reason).toBe(reason);
    expect(isMastraTimeoutError(signal?.reason)).toBe(false);
    cleanup();
  });

  it('propagates an already-aborted parent signal', () => {
    const parent = new AbortController();
    const reason = new Error('already gone');
    parent.abort(reason);

    const { signal, cleanup } = createTimeoutAbortSignal({
      parentSignal: parent.signal,
      timeoutMs: 10_000,
      timeoutType: 'total',
    });

    expect(signal?.aborted).toBe(true);
    expect(signal?.reason).toBe(reason);
    cleanup();
  });

  it('cleanup clears the timer and detaches the parent listener', async () => {
    const parent = new AbortController();
    const removeSpy = vi.spyOn(parent.signal, 'removeEventListener');

    const { signal, cleanup } = createTimeoutAbortSignal({
      parentSignal: parent.signal,
      timeoutMs: 10,
      timeoutType: 'step',
    });
    cleanup();
    await tick(30);

    expect(signal?.aborted).toBe(false);
    expect(removeSpy).toHaveBeenCalled();
  });
});

describe('raceAgainstAbort', () => {
  it('resolves with the promise when the signal never aborts', async () => {
    const { signal, cleanup } = createTimeoutAbortSignal({ timeoutMs: 10_000, timeoutType: 'step' });
    await expect(raceAgainstAbort(Promise.resolve('ok'), signal)).resolves.toBe('ok');
    cleanup();
  });

  it('rejects with the timeout error when the budget elapses first', async () => {
    const { signal, cleanup } = createTimeoutAbortSignal({ timeoutMs: 20, timeoutType: 'step' });

    await expect(raceAgainstAbort(new Promise(() => {}), signal)).rejects.toThrow(MastraTimeoutError);
    cleanup();
  });

  it('rejects immediately when the signal is already aborted', async () => {
    const controller = new AbortController();
    const reason = new Error('nope');
    controller.abort(reason);

    await expect(raceAgainstAbort(new Promise(() => {}), controller.signal)).rejects.toBe(reason);
  });

  it('passes the promise through when no signal is provided', async () => {
    await expect(raceAgainstAbort(Promise.resolve('ok'), undefined)).resolves.toBe('ok');
  });
});
