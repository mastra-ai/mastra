export interface ThreadOwnershipClaim {
  claimed: boolean;
  unsubscribe(): void;
}

export interface ThreadClaimContext {
  /**
   * Call from the core `yieldOwnership` callback when this claim is released to
   * another process, so the manager stops tracking it instead of believing it
   * still owns the thread.
   */
  onYield(): void;
  /** Call when lease renewal proves another live owner took the claim, so the manager retries it. */
  onLost(): void;
}

const OWNERSHIP_RETRY_INITIAL_DELAY_MS = 250;
const OWNERSHIP_RETRY_MAX_DELAY_MS = 5_000;

/**
 * Per-thread claim bookkeeping. One entry per thread this session has bound, so
 * a thread the user has navigated away from stays claimed — and therefore stays
 * addressable by peers — until the session itself is torn down, or until another
 * process asks for the thread and this session yields it.
 */
type ThreadClaimState = {
  /** Bumped on every new attempt for this thread; late resolutions are dropped. */
  generation: number;
  claim?: ThreadOwnershipClaim;
  retryTimer?: ReturnType<typeof setTimeout>;
  retryDelayMs: number;
};

/**
 * Keeps one renewable ownership claim per session thread, retries contention,
 * and discards superseded attempts without creating a release-before-acquire gap.
 */
export function createThreadOwnershipManager(
  claimThread: (threadId: string, context: ThreadClaimContext) => Promise<ThreadOwnershipClaim>,
): {
  claim(threadId?: string | null): Promise<boolean>;
  release(threadId: string): void;
  close(): void;
} {
  const states = new Map<string, ThreadClaimState>();
  // Manager-scoped so the counter keeps climbing across `release`/re-claim of the
  // same thread id: a per-thread counter restarts at 1 after a release, letting a
  // pre-release attempt match the new state and be retained.
  let nextGeneration = 0;
  let closed = false;

  const clearRetry = (state: ThreadClaimState) => {
    if (state.retryTimer) clearTimeout(state.retryTimer);
    state.retryTimer = undefined;
  };

  const scheduleRetry = (threadId: string, claimGeneration: number) => {
    const state = states.get(threadId);
    if (closed || !state || state.generation !== claimGeneration || state.retryTimer) return;
    const delayMs = state.retryDelayMs;
    state.retryDelayMs = Math.min(state.retryDelayMs * 2, OWNERSHIP_RETRY_MAX_DELAY_MS);
    state.retryTimer = setTimeout(() => {
      state.retryTimer = undefined;
      void attemptClaim(threadId, claimGeneration, false);
    }, delayMs);
    state.retryTimer.unref?.();
  };

  const yieldClaim = (threadId: string, claimGeneration: number) => {
    const state = states.get(threadId);
    if (!state || state.generation !== claimGeneration) return;
    // Core completed the transfer or release before notifying us. Forget the
    // thread entirely: the user is not on it, and switching back re-claims it.
    clearRetry(state);
    states.delete(threadId);
  };

  const loseClaim = (threadId: string, claimGeneration: number) => {
    const state = states.get(threadId);
    if (!state || state.generation !== claimGeneration) return;
    // Core already stopped the stale claim. Keep the thread tracked and retry:
    // another process may move away or exit while this session is still alive.
    state.claim = undefined;
    scheduleRetry(threadId, claimGeneration);
  };

  const attemptClaim = async (threadId: string, claimGeneration: number, propagateError: boolean): Promise<boolean> => {
    try {
      const nextClaim = await claimThread(threadId, {
        onYield: () => yieldClaim(threadId, claimGeneration),
        onLost: () => loseClaim(threadId, claimGeneration),
      });
      const state = states.get(threadId);
      // The session closed, or a newer attempt superseded this one while the
      // ownership request was in flight — the late claim must not be retained.
      if (closed || !state || state.generation !== claimGeneration) {
        nextClaim.unsubscribe();
        return false;
      }
      if (!nextClaim.claimed) {
        scheduleRetry(threadId, claimGeneration);
        return false;
      }
      const previousClaim = state.claim;
      state.retryDelayMs = OWNERSHIP_RETRY_INITIAL_DELAY_MS;
      state.claim = nextClaim;
      previousClaim?.unsubscribe();
      return true;
    } catch (error) {
      scheduleRetry(threadId, claimGeneration);
      if (propagateError) throw error;
      return false;
    }
  };

  return {
    async claim(threadId) {
      if (closed) return false;
      // A thread-less transition has no claim to make. Threads already claimed
      // stay claimed: being handed no thread is not a reason to drop them.
      if (!threadId) return false;

      // Re-claiming the thread supersedes only that thread's previous attempt —
      // the core claim is re-published so title/metadata changes made while the
      // session was away are picked up. Keep the live claim until its replacement
      // is ready so lease-backed ownership never has a release-then-acquire gap.
      const existing = states.get(threadId);
      if (existing) clearRetry(existing);
      const state: ThreadClaimState = {
        generation: ++nextGeneration,
        retryDelayMs: OWNERSHIP_RETRY_INITIAL_DELAY_MS,
        claim: existing?.claim,
      };
      states.set(threadId, state);
      return attemptClaim(threadId, state.generation, true);
    },
    release(threadId) {
      // The thread no longer exists, so its claim has nothing left to answer for.
      // Dropping the state also makes any in-flight attempt for it unsubscribe
      // itself instead of retaining a claim for a deleted thread.
      const state = states.get(threadId);
      if (!state) return;
      clearRetry(state);
      state.claim?.unsubscribe();
      states.delete(threadId);
    },
    close() {
      closed = true;
      for (const state of states.values()) {
        clearRetry(state);
        state.claim?.unsubscribe();
      }
      states.clear();
    },
  };
}
