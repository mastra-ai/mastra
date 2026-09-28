import { describe, expect, it, vi } from 'vitest';

import { createThreadOwnershipManager } from '../ownership.js';

describe('createThreadOwnershipManager', () => {
  it('retains every claimed thread when ownership requests resolve out of order', async () => {
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

    // Neither thread's claim is dropped: a session that has bound both threads
    // keeps both addressable by peers.
    expect(releaseFirst).not.toHaveBeenCalled();
    expect(releaseSecond).not.toHaveBeenCalled();

    manager.close();
    expect(releaseFirst).toHaveBeenCalledOnce();
    expect(releaseSecond).toHaveBeenCalledOnce();
  });

  it('supersedes only the re-claimed thread', async () => {
    const releases = new Map<string, ReturnType<typeof vi.fn>>();
    const manager = createThreadOwnershipManager(async threadId => {
      const unsubscribe = vi.fn();
      const key = `${threadId}:${releases.size}`;
      releases.set(key, unsubscribe);
      return { claimed: true, unsubscribe };
    });

    await expect(manager.claim('thread-1')).resolves.toBe(true);
    await expect(manager.claim('thread-2')).resolves.toBe(true);
    await expect(manager.claim('thread-1')).resolves.toBe(true);

    // The first claim on thread-1 was replaced by the re-claim; thread-2's claim
    // is untouched throughout.
    expect(releases.get('thread-1:0')).toHaveBeenCalledOnce();
    expect(releases.get('thread-2:1')).not.toHaveBeenCalled();
    expect(releases.get('thread-1:2')).not.toHaveBeenCalled();
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

  it('keeps previously claimed threads when handed no thread', async () => {
    const unsubscribe = vi.fn();
    const manager = createThreadOwnershipManager(async () => ({ claimed: true, unsubscribe }));

    await expect(manager.claim('thread-1')).resolves.toBe(true);
    await expect(manager.claim(undefined)).resolves.toBe(false);

    expect(unsubscribe).not.toHaveBeenCalled();
    manager.close();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('releases a deleted thread without touching the others', async () => {
    const releases = new Map<string, ReturnType<typeof vi.fn>>();
    const manager = createThreadOwnershipManager(async threadId => {
      const unsubscribe = vi.fn();
      releases.set(threadId, unsubscribe);
      return { claimed: true, unsubscribe };
    });

    await expect(manager.claim('thread-1')).resolves.toBe(true);
    await expect(manager.claim('thread-2')).resolves.toBe(true);

    manager.release('thread-1');

    // A deleted thread has nothing left to answer for; the surviving thread stays
    // claimed so peers can still reach it.
    expect(releases.get('thread-1')).toHaveBeenCalledOnce();
    expect(releases.get('thread-2')).not.toHaveBeenCalled();

    manager.close();
    expect(releases.get('thread-2')).toHaveBeenCalledOnce();
    expect(releases.get('thread-1')).toHaveBeenCalledOnce();
  });

  it('drops a deleted thread whose ownership request is still in flight', async () => {
    let resolveClaim: ((claim: { claimed: boolean; unsubscribe: () => void }) => void) | undefined;
    const manager = createThreadOwnershipManager(
      () =>
        new Promise(resolve => {
          resolveClaim = resolve;
        }),
    );

    const pending = manager.claim('thread-1');
    manager.release('thread-1');
    const unsubscribe = vi.fn();
    resolveClaim?.({ claimed: true, unsubscribe });
    await pending;

    // The deletion landed while the claim was in flight, so the late claim must
    // release itself rather than leave a deleted thread advertised.
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('does not retain a superseded attempt that resolves after the thread was re-claimed', async () => {
    const resolvers: Array<(claim: { claimed: boolean; unsubscribe: () => void }) => void> = [];
    const manager = createThreadOwnershipManager(
      () =>
        new Promise(resolve => {
          resolvers.push(resolve);
        }),
    );

    // The first attempt for the thread is in flight when the thread is deleted.
    const stale = manager.claim('thread-1');
    manager.release('thread-1');

    // The same thread id is claimed again, so a fresh attempt supersedes it.
    const current = manager.claim('thread-1');

    const staleUnsubscribe = vi.fn();
    resolvers[0]?.({ claimed: true, unsubscribe: staleUnsubscribe });
    await stale;

    const currentUnsubscribe = vi.fn();
    resolvers[1]?.({ claimed: true, unsubscribe: currentUnsubscribe });
    await current;

    // The attempt started before the release is superseded by the re-claim, so it
    // must release itself instead of being retained and silently replaced.
    expect(staleUnsubscribe).toHaveBeenCalledOnce();
    expect(currentUnsubscribe).not.toHaveBeenCalled();
  });

  it('retries a thread after core reports that its claim was lost', async () => {
    vi.useFakeTimers();
    try {
      const ownershipLosses: Array<() => void> = [];
      const unsubscribes: Array<ReturnType<typeof vi.fn>> = [];
      const claimThread = vi.fn(async (_threadId: string, { onLost }: { onLost: () => void }) => {
        ownershipLosses.push(onLost);
        const unsubscribe = vi.fn();
        unsubscribes.push(unsubscribe);
        return { claimed: true, unsubscribe };
      });
      const manager = createThreadOwnershipManager(claimThread);

      await expect(manager.claim('thread-1')).resolves.toBe(true);
      ownershipLosses[0]?.();
      await vi.advanceTimersByTimeAsync(250);

      expect(claimThread).toHaveBeenCalledTimes(2);
      expect(unsubscribes[0]).not.toHaveBeenCalled();
      manager.close();
      expect(unsubscribes[1]).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('forgets a thread it yielded to another process without unsubscribing twice', async () => {
    const unsubscribe = vi.fn();
    let yieldOwnership: (() => void) | undefined;
    const manager = createThreadOwnershipManager(async (_threadId, { onYield }) => {
      yieldOwnership = onYield;
      return { claimed: true, unsubscribe };
    });

    await expect(manager.claim('thread-1')).resolves.toBe(true);
    // Core releases the claim itself before notifying; the manager must only
    // drop its bookkeeping.
    yieldOwnership?.();
    manager.close();
    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it('ignores a yield from a superseded attempt', async () => {
    const yields: Array<() => void> = [];
    const unsubscribes: Array<ReturnType<typeof vi.fn>> = [];
    const manager = createThreadOwnershipManager(async (_threadId, { onYield }) => {
      yields.push(onYield);
      const unsubscribe = vi.fn();
      unsubscribes.push(unsubscribe);
      return { claimed: true, unsubscribe };
    });

    await manager.claim('thread-1');
    await manager.claim('thread-1');
    // The first claim was displaced by the re-claim; a late yield from it must
    // not drop the current claim.
    yields[0]?.();
    manager.close();
    expect(unsubscribes[1]).toHaveBeenCalledOnce();
  });
});
