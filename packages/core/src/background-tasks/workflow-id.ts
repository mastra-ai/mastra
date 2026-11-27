/**
 * Workflow id used by the bg-task workflow registered on Mastra.
 * Double-underscore prefix marks it as internal — same convention as
 * `__batch-scoring-traces`.
 *
 * Lives in its own file (separate from `./workflow`) so `manager.ts` can
 * reference the id without statically pulling in `../workflows/evented`,
 * which would create a circular import via `agent → background-tasks →
 * workflow → evented → workflows/index → agent`.
 */
export const BACKGROUND_TASK_WORKFLOW_ID = '__background-task';

/** Path of the attempt step (inside the attempt loop) in a stored run's steps. */
export const RUN_ATTEMPT_STEP_PATH = `${BACKGROUND_TASK_WORKFLOW_ID}__attempt.run-attempt`;

/**
 * Marks the attempt step's suspend data as an envelope this workflow wrote:
 * the data the run would have saved without one, kept as is, beside the
 * attempt that saved it, which crash recovery checks.
 */
const SUSPEND_ENVELOPE_KEY = '__backgroundTaskSuspension';

/**
 * One attempt at running a task: the worker that claimed it and the
 * `startedAt` it claimed it with. Every claim, retry and resume writes both in
 * one conditional update, and one worker never names two attempts alike (see
 * `nextAttemptStart`), so no two attempts of a task share a name.
 */
export interface TaskAttempt {
  ownerId: string;
  startedAt: number;
}

interface SuspendEnvelope {
  [SUSPEND_ENVELOPE_KEY]: 1;
  /** The attempt that saved the suspension. */
  attempt: TaskAttempt;
  data: unknown;
}

function isSuspendEnvelope(suspendData: unknown): suspendData is SuspendEnvelope {
  return (
    typeof suspendData === 'object' &&
    suspendData !== null &&
    (suspendData as Record<string, unknown>)[SUSPEND_ENVELOPE_KEY] === 1 &&
    isTaskAttempt((suspendData as Record<string, unknown>).attempt)
  );
}

function isTaskAttempt(value: unknown): value is TaskAttempt {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).ownerId === 'string' &&
    typeof (value as Record<string, unknown>).startedAt === 'number'
  );
}

export function suspendEnvelope(data: unknown, attempt: TaskAttempt): SuspendEnvelope {
  return { [SUSPEND_ENVELOPE_KEY]: 1, attempt, data };
}

/** The attempt step's suspend data as the run saved it, out of its envelope if it has one. */
export function unwrapSuspendData(suspendData: unknown): unknown {
  return isSuspendEnvelope(suspendData) ? suspendData.data : suspendData;
}

/**
 * What the tool suspended with, from the attempt step's suspend data. That
 * data may carry the internal `suspendedToolRunId` bridge for a delegated
 * sub-agent (see `workflow.ts`); it is stripped back off.
 */
export function toolSuspendPayload(suspendData: unknown): unknown {
  const data = unwrapSuspendData(suspendData);
  if (!data || typeof data !== 'object' || !('suspendedToolRunId' in data)) return data;
  const { suspendedToolRunId: _bridge, ...rest } = data as Record<string, unknown>;
  return Object.keys(rest).length > 0 ? rest : undefined;
}

/** The attempt that saved a suspension, or `undefined` for data saved without an envelope. */
export function suspendedAttempt(suspendData: unknown): TaskAttempt | undefined {
  return isSuspendEnvelope(suspendData) ? suspendData.attempt : undefined;
}

let lastAttemptStart = Number.NEGATIVE_INFINITY;

/**
 * The `startedAt` for a task's next attempt: later than the task's last one,
 * even when a worker's clock is behind, and never one this process already
 * gave out, even within the same millisecond.
 */
export function nextAttemptStart(previous: Date | undefined): Date {
  lastAttemptStart = Math.max(Date.now(), (previous?.getTime() ?? Number.NEGATIVE_INFINITY) + 1, lastAttemptStart + 1);
  return new Date(lastAttemptStart);
}
