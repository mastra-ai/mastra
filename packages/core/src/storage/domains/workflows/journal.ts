import type { StepResult, StepSuccess, WorkflowRunState } from '../../../workflows';
import { applyStatePatch, patchState } from './state-patch';
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
 * A step's result is its latest `step` entry, with the later `step-patch` entries for the step
 * applied (see `latestStepResults`). The run's state is a `state` (full) or `state-base` (another
 * run's state version) entry, with the later `state-patch` entries applied. A `state-draft` doesn't
 * change the run's state: it is a version of its live state that nested runs build on (see
 * `materializeState`).
 * @experimental
 */
export type WorkflowRunEntry =
  | { seq: number; kind: 'step'; stepId: string; result: unknown }
  | { seq: number; kind: 'step-patch'; stepId: string; ops: StatePatchOp[] }
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
  /** Opaque stored-run identity, stable until deletion. Distinguishes reused public run IDs. */
  runToken?: string;
  /**
   * The state version the run's current drive started from: the `state` or `state-base` entry its
   * latest checkpoint wrote, or the `seq` a later append passed as `startStateSeq` (a resumed drive).
   * Undefined when the store doesn't track it.
   */
  startStateSeq?: number;
  /** The run's resource id. Only `loadWorkflowRunHeader` returns it. */
  resourceId?: string;
} & StoredStateColumns;

/**
 * Where a storage v2 run's state chain stands, kept on its header row by every write.
 * @experimental
 */
export type StoredStateColumns = {
  /** The `seq` of the run's latest `state`, `state-base` or `state-patch` entry; 0 before its first. */
  stateSeq: number;
  /** The `state-patch` entries after the run's latest `state` or `state-base` entry. */
  statePatchCount: number;
  /** Their summed `JSON.stringify(ops).length`. */
  statePatchBytes: number;
  /**
   * `JSON.stringify(state).length` of the latest `state` entry; null when the latest is a
   * `state-base` (or a deleted base's state copied in its place), so only the patch count applies.
   */
  stateBytes: number | null;
};

/**
 * A storage v2 run as `loadWorkflowRun` returns it.
 * @experimental
 */
export type StoredWorkflowRun = StoredWorkflowRunHeader & {
  /** The run's state, as `materializeState` rebuilds it. */
  state: Record<string, any>;
  /** The latest entry per step, in the order each step was first written. */
  steps: Record<string, StepResult<any, any, any, any> | StepResultSummary>;
  /** Ids in `steps` that hold a summary rather than the full result. */
  summarizedStepIds: string[];
};

/**
 * The header fields of `appendWorkflowRunEntries`. With `header`, the append writes it (with
 * `resourceId` and `threadId`), creating the run if it isn't stored. Without, the append keeps the
 * stored header, only bumping `updatedAt` and shallow-merging `requestContext` into the header's
 * `requestContext`, and writes nothing when the run isn't stored.
 * @experimental
 */
export type WorkflowRunAppendHeader =
  | { header: WorkflowRunHeader; resourceId?: string; threadId?: string; requestContext?: undefined }
  | { header?: undefined; resourceId?: undefined; threadId?: undefined; requestContext?: Record<string, any> };

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
 * Once a run's state has this many patches after its latest `state` or `state-base` entry, its
 * next state write is a full state, so rebuilding the state applies at most this many patches.
 * @experimental
 */
export const STATE_CHECKPOINT_PATCHES = 100;

/**
 * How a write changes a run's `StoredStateColumns`: with `reset`, the state starts over (from a
 * full state of `stateBytes`, or from a state base, `stateBytes` null) and the patch columns become
 * `patchCount` and `patchBytes`; without, `patchCount` and `patchBytes` are added to them.
 * @experimental
 */
export type StateColumnsWrite = { reset: boolean; stateBytes: number | null; patchCount: number; patchBytes: number };

/**
 * The `StateColumnsWrite` of a write's state fields, entered as `writeWorkflowRunCheckpoint` and
 * `appendWorkflowRunEntries` do: the state or state base (a checkpoint with neither starts over at
 * `{}`), then the patch unless a full state was given. Undefined when the write has no state entry.
 * @experimental
 */
export function stateColumnsWrite(
  { state, stateBase, statePatch }: { state?: Record<string, any>; stateBase?: StateRef; statePatch?: StatePatchOp[] },
  checkpoint: boolean,
): StateColumnsWrite | undefined {
  if (state !== undefined)
    return { reset: true, stateBytes: JSON.stringify(state).length, patchCount: 0, patchBytes: 0 };
  const patchCount = statePatch === undefined ? 0 : 1;
  const patchBytes = statePatch === undefined ? 0 : JSON.stringify(statePatch).length;
  if (stateBase !== undefined) return { reset: true, stateBytes: null, patchCount, patchBytes };
  if (checkpoint) return { reset: true, stateBytes: 2, patchCount, patchBytes };
  if (statePatch !== undefined) return { reset: false, stateBytes: null, patchCount, patchBytes };
  return undefined;
}

/**
 * A run's state columns after a write whose last entry is `lastSeq` (a write's state entries come
 * after its steps). `columns` are the run's before it, undefined for a new run.
 * @experimental
 */
