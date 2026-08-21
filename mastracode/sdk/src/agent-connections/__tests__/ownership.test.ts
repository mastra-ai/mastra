import { describe, expect, it, vi } from 'vitest';

import { createThreadOwnershipManager } from '../ownership.js';

describe('createThreadOwnershipManager', () => {
  it('keeps only the newest claim when async ownership requests resolve out of order', async () => {
    const claims = new Map<string, { resolve: (claim: { unsubscribe: () => void }) => void }>();
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
    claims.get('thread-2')?.resolve({ unsubscribe: releaseSecond });
    await second;
    claims.get('thread-1')?.resolve({ unsubscribe: releaseFirst });
    await first;

    expect(releaseFirst).toHaveBeenCalledOnce();
    expect(releaseSecond).not.toHaveBeenCalled();

    manager.close();
    expect(releaseSecond).toHaveBeenCalledOnce();
  });

  it('releases the current claim immediately when transitioning to no thread', async () => {
    const unsubscribe = vi.fn();
    const manager = createThreadOwnershipManager(async () => ({ unsubscribe }));

    await manager.claim('thread-1');
    await manager.claim(undefined);

    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
