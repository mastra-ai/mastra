import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { withStallTimeout } from './signals-test-utils';

describe('withStallTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves when work keeps progressing past the idle budget in total', async () => {
    const result = withStallTimeout(async progress => {
      for (let step = 0; step < 5; step += 1) {
        await new Promise(resolve => setTimeout(resolve, 400));
        progress();
      }
      return 'done';
    }, 'stalled');

    await vi.advanceTimersByTimeAsync(2000);
    await expect(result).resolves.toBe('done');
  });

  it('rejects once nothing has progressed for the idle budget', async () => {
    const result = withStallTimeout(async progress => {
      await new Promise(resolve => setTimeout(resolve, 400));
      progress();
      await new Promise(() => {});
    }, 'stalled');
    const settled = vi.fn();
    result.catch(settled);

    await vi.advanceTimersByTimeAsync(899);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).rejects.toThrow('stalled');
  });

  it('passes through a rejection from the work', async () => {
    const result = withStallTimeout(async () => {
      throw new Error('boom');
    }, 'stalled');

    await expect(result).rejects.toThrow('boom');
  });
});
