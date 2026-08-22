export interface ThreadOwnershipClaim {
  unsubscribe(): void;
}

export function createThreadOwnershipManager(claimThread: (threadId: string) => Promise<ThreadOwnershipClaim>): {
  claim(threadId?: string | null): Promise<void>;
  close(): void;
} {
  let generation = 0;
  let currentClaim: ThreadOwnershipClaim | undefined;

  return {
    async claim(threadId) {
      const claimGeneration = ++generation;
      currentClaim?.unsubscribe();
      currentClaim = undefined;
      if (!threadId) return;

      const nextClaim = await claimThread(threadId);
      if (claimGeneration !== generation) {
        nextClaim.unsubscribe();
        return;
      }
      currentClaim = nextClaim;
    },
    close() {
      generation++;
      currentClaim?.unsubscribe();
      currentClaim = undefined;
    },
  };
}
