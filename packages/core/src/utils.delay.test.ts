import { afterEach, describe, expect, it, vi } from 'vitest';

import { delay } from './utils';

describe('delay', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves as soon as the signal aborts', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    let done = false;
    const wait = delay(10_000, controller.signal).then(() => {
      done = true;
    });

    await vi.advanceTimersByTimeAsync(100);
    expect(done).toBe(false);
    controller.abort();
    await wait;
    expect(done).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('resolves immediately for an already-aborted signal', async () => {
    vi.useFakeTimers();
    await delay(10_000, AbortSignal.abort());
    expect(vi.getTimerCount()).toBe(0);
  });

  it('still waits the full time without a signal', async () => {
    vi.useFakeTimers();
    let done = false;
    void delay(1_000).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });
});
