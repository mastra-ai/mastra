import type { StepResult, StepSuccess, WorkflowRunState } from '../../../workflows';

/**
 * A storage v2 run header: the run's `WorkflowRunState` without `context` and `value`,
 * which are stored as entries.
 * @experimental
 */
export type WorkflowRunHeader = Omit<WorkflowRunState, 'context' | 'value'>;

/**
 * One storage v2 entry. A run's entries are append-only and ordered by `seq`, which only
 * increases within a run.
 * @experimental
 */
export type WorkflowRunEntry =
  | { seq: number; kind: 'step'; stepId: string; result: unknown }
  | { seq: number; kind: 'state'; state: Record<string, any> };

/**
 * A successful step result without its data (`output`, `payload` and the suspend/resume
 * payloads).
 * @experimental
 */
export type StepResultSummary = Pick<
  StepSuccess<any, any, any, any>,
  'status' | 'startedAt' | 'endedAt' | 'suspendedAt' | 'resumedAt' | 'metadata'
>;

/**
 * A storage v2 run's header, and the `seq` of its latest entry.
 * @experimental
 */
export type StoredWorkflowRunHeader = { header: WorkflowRunHeader; lastSeq: number };

/**
 * A storage v2 run as `loadWorkflowRun` returns it.
 * @experimental
 */
export type StoredWorkflowRun = StoredWorkflowRunHeader & {
  /** The latest state entry. */
  state: Record<string, any>;
  /** The latest entry per step, in the order each step was first written. */
  steps: Record<string, StepResult<any, any, any, any> | StepResultSummary>;
  /** Ids in `steps` that hold a summary rather than the full result. */
  summarizedStepIds: string[];
};

/**
 * The fields of a successful step result that its summary keeps. Exported for adapters that
 * summarize in their query rather than with `summarizeStepResult`.
 * @experimental
 */
export const STEP_RESULT_SUMMARY_FIELDS = [
  'status',
  'startedAt',
  'endedAt',
  'suspendedAt',
  'resumedAt',
  'metadata',
] as const satisfies readonly (keyof StepResultSummary)[];

/**
 * The summary of a successful step result. Shared so every adapter summarizes the same way.
 * @experimental
 */
export function summarizeStepResult(result: StepResultSummary): StepResultSummary {
  const summary: Record<string, unknown> = {};
  for (const field of STEP_RESULT_SUMMARY_FIELDS) {
    if (result[field] !== undefined) summary[field] = result[field];
  }
  return summary as StepResultSummary;
}

/**
 * Rebuild a run's `WorkflowRunState` from its storage v2 header and entries (in `seq` order).
 * Each step's latest entry wins, and the latest state entry becomes `value`.
 * @experimental
 */
export function materializeWorkflowRun(
  header: WorkflowRunHeader,
  entries: readonly WorkflowRunEntry[],
): WorkflowRunState {
  const context: Record<string, unknown> = {};
  let value: Record<string, any> = {};
  for (const entry of entries) {
    if (entry.kind === 'step') {
      context[entry.stepId] = entry.result;
    } else {
      value = entry.state;
    }
  }
  return { ...header, context, value } as WorkflowRunState;
}
