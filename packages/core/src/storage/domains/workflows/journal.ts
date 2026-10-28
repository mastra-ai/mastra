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
 * A version of a run's state: its state as of `seq`, or with `draft`, the draft written at `seq`.
 * @experimental
 */
export type StateVersion = { seq: number; draft?: true };

/**
 * A version of a named run's state, which a nested run's state builds on.
 * @experimental
 */
export type StateRef = StateVersion & { workflowName: string; runId: string };

/**
 * One storage v2 entry. A run's entries are append-only and ordered by `seq`, which only
 * increases within a run, also across checkpoints.
 *
 * The run's state is a `state` (full) or `state-base` (another run's state version) entry, with
 * the later `state-patch` entries applied. A `state-draft` doesn't change the run's state: it is a
 * version of its live state that nested runs build on (see `materializeState`).
 * @experimental
 */
export type WorkflowRunEntry =
  | { seq: number; kind: 'step'; stepId: string; result: unknown }
  | { seq: number; kind: 'state'; state: Record<string, any> }
  | { seq: number; kind: 'state-patch'; ops: StatePatchOp[] }
  | { seq: number; kind: 'state-base'; base: StateRef }
  | { seq: number; kind: 'state-draft'; on: StateVersion; ops: StatePatchOp[] }
  | { seq: number; kind: 'state-draft'; state: Record<string, any> };

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
export type StoredWorkflowRunHeader = {
  header: WorkflowRunHeader;
  lastSeq: number;
  /**
   * The state version the run's current drive started from: the `state` or `state-base` entry its
   * latest checkpoint wrote, or the `seq` a later append passed as `startStateSeq` (a resumed drive).
   * Undefined when the store doesn't track it.
   */
  startStateSeq?: number;
};

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

type StateChain = {
  /** A full state, another run's state version, or nothing (`{}`). */
  base: Record<string, any> | StateRef | undefined;
  baseIsRef: boolean;
  /** The patches to apply to `base`, in order. */
  patches: StatePatchOp[][];
  /** JSON size of the run's own (not draft) patches. */
  patchBytes: number;
};

function stateChain(entries: readonly WorkflowRunEntry[], at: StateVersion | undefined): StateChain {
  const drafts: StatePatchOp[][] = [];
  let version = at;
  while (version?.draft) {
    const seq = version.seq;
    const draft = entries.find(entry => entry.seq === seq);
    if (draft?.kind !== 'state-draft') throw new Error(`Storage v2 state draft ${seq} is not stored`);
    if ('state' in draft) return { base: draft.state, baseIsRef: false, patches: drafts.reverse(), patchBytes: 0 };
    drafts.push(draft.ops);
    version = draft.on;
  }
  const upTo = version?.seq ?? Infinity;
  let base: StateChain['base'];
  let baseIsRef = false;
  let patches: StatePatchOp[][] = [];
  for (const entry of entries) {
    if (entry.seq > upTo) break;
    if (entry.kind === 'state' || entry.kind === 'state-base') {
      base = entry.kind === 'state' ? entry.state : entry.base;
      baseIsRef = entry.kind === 'state-base';
      patches = [];
    } else if (entry.kind === 'state-patch') {
      patches.push(entry.ops);
    }
  }
  const patchBytes = patches.reduce((sum, ops) => sum + JSON.stringify(ops).length, 0);
  return { base, baseIsRef, patches: [...patches, ...drafts.reverse()], patchBytes };
}

/**
 * The other run's state version that a run's state (as of `at`, or latest) builds on, if any.
 * Stores resolve it (by this same rule) and pass it to `materializeState` as `base`.
 * @experimental
 */
export function stateBaseOf(entries: readonly WorkflowRunEntry[], at?: StateVersion): StateRef | undefined {
  const chain = stateChain(entries, at);
  return chain.baseIsRef ? (chain.base as StateRef) : undefined;
}

/**
 * Rebuild a run's state from its entries (in `seq` order).
 *
 * The latest state (no `at`), or the state as of a `seq`, is the latest `state` or `state-base`
 * entry up to it, with every later `state-patch` up to it applied in order. Drafts are left out. A
 * `state-base` entry's state is `base`, the state the store resolved for `stateBaseOf(entries, at)`.
 * The state of a draft is the version it is `on`, with its patch applied (or its full `state`).
 *
 * Patches are applied to a JSON copy, so the result never shares objects with `entries` or `base`
 * once a patch applies (it can when none does). `statePatchBytes` is the summed
 * `JSON.stringify(ops).length` of the run's own patches applied (drafts excluded).
 * @experimental
 */
export function materializeState(
  entries: readonly WorkflowRunEntry[],
  { at, base }: { at?: StateVersion; base?: Record<string, any> } = {},
): { state: Record<string, any>; statePatchBytes: number } {
  const chain = stateChain(entries, at);
  const start = (chain.baseIsRef ? base : (chain.base as Record<string, any> | undefined)) ?? {};
  if (chain.patches.length === 0) return { state: start, statePatchBytes: 0 };
  let state = JSON.parse(JSON.stringify(start));
  for (const ops of chain.patches) state = applyStatePatch(state, ops);
  return { state, statePatchBytes: chain.patchBytes };
}

/**
 * Rebuild a run's `WorkflowRunState` from its storage v2 header and entries (in `seq` order).
 * Each step's latest entry wins, and `materializeState` rebuilds `value` (`base` as there).
 * @experimental
 */
export function materializeWorkflowRun(
  header: WorkflowRunHeader,
  entries: readonly WorkflowRunEntry[],
  base?: Record<string, any>,
): WorkflowRunState {
  const context: Record<string, unknown> = {};
  for (const entry of entries) {
    if (entry.kind === 'step') context[entry.stepId] = entry.result;
  }
  return { ...header, context, value: materializeState(entries, { base }).state } as WorkflowRunState;
}
