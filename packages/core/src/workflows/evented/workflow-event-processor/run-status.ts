import type { WorkflowRunStatus } from '../../types';

const ENDED_RUN_STATUSES = new Set<string | undefined>(['success', 'failed', 'canceled', 'tripwire']);

/** The statuses of a run that has not ended yet. */
export const UNENDED_RUN_STATUSES: WorkflowRunStatus[] = [
  'running',
  'waiting',
  'suspended',
  'pending',
  'paused',
  'bailed',
  'skipped',
];

/** Whether a run stored with `status` has ended. */
export function isEndedRunStatus(status: string | undefined): boolean {
  return ENDED_RUN_STATUSES.has(status);
}

type EndedRunStatus = 'success' | 'failed' | 'canceled' | 'tripwire';

/** Whether the stored run `run` has ended. */
export function hasRunEnded<T extends { status?: string }>(
  run: T | null | undefined,
): run is T & { status: EndedRunStatus } {
  return !!run && isEndedRunStatus(run.status);
}

/** Whether `executionPath` points past the last entry of `stepGraph`: a step run there ends the run. */
export function isPastLastEntry(stepGraph: readonly unknown[], executionPath: number[] | undefined): boolean {
  return (executionPath?.[0] ?? -1) >= stepGraph.length;
}

/**
 * Whether a step event is the one that ended the stored run `run`, which a worker still handles
 * when the run has ended. Only a successful run has one: its worker stores the end before
 * publishing it and may stop in between, and handling the event again publishes the end. The
 * stored active path names it: the step end the run ended at, or the step run past the last entry.
 * A failed run's end is stored by its own `workflow.fail`, which a redelivery of that event
 * finishes.
 *
 * This can't tell an end that was stored and not published from one that was already handled, so
 * a late copy of the event publishes the end again (and, for a nested run, hands it to the parent
 * again).
 */
export function isRunEndingEvent(
  type: string,
  executionPath: number[] | undefined,
  run: { status?: string; activePaths?: number[] },
  stepGraph: readonly unknown[] | undefined,
): boolean {
  return (
    run.status === 'success' &&
    samePath(run.activePaths, executionPath) &&
    (type === 'workflow.step.end' || (!!stepGraph && isPastLastEntry(stepGraph, executionPath)))
  );
}

/**
 * Whether two execution paths name the same position in the step graph. A missing path matches
 * only another missing path: a run stored without active paths was ended by an event without one.
 */
export function samePath(a: number[] | undefined, b: number[] | undefined): boolean {
  if (!a || !b) return a === b;
  return a.length === b.length && a.every((index, depth) => index === b[depth]);
}
