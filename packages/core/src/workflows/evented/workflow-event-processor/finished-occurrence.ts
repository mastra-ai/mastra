import { getEntryId } from '../../step-entry';
import type { RestartExecutionParams, StepFlowEntry, StepResult, WorkflowRunState } from '../../types';

type LeafEntry = Extract<StepFlowEntry, { type: 'step' | 'agent' | 'tool' | 'mapping' | 'loop' | 'foreach' }>;
type StoredRecord = { status?: string; startedAt?: number; endedAt?: number; metadata?: Record<string, any> };

const TERMINAL_STATUSES = new Set(['success', 'failed', 'canceled', 'tripwire']);

/**
 * What a worker holding a step occurrence's lease does with its delivery:
 * run the step, drop the delivery because the occurrence already finished and
 * the run moved on, or continue the run from the result the occurrence saved.
 */
export type FinishedOccurrence = 'run' | 'drop' | { continueFrom: StepResult<any, any, any, any> };

function samePath(a: number[] | undefined, b: number[]): boolean {
  return !!a && a.length === b.length && a.every((index, depth) => index === b[depth]);
}

/** The record of one foreach item, kept in the foreach step's resume metadata. */
function foreachItem(result: unknown, index: number | undefined): StoredRecord | undefined {
  if (index === undefined) return undefined;
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
 * Whether `record` ends its occurrence. With step guards (records stamped
 * with `startedBy`), a failed attempt is saved before its retry is published
 * and every loop iteration saves the body's result, so those records do not
 * end the occurrence.
 */
function isFinal(record: StoredRecord | undefined, step: LeafEntry): record is StoredRecord {
  if (!record || typeof record !== 'object' || !TERMINAL_STATUSES.has(record.status!)) return false;
  const stamped = !!record.metadata?.startedBy;
  return !(stamped && (record.status === 'failed' || step.type === 'loop'));
}

/**
 * Decides whether a leaf step occurrence whose lease this worker holds still
 * has to run, from the run's stored snapshot.
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
 * Only a top-level step shows that through the run's active path; a branch
 * continues only when a restart dispatched it, since the restart is then what
 * recovers the run. Any other finished delivery is dropped.
 *
 * Records stamped by the store's step guards are left to those guards on the
 * deliveries they arbitrate (`guarded`), so a delivery never continues the run
 * through both paths.
 */
export function finishedOccurrence({
  step,
  executionPath,
  stepResults,
  restart,
  snapshot,
  guarded,
}: {
  step: LeafEntry;
  executionPath: number[];
  stepResults: Record<string, StepResult<any, any, any, any>> | undefined;
  restart: RestartExecutionParams | undefined;
  snapshot: WorkflowRunState | null | undefined;
  guarded: boolean;
}): FinishedOccurrence {
  const leafId = getEntryId(step.type === 'loop' || step.type === 'foreach' ? step.step : step);
  const stored = snapshot?.context[leafId] as StoredRecord | undefined;
  if (!snapshot || !stored || typeof stored !== 'object') return 'run';
  if (guarded && stored.metadata?.startedBy) return 'run';

  const known = stepResults?.[leafId] as StoredRecord | undefined;
  // Iterations run one after another, so a later one started only after this one finished.
  if (step.type === 'loop' && (stored.metadata?.iterationCount ?? 0) > (known?.metadata?.iterationCount ?? 0)) {
    return 'drop';
  }
  const restartTarget = samePath(restart?.activeStepsPath?.[leafId], executionPath);
  if (step.type === 'foreach') {
    // A foreach restart re-queues only the items that had not finished.
    const item = foreachItem(stored, executionPath[1]);
    if (restartTarget || !isFinal(item, step)) return 'run';
    return sameRecord(item, foreachItem(known, executionPath[1])) ? 'run' : 'drop';
  }
  if (!isFinal(stored, step)) return 'run';
  // A step a restart dispatches was active when the restart read the run, so a terminal record is its own result.
  if (!restartTarget && sameRecord(stored, known)) return 'run';
  // Whoever ended the run also took it past this step.
  if (snapshot.status !== 'running') return 'drop';
  // Continuing a canceled or tripwire result is left to the step itself, as before.
  if (stored.status !== 'success' && stored.status !== 'failed') return restartTarget ? 'run' : 'drop';
  // The next leaf records itself as the active path when it starts. Sibling
  // branches overwrite that path, so it tells only for a top-level step.
  if (executionPath.length === 1) {
    return samePath(snapshot.activePaths, executionPath)
      ? { continueFrom: stored as StepResult<any, any, any, any> }
      : 'drop';
  }
  return restartTarget ? { continueFrom: stored as StepResult<any, any, any, any> } : 'drop';
}
