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
 * What the tool suspended with, from the attempt step's suspend data. That
 * data may carry the internal `suspendedToolRunId` bridge for a delegated
 * sub-agent (see `workflow.ts`); it is stripped back off.
 */
export function toolSuspendPayload(suspendData: unknown): unknown {
  if (!suspendData || typeof suspendData !== 'object' || !('suspendedToolRunId' in suspendData)) return suspendData;
  const { suspendedToolRunId: _bridge, ...rest } = suspendData as Record<string, unknown>;
  return Object.keys(rest).length > 0 ? rest : undefined;
}
