import { describe, expect, it, vi } from 'vitest';

import { createThreadOwnershipManager } from '../ownership.js';

describe('createThreadOwnershipManager', () => {
  it('keeps only the newest claim when async ownership requests resolve out of order', async () => {
    const claims = new Map<string, { resolve: (claim: { claimed: boolean; unsubscribe: () => void }) => void }>();
    const manager = createThreadOwnershipManager(
      threadId =>
        new Promise(resolve => {
          claims.set(threadId, { resolve });
        }),
    );

    const first = manager.claim('thread-1');
    const second = manager.claim('thread-2');
    const releaseSecond = vi.fn();
    const releaseFirst = vi.fn();
    claims.get('thread-2')?.resolve({ claimed: true, unsubscribe: releaseSecond });
    await second;
    claims.get('thread-1')?.resolve({ claimed: true, unsubscribe: releaseFirst });
    await first;

    expect(releaseFirst).toHaveBeenCalledOnce();
    expect(releaseSecond).not.toHaveBeenCalled();

    manager.close();
    expect(releaseSecond).toHaveBeenCalledOnce();
  });

  it('does not retain a rejected ownership claim', async () => {
    const unsubscribe = vi.fn();
    const manager = createThreadOwnershipManager(async () => ({ claimed: false, unsubscribe }));

    await expect(manager.claim('thread-1')).resolves.toBe(false);
    manager.close();

    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it('retries rejected ownership claims until the thread becomes available', async () => {
    vi.useFakeTimers();
    try {
      const unsubscribe = vi.fn();
      const claimThread = vi
        .fn()
        .mockResolvedValueOnce({ claimed: false, unsubscribe: vi.fn() })
        .mockRejectedValueOnce(new Error('temporary subscription failure'))
        .mockResolvedValueOnce({ claimed: true, unsubscribe });
      const manager = createThreadOwnershipManager(claimThread);

      await expect(manager.claim('thread-1')).resolves.toBe(false);
      await vi.advanceTimersByTimeAsync(249);
      expect(claimThread).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(claimThread).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(499);
      expect(claimThread).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);

      expect(claimThread).toHaveBeenCalledTimes(3);
      manager.close();
      expect(unsubscribe).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('releases the current claim immediately when transitioning to no thread', async () => {
    const unsubscribe = vi.fn();
    const manager = createThreadOwnershipManager(async () => ({ claimed: true, unsubscribe }));

    await expect(manager.claim('thread-1')).resolves.toBe(true);
    await expect(manager.claim(undefined)).resolves.toBe(false);

    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
