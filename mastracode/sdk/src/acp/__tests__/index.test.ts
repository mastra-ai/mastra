import { describe, expect, it, vi } from 'vitest';

import { createAcpCleanup } from '../index.js';

describe('ACP cleanup', () => {
  it('stops work before closing storage and runs only once', async () => {
    const events: string[] = [];
    const closeStorage = vi.fn(async () => {
      events.push('storage');
    });
    const releaseLocks = vi.fn(() => events.push('locks'));
    const restoreConsole = vi.fn(() => events.push('console'));
    const cleanup = createAcpCleanup({
      stopWork: [
        async () => {
          events.push('stop');
        },
      ],
      closeStorage,
      releaseLocks,
      restoreConsole,
    });

    await Promise.all([cleanup(), cleanup()]);

    expect(events).toEqual(['stop', 'storage', 'locks', 'console']);
    expect(closeStorage).toHaveBeenCalledOnce();
  });

  it('releases process resources when storage close fails', async () => {
    const error = new Error('close failed');
    const releaseLocks = vi.fn();
    const restoreConsole = vi.fn();
    const cleanup = createAcpCleanup({
      stopWork: [vi.fn().mockRejectedValue(new Error('stop failed'))],
      closeStorage: vi.fn().mockRejectedValue(error),
      releaseLocks,
      restoreConsole,
    });

    await expect(cleanup()).rejects.toBe(error);
    expect(releaseLocks).toHaveBeenCalledOnce();
    expect(restoreConsole).toHaveBeenCalledOnce();
  });
});
