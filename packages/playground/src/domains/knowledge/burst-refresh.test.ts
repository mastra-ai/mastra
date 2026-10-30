import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createBurstRefresh } from './burst-refresh';

const DEBOUNCE_MS = 150;
const MAX_WAIT_MS = 750;

describe('createBurstRefresh', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('refetches once, 150ms after a single notice', () => {
    const run = vi.fn();
    const refresh = createBurstRefresh(run, DEBOUNCE_MS, MAX_WAIT_MS);
    refresh.notify();
    vi.advanceTimersByTime(DEBOUNCE_MS - 1);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(MAX_WAIT_MS * 2);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('keeps refetching through a steady stream of notices', () => {
    const run = vi.fn();
    const refresh = createBurstRefresh(run, DEBOUNCE_MS, MAX_WAIT_MS);
    for (let elapsed = 0; elapsed < 3_000; elapsed += 50) {
      refresh.notify();
      vi.advanceTimersByTime(50);
    }
    expect(run.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('refetches no later than the max wait after the first notice of a burst', () => {
    const run = vi.fn();
    const refresh = createBurstRefresh(run, DEBOUNCE_MS, MAX_WAIT_MS);
    for (let elapsed = 0; elapsed < MAX_WAIT_MS; elapsed += 50) {
      refresh.notify();
      vi.advanceTimersByTime(50);
    }
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs nothing after it is cancelled', () => {
    const run = vi.fn();
    const refresh = createBurstRefresh(run, DEBOUNCE_MS, MAX_WAIT_MS);
    refresh.notify();
    refresh.cancel();
    vi.advanceTimersByTime(MAX_WAIT_MS * 2);
    expect(run).not.toHaveBeenCalled();
  });
});
