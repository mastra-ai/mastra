import type { StepResult, StepSuccess, WorkflowRunState } from '../../../workflows';
import { applyStatePatch } from './state-patch';
import type { StatePatchOp } from './state-patch';

/**
 * A storage v2 run header: the run's `WorkflowRunState` without `context` and `value`,
 * which are stored as entries.
 * @experimental
 */
export type WorkflowRunHeader = Omit<WorkflowRunState, 'context' | 'value'>;

/**
 * One storage v2 entry. A run's entries are append-only and ordered by `seq`, which only
 * increases within a run. `state` holds the full run state, `state-patch` the changes since the
 * previous state (see `materializeState`).
 * @experimental
 */
export type WorkflowRunEntry =
  | { seq: number; kind: 'step'; stepId: string; result: unknown }
  | { seq: number; kind: 'state'; state: Record<string, any> }
  | { seq: number; kind: 'state-patch'; ops: StatePatchOp[] };

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
  /** The run's state, as `materializeState` rebuilds it. */
  state: Record<string, any>;
  /** The size of the patches `state` applies after its base (see `materializeState`). */
  statePatchBytes: number;
  /** The latest entry per step, in the order each step was first written. */
  steps: Record<string, StepResult<any, any, any, any> | StepResultSummary>;
  /** Ids in `steps` that hold a summary rather than the full result. */
  summarizedStepIds: string[];
};

const SUMMARY_FIELDS = ['status', 'startedAt', 'endedAt', 'suspendedAt', 'resumedAt', 'metadata'] as const;

/**
 * The summary of a successful step result. Shared so every adapter summarizes the same way.
 * @experimental
 */
export function summarizeStepResult(result: StepResultSummary): StepResultSummary {
  const summary: Record<string, unknown> = {};
  for (const field of SUMMARY_FIELDS) {
    if (result[field] !== undefined) summary[field] = result[field];
  }
  return summary as StepResultSummary;
}

/**
 * Whether a run's state starts from its parent's: true when its entries hold no full `state`.
 * Every run that doesn't inherit stores a full state when it starts, so for a nested run (one with
 * `header.parentWorkflow`) this means it inherits. Stores resolve the parent's state only then.
 * @experimental
 */
export function inheritsState(entries: readonly WorkflowRunEntry[]): boolean {
  return !entries.some(entry => entry.kind === 'state');
}

/**
 * Rebuild a run's state from its entries (in `seq` order): the latest full `state` entry, with
 * every later `state-patch` applied in order. Without a full `state` entry, the patches apply to
 * `parentState`, the state of the run in `header.parentWorkflow` (rebuilt by this same rule), or to
 * `{}` for a run without a parent. Patches are applied to a JSON copy, so the result never shares
 * objects with `entries` or `parentState` once a patch applies (it can when none does).
 *
 * `statePatchBytes` is the summed `JSON.stringify(ops).length` of the applied patches.
 * @experimental
 */
export function materializeState(
  entries: readonly WorkflowRunEntry[],
  parentState?: Record<string, any>,
): { state: Record<string, any>; statePatchBytes: number } {
  let base = parentState ?? {};
  let patches: StatePatchOp[][] = [];
  for (const entry of entries) {
    if (entry.kind === 'state') {
      base = entry.state;
      patches = [];
    } else if (entry.kind === 'state-patch') {
      patches.push(entry.ops);
    }
  }
  if (patches.length === 0) return { state: base, statePatchBytes: 0 };
  let state = JSON.parse(JSON.stringify(base));
  let statePatchBytes = 0;
  for (const ops of patches) {
    state = applyStatePatch(state, ops);
    statePatchBytes += JSON.stringify(ops).length;
  }
  return { state, statePatchBytes };
}

/**
 * Rebuild a run's `WorkflowRunState` from its storage v2 header and entries (in `seq` order).
 * Each step's latest entry wins, and `materializeState` rebuilds `value` (`parentState` is only
 * used when `inheritsState(entries)`).
 * @experimental
 */
export function materializeWorkflowRun(
  header: WorkflowRunHeader,
  entries: readonly WorkflowRunEntry[],
  parentState?: Record<string, any>,
): WorkflowRunState {
  const context: Record<string, unknown> = {};
  for (const entry of entries) {
    if (entry.kind === 'step') context[entry.stepId] = entry.result;
  }
  return { ...header, context, value: materializeState(entries, parentState).state } as WorkflowRunState;
}