export function applyStateColumnsWrite(
  columns: StoredStateColumns | undefined,
  write: StateColumnsWrite | undefined,
  lastSeq: number,
): StoredStateColumns {
  const before = columns ?? { stateSeq: 0, statePatchCount: 0, statePatchBytes: 0, stateBytes: null };
  if (!write) {
    return {
      stateSeq: before.stateSeq,
      statePatchCount: before.statePatchCount,
      statePatchBytes: before.statePatchBytes,
      stateBytes: before.stateBytes,
    };
  }
  if (write.reset) {
    return {
      stateSeq: lastSeq,
      statePatchCount: write.patchCount,
      statePatchBytes: write.patchBytes,
      stateBytes: write.stateBytes,
    };
  }
  return {
    stateSeq: lastSeq,
    statePatchCount: before.statePatchCount + write.patchCount,
    statePatchBytes: before.statePatchBytes + write.patchBytes,
    stateBytes: before.stateBytes,
  };
}

/**
 * Whether a run's state is due a full state entry: `STATE_CHECKPOINT_PATCHES` patches, or patches
 * larger than its latest full state.
 * @experimental
 */
export function isStateCheckpointDue(columns: StoredStateColumns): boolean {
  return (
    columns.statePatchCount >= STATE_CHECKPOINT_PATCHES ||
    (columns.stateBytes !== null && columns.statePatchBytes > columns.stateBytes)
  );
}

/**
 * `state` with only the given top-level keys (all of it without `keys`). Keys it doesn't have are left out.
 * @experimental
 */
export function pickStateKeys(state: Record<string, any>, keys?: readonly string[]): Record<string, any> {
  if (!keys) return state;
  const picked: Record<string, any> = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(state, key)) picked[key] = state[key];
  }
  return picked;
}

type StateChain = {
  /** A full state, another run's state version, or nothing (`{}`). */
  base: Record<string, any> | StateRef | undefined;
  baseIsRef: boolean;
  /** The patches to apply to `base`, in order. */
  patches: StatePatchOp[][];
};

function stateChain(entries: readonly WorkflowRunEntry[], at: StateVersion | undefined): StateChain {
  const drafts: StatePatchOp[][] = [];
  let version = at;
  while (version?.draft) {
    const seq = version.seq;
    const draft = entries.find(entry => entry.seq === seq);
    if (draft?.kind !== 'state-draft') throw new Error(`Storage v2 state draft ${seq} is not stored`);
    if ('state' in draft) return { base: draft.state, baseIsRef: false, patches: drafts.reverse() };
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
  return { base, baseIsRef, patches: [...patches, ...drafts.reverse()] };
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
 * Patches are applied copy-on-write: the result shares what they don't change with `entries` and
 * `base`, which are left as they are.
 * @experimental
 */
export function materializeState(
  entries: readonly WorkflowRunEntry[],
  { at, base }: { at?: StateVersion; base?: Record<string, any> } = {},
): Record<string, any> {
  const chain = stateChain(entries, at);
  const start = (chain.baseIsRef ? base : (chain.base as Record<string, any> | undefined)) ?? {};
  return patchState(start, chain.patches.flat());
}

/**
 * The latest result of each step (only of `stepIds` when given), from a run's entries (in `seq`
 * order), keyed in the order each step was first written: its latest `step` entry, with every later
 * `step-patch` entry for the step applied in order. A patch with no earlier `step` entry for its
 * step is ignored. A patched result is a JSON copy; the others are the entries' own objects.
 * Shared so every adapter rebuilds step results the same way.
 * @experimental
 */
export function latestStepResults(
  entries: readonly WorkflowRunEntry[],
  stepIds?: ReadonlySet<string>,
): Map<string, unknown> {
  // A Map keeps each step at its first write while later entries replace the value.
  const latest = new Map<string, { result: unknown; patches: StatePatchOp[][] }>();
  for (const entry of entries) {
    if (entry.kind === 'step') {
      if (!stepIds || stepIds.has(entry.stepId)) latest.set(entry.stepId, { result: entry.result, patches: [] });
    } else if (entry.kind === 'step-patch') {
      latest.get(entry.stepId)?.patches.push(entry.ops);
    }
  }
  const results = new Map<string, unknown>();
  for (const [stepId, { result, patches }] of latest) {
    if (!patches.length) {
      results.set(stepId, result);
      continue;
    }
    let patched = JSON.parse(JSON.stringify(result));
    for (const ops of patches) patched = applyStatePatch(patched, ops);
    results.set(stepId, patched);
  }
  return results;
}

/**
 * Rebuild a run's `WorkflowRunState` from its storage v2 header and entries (in `seq` order).
 * `latestStepResults` rebuilds `context`, and `materializeState` rebuilds `value` (`base` as there).
 * @experimental
 */
export function materializeWorkflowRun(
  header: WorkflowRunHeader,
  entries: readonly WorkflowRunEntry[],
  base?: Record<string, any>,
): WorkflowRunState {
  const context = Object.fromEntries(latestStepResults(entries));
  return { ...header, context, value: materializeState(entries, { base }) } as WorkflowRunState;
}
