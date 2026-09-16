export interface ThreadOwnershipClaim {
  claimed: boolean;
  unsubscribe(): void;
}

const OWNERSHIP_RETRY_INITIAL_DELAY_MS = 250;
const OWNERSHIP_RETRY_MAX_DELAY_MS = 5_000;

export function createThreadOwnershipManager(claimThread: (threadId: string) => Promise<ThreadOwnershipClaim>): {
  claim(threadId?: string | null): Promise<boolean>;
  close(): void;
} {
  let generation = 0;
  let currentClaim: ThreadOwnershipClaim | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let retryDelayMs = OWNERSHIP_RETRY_INITIAL_DELAY_MS;

  const clearRetry = () => {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = undefined;
  };

  const scheduleRetry = (threadId: string, claimGeneration: number) => {
    if (claimGeneration !== generation || retryTimer) return;
    const delayMs = retryDelayMs;
    retryDelayMs = Math.min(retryDelayMs * 2, OWNERSHIP_RETRY_MAX_DELAY_MS);
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      void attemptClaim(threadId, claimGeneration, false);
    }, delayMs);
    retryTimer.unref?.();
  };

  const attemptClaim = async (threadId: string, claimGeneration: number, propagateError: boolean): Promise<boolean> => {
    try {
      const nextClaim = await claimThread(threadId);
      if (claimGeneration !== generation) {
        nextClaim.unsubscribe();
        return false;
      }
      if (!nextClaim.claimed) {
        scheduleRetry(threadId, claimGeneration);
        return false;
      }
      retryDelayMs = OWNERSHIP_RETRY_INITIAL_DELAY_MS;
      currentClaim = nextClaim;
      return true;
    } catch (error) {
      scheduleRetry(threadId, claimGeneration);
      if (propagateError) throw error;
      return false;
    }
  };

  return {
    async claim(threadId) {
      const claimGeneration = ++generation;
      clearRetry();
      retryDelayMs = OWNERSHIP_RETRY_INITIAL_DELAY_MS;
      currentClaim?.unsubscribe();
      currentClaim = undefined;
      if (!threadId) return false;
      return attemptClaim(threadId, claimGeneration, true);
    },
    close() {
      generation++;
      clearRetry();
      currentClaim?.unsubscribe();
      currentClaim = undefined;
    },
  };
}
