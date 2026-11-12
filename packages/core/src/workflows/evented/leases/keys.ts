/**
 * Storage keys of the evented engine's leases, kept apart so every lease module
 * and test builds them the same way.
 */

/**
 * Lease key of one step occurrence: the run, the step's execution path (which
 * includes the foreach item index) and, for a loop body, the iteration.
 * Retries of an occurrence share its key.
 */
export function stepOccurrenceKey(runId: string, executionPath: number[], iterationCount?: number): string {
  const iteration = iterationCount === undefined ? '' : `:i${iterationCount}`;
  return `${runId}::step:${executionPath.join('.')}${iteration}`;
}

/** Lease key `restart()` claims so concurrent restarts of one run publish once. */
export function restartLeaseKey(runId: string): string {
  return `${runId}::restart`;
}

/**
 * Lease key that stays live while any worker runs a step of the run, and for
 * one lease TTL after the last one stopped. `restart()` reads it to tell a run
 * in progress from an orphaned one, including the gap between one step's
 * release and the next step's claim.
 */
export function runLivenessKey(runId: string): string {
  return `${runId}::live`;
}

/**
 * Lease key of one sleep occurrence: the sleep's step key and the time the
 * occurrence started, so a sleep started again (time travel, a sleep recorded
 * without a wake time) gets a new key.
 */
export function sleepOccurrenceKey(runId: string, executionPath: number[], startedAt: number): string {
  return `${stepOccurrenceKey(runId, executionPath)}:sleep${startedAt}`;
}

/**
 * Lease key that serializes starting and resuming the sleep at `executionPath`
 * of `runId`, so concurrent deliveries of its event set up one occurrence.
 */
export function sleepStartKey(runId: string, executionPath: number[]): string {
  return `${stepOccurrenceKey(runId, executionPath)}:sleep-start`;
}
