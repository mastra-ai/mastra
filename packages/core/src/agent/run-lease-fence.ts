/**
 * Checks registered by the thread runtime for runs that hold a cross-process thread
 * lease. A tool awaits its run's check before it executes, so a run whose lease was
 * taken over stops before it acts beside its successor instead of at its next renewal.
 */
const fences = new Map<string, () => Promise<void>>();

export function setRunLeaseFence(runId: string, fence: () => Promise<void>): void {
  fences.set(runId, fence);
}

/**
 * Another runtime in the process (for example a second Mastra instance) may have registered
 * the same run id since, so a run that ends clears only its own check.
 */
export function clearRunLeaseFence(runId: string, fence: () => Promise<void>): void {
  if (fences.get(runId) === fence) fences.delete(runId);
}

/** Throws when the run no longer holds its thread lease. */
export async function verifyRunLease(runId: string | undefined): Promise<void> {
  if (runId) await fences.get(runId)?.();
}
