/**
 * Checks registered by the thread runtime for runs that hold a cross-process thread
 * lease. A tool awaits its run's check before it executes, so a run whose lease was
 * taken over stops before it acts beside its successor instead of at its next renewal.
 */
const fences = new Map<string, () => Promise<void>>();

export function setRunLeaseFence(runId: string, fence: () => Promise<void>): void {
  fences.set(runId, fence);
}

export function clearRunLeaseFence(runId: string): void {
  fences.delete(runId);
}

/** Throws when the run no longer holds its thread lease. */
export async function verifyRunLease(runId: string | undefined): Promise<void> {
  if (runId) await fences.get(runId)?.();
}
