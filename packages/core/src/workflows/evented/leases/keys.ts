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
 * Key a run's end claims when it deletes the run's snapshot, because the
 * workflow's `shouldPersistSnapshot` declined to keep the final one. A late
 * step delivery that finds no snapshot reads it to tell an ended run from one
 * that never saved a snapshot.
 */
export function runEndedKey(runId: string): string {
  return `${runId}::ended`;
}

/**
 * Key the end of a nested run claims before it hands its success to the parent
 * step at `executionPath`, so a duplicate of that end continues the parent
 * once. A rerun of the parent step starts a new nested run, with a new key.
 */
export function nestedHandOffKey(parentRunId: string, executionPath: number[], childRunId: string): string {
  return `${stepOccurrenceKey(parentRunId, executionPath)}:from:${childRunId}`;
}

/**
 * How long the keys above stay live. Long enough to outlast the redeliveries and
 * restarts a broker backlog brings after a run moved on, short enough that a
 * reused run ID or retention reclaims them. They are never released.
 */
export const LATE_DELIVERY_MARKER_TTL_MS = 6 * 60 * 60 * 1000;
