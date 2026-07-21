import { describe, expect, it, vi } from 'vitest';

import { createTuiCleanup } from '../main-cleanup.js';

describe('Mastra Code TUI cleanup', () => {
  it('stops work before closing storage and is single-flight across exit paths', async () => {
    const events: string[] = [];
    const stopWork = vi.fn(async () => {
      events.push('stop');
    });
    const closeStorage = vi.fn(async () => {
      events.push('storage');
    });
    const shutdownAnalytics = vi.fn(async () => {
      events.push('analytics');
    });
    const releaseLocks = vi.fn(() => {
      events.push('locks');
    });
    const cleanup = createTuiCleanup({ stopWork: [stopWork], closeStorage, shutdownAnalytics, releaseLocks });

    await Promise.all([cleanup(), cleanup(), cleanup()]);

    expect(events).toEqual(['stop', 'storage', 'analytics', 'locks']);
    expect(closeStorage).toHaveBeenCalledOnce();
  });

  it('continues teardown while propagating a storage close failure', async () => {
    const error = new Error('close failed');
    const shutdownAnalytics = vi.fn();
    const releaseLocks = vi.fn();
    const cleanup = createTuiCleanup({
      stopWork: [vi.fn().mockRejectedValue(new Error('producer failed'))],
      closeStorage: vi.fn().mockRejectedValue(error),
      shutdownAnalytics,
      releaseLocks,
    });

    await expect(cleanup()).rejects.toBe(error);
    expect(shutdownAnalytics).toHaveBeenCalledOnce();
    expect(releaseLocks).toHaveBeenCalledOnce();
  });
});
