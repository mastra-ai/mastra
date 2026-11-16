import { getEntryId } from '../../step-entry';
import type { RestartExecutionParams, StepResult, WorkflowRunState } from '../../types';
import type { LeafEntry } from './routing';

type StoredRecord = { status?: string; startedAt?: number; endedAt?: number; metadata?: Record<string, any> };

const TERMINAL_STATUSES = new Set(['success', 'failed', 'canceled', 'tripwire']);

/**
 * What a worker does with a delivery of a step occurrence: run the step, drop
 * the delivery because the occurrence already finished and the run moved on,
 * or continue the run from the result the occurrence saved.
 */
export type FinishedOccurrence = 'run' | 'drop' | { continueFrom: StepResult<any, any, any, any> };

/** Whether two execution paths name the same position in the step graph. */
function samePath(a: number[] | undefined, b: number[]): boolean {
  return !!a && a.length === b.length && a.every((index, depth) => index === b[depth]);
}

/** The record of one foreach item, kept in the foreach step's resume metadata. */
function foreachItem(result: unknown, index: number | undefined): StoredRecord | undefined {
  if (index === undefined) {
    return undefined;
  }

  return (result as { suspendPayload?: any } | undefined)?.suspendPayload?.__workflow_meta?.foreachOutput?.[index];
}

/** Whether `stored` is the record the delivery's own step results already held when it was published. */
function sameRecord(stored: StoredRecord, known: StoredRecord | undefined): boolean {
  return (
    !!known &&
    typeof known === 'object' &&
    known.status === stored.status &&
    known.startedAt === stored.startedAt &&
    known.endedAt === stored.endedAt
  );
}

/**
 * Whether `record` ends its occurrence. On a store with step guards a failed
 * attempt is saved before its retry is published, and every loop iteration
 * saves the body's result, so there those records do not end the occurrence.
 */
function isFinal(record: StoredRecord | undefined, step: LeafEntry, stepGuards: boolean): record is StoredRecord {
  if (!record || typeof record !== 'object' || !TERMINAL_STATUSES.has(record.status!)) {
    return false;
  }

  return !(stepGuards && (record.status === 'failed' || step.type === 'loop'));
}

/**
 * Decides whether the leaf step occurrence a delivery names still has to run,
 * from the run's stored snapshot.
 *
 * A delivery can reach a worker after its occurrence finished: a broker
 * redelivery or a message that sat in a backlog while `restart()` ran the step,
 * or a restart that read the snapshot just before the step saved its result.
 * The stored record ends the occurrence when it is terminal and newer than the
 * record the delivery carried, so a step id used twice in one graph still runs
 * its second occurrence. For the steps a restart dispatches, any terminal
 * record ends them. For a loop body, a stored record from a later iteration
 * ends the iteration too. Foreach items are read from the foreach step's
 * per-item records.
 *
 * A finished occurrence continues the run from its saved result while the run
 * has not started a later step, which recovers a run whose worker stopped
 * after the step saved its result and before the next step was published.
 * A top-level step shows that through the run's active path. A branch
 * continues only when a restart dispatched it, since the restart is then what
 * recovers the run, and only while the run's active path is still inside the
 * branch's parallel or conditional entry. Any other finished delivery is
 * dropped.
 *
 * `stepGuards` tells whether the store has workflow step guards. Records they
 * stamped are left to the guards on the deliveries the guards arbitrate
 * (`guarded`), so a delivery never continues the run through both paths.
 */
export function finishedOccurrence({
  step,
  executionPath,
  stepResults,
  restart,
  snapshot,
  stepGuards,
  guarded,
}: {
  step: LeafEntry;
  executionPath: number[];
  stepResults: Record<string, StepResult<any, any, any, any>> | undefined;
  restart: RestartExecutionParams | undefined;
  snapshot: WorkflowRunState | null | undefined;
  stepGuards: boolean;
  guarded: boolean;
}): FinishedOccurrence {
  const leafId = getEntryId(step.type === 'loop' || step.type === 'foreach' ? step.step : step);
  const stored = snapshot?.context[leafId] as StoredRecord | undefined;

  // Nothing stored to compare against (a run that saves no snapshot, or one deleted at its end).
  if (!snapshot || !stored || typeof stored !== 'object') {
    return 'run';
  }

  // The step guards arbitrate this delivery on their own records; deciding here as well could
  // continue the run twice.
  if (guarded && stored.metadata?.startedBy) {
    return 'run';
  }

  const known = stepResults?.[leafId] as StoredRecord | undefined;

  // Iterations run one after another, so a later one started only after this one finished.
  if (step.type === 'loop' && (stored.metadata?.iterationCount ?? 0) > (known?.metadata?.iterationCount ?? 0)) {
    return 'drop';
  }

  const restartTarget = samePath(restart?.activeStepsPath?.[leafId], executionPath);

  // Items never continue the run from here: the foreach coordinator owns that, and a foreach
  // restart re-queues only the items that had not finished.
  if (step.type === 'foreach') {
    const item = foreachItem(stored, executionPath[1]);
    if (restartTarget || !isFinal(item, step, stepGuards)) {
      return 'run';
    }

    return sameRecord(item, foreachItem(known, executionPath[1])) ? 'run' : 'drop';
  }

  if (!isFinal(stored, step, stepGuards)) {
    return 'run';
  }

  // The delivery already carried this terminal record, so it belongs to an earlier occurrence of
  // the same step id. A step a restart dispatches was active when the restart read the run, so
  // there a terminal record is the step's own result.
  if (!restartTarget && sameRecord(stored, known)) {
    return 'run';
  }

  // Whoever ended the run also took it past this step.
  if (snapshot.status !== 'running') {
    return 'drop';
  }

  // Only success and failed results continue the run here. A restart reruns a canceled or
  // tripwire step, and any other delivery is dropped.
  if (stored.status !== 'success' && stored.status !== 'failed') {
    return restartTarget ? 'run' : 'drop';
  }

  // The next leaf records itself as the active path when it starts. Sibling branches overwrite
  // that path, so for a branch it only tells whether the run went past the branch's parallel or
  // conditional entry, and only a restart (the run's recovery) continues from a branch.
  const notMovedOn =
    executionPath.length === 1
      ? samePath(snapshot.activePaths, executionPath)
      : restartTarget && snapshot.activePaths?.[0] === executionPath[0];

  return notMovedOn ? { continueFrom: stored as StepResult<any, any, any, any> } : 'drop';
}
