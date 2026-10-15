import type { WorkflowRunState } from '../../../workflows';

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
 * Which entries a storage v2 write appends. Omit it to write a checkpoint, which replaces
 * all of the run's entries with one per `context` key plus the state.
 * @experimental
 */
export type WorkflowRunChanges = { stepIds: string[]; state: boolean };

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
