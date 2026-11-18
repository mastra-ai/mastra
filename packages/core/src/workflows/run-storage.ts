import type { WorkflowsStorage } from '../storage/domains/workflows/base';
import type { StateRef, StepResultSummary, WorkflowRunHeader } from '../storage/domains/workflows/journal';
import { pickStateKeys } from '../storage/domains/workflows/journal';
import { getSnapshotMemoryInfo } from '../storage/domains/workflows/snapshot-memory-info';
import type { StatePatchOp } from '../storage/domains/workflows/state-patch';
import type { UpdateWorkflowStateOptions } from '../storage/types';
import type { WorkflowStepCompletionGuard, WorkflowStepStartGuard } from '../storage/workflow-step-guard';
import { stubStepResult } from './run-journal';
import type { StepResult, WorkflowRunState } from './types';
import { waitForSuspendedSnapshot } from './utils';

/**
 * Every store call a run makes, for the run's storage version. Call sites make the same call for
 * both versions, so a storage v2 run never reaches a v1 store method.
 *
 * @internal
 */
export interface RunStorage {
  loadHeader(): Promise<WorkflowRunHeader | null>;
  /** The run's header as stored after the update, or null when the compare-and-set didn't apply. */
  updateHeader(opts: UpdateWorkflowStateOptions): Promise<WorkflowRunHeader | null>;
  /** What resume needs. v2 returns successful steps as stubs. `wait` polls while running/pending. */
  loadForResume(opts: { wait: boolean }): Promise<WorkflowRunState | null>;
  /** Fully materialized, for restart and time travel. */
  loadFull(): Promise<WorkflowRunState | null>;
  /**
   * Replaces the stored run: the pending/waiting snapshot written before the engine runs, or a
   * pruned one. With `stateBase` (a storage v2 nested run starting from a stored version of its
   * parent's state), the state is stored as that version instead of a copy.
   */
  writeSnapshot(snapshot: WorkflowRunState, resourceId?: string, opts?: { stateBase?: StateRef }): Promise<void>;
  /** After a claim: has nothing been written to the run since `claimed` was loaded? */
  isClaimUnused(claimed: WorkflowRunState, resumedStepId: string): Promise<boolean>;
  /**
   * What the store reported for the state of a snapshot loaded by `loadForResume` or `loadFull`:
   * the run's `lastSeq` it is as of, its `statePatchBytes` and its `statePatchCount`.
   */
  storedState(
    snapshot: WorkflowRunState,
  ): { seq: number; patchBytes: number; patchCount: number; runToken?: string } | undefined;
  /**
   * The state the run's current drive started from: as of its latest checkpoint, or as of the
   * resume that started the drive. Undefined for v1, or when the run or that version isn't stored.
   */
  loadDriveStartState(): Promise<Record<string, any> | undefined>;

  // The evented engine's operations.

  loadResourceId(): Promise<string | undefined>;
  /** The header and `stepId`'s result. v1 loads every step. */
  loadStep(stepId: string): Promise<StepSnapshot | null>;
  /**
   * The latest results of `stepIds` (steps without one left out), among the run's writes up to
   * `upToSeq` (a `seq` a write returned) on v2. v1 loads every step and ignores `upToSeq`.
   */
  loadSteps(stepIds: string[], opts?: { upToSeq?: number }): Promise<StepResults>;
  /** The run's latest stored state, with only the top-level `keys` when given. `{}` when the run isn't stored. */
  loadState(keys?: string[]): Promise<Record<string, any>>;
  /** `state` (v1) or `statePatch` (v2) is written in the same write. */
  writeStepResult(write: StepResultWrite): Promise<StepWriteResult | undefined>;
  /** A foreach step's write: the store merges `result.output` into the stored array by index. */
  mergeStepResult(write: StepResultWrite): Promise<StepWriteResult | undefined>;
  writeState(write: StateWrite & { requestContext: Record<string, any> }): Promise<void>;
  delete(): Promise<void>;
}

type StepResults = Record<string, StepResult<any, any, any, any>>;

type StepSnapshot = WorkflowRunHeader & { context: WorkflowRunState['context'] };

/** v1 writes the full state, v2 a patch on the stored state, so concurrent writers keep each other's keys. */
type StateWrite = { state?: Record<string, any>; statePatch?: StatePatchOp[] };

type StepResultWrite = StateWrite & {
  stepId: string;
  result: StepResult<any, any, any, any>;
  requestContext: Record<string, any>;
  /** The store rejects the write unless this delivery may start the step (not on v2's `mergeStepResult`). */
  startGuard?: WorkflowStepStartGuard;
  /** The store rejects the write unless this delivery owns the running step (not on v2's `mergeStepResult`). */
  completionGuard?: WorkflowStepCompletionGuard;
};

/**
 * After a step write: v1 returns every step's result, v2 the written step's (merged, for
 * `mergeStepResult`) and the run's `lastSeq`. `results` is `{}` when the run isn't stored; the
 * whole result is undefined without a store.
 */
type StepWriteResult = { results: StepResults; seq?: number };

type RunStorageArgs = {
  workflowName: string;
  runId: string;
  /** Resolved per call, so a run built before Mastra has storage still finds it later. */
  getStore(): Promise<WorkflowsStorage | undefined>;
};

/** @internal */
export function createRunStorage({ storageVersion, ...args }: RunStorageArgs & { storageVersion: 1 | 2 }): RunStorage {
  return storageVersion === 2 ? new RunStorageV2(args) : new RunStorageV1(args);
}

class RunStorageV1 implements RunStorage {
  readonly #workflowName: string;
  readonly #runId: string;
  readonly #getStore: () => Promise<WorkflowsStorage | undefined>;

  constructor({ workflowName, runId, getStore }: RunStorageArgs) {
    this.#workflowName = workflowName;
    this.#runId = runId;
    this.#getStore = getStore;
  }

  async #load(store: WorkflowsStorage | undefined): Promise<WorkflowRunState | null> {
    return (
      (await store?.loadWorkflowSnapshot({
        workflowName: this.#workflowName,
        runId: this.#runId,
        storageVersion: 1,
      })) ?? null
    );
  }

  async loadHeader(): Promise<WorkflowRunHeader | null> {
    return this.#load(await this.#getStore());
  }

  async updateHeader(opts: UpdateWorkflowStateOptions): Promise<WorkflowRunHeader | null> {
    const store = await this.#getStore();
    const updated = await store?.updateWorkflowState({
      workflowName: this.#workflowName,
      runId: this.#runId,
      storageVersion: 1,
      opts,
    });
    return updated ?? null;
  }

  async loadForResume({ wait }: { wait: boolean }): Promise<WorkflowRunState | null> {
    const store = await this.#getStore();
    if (!wait) return this.#load(store);
    return waitForSuspendedSnapshot(
      store && { loadWorkflowSnapshot: () => this.#load(store) },
      this.#workflowName,
      this.#runId,
    );
  }

  async loadFull(): Promise<WorkflowRunState | null> {
    return this.#load(await this.#getStore());
  }

  async writeSnapshot(snapshot: WorkflowRunState, resourceId?: string): Promise<void> {
    const store = await this.#getStore();
    await store?.persistWorkflowSnapshot({
      workflowName: this.#workflowName,
      runId: this.#runId,
      resourceId,
      snapshot,
    });
  }

  async isClaimUnused(claimed: WorkflowRunState, resumedStepId: string): Promise<boolean> {
    const current = await this.#load(await this.#getStore());

    const claimedPaths = Object.keys(claimed.suspendedPaths ?? {});
    const currentPaths = Object.keys(current?.suspendedPaths ?? {});
    const claimedStepIds = Object.keys(claimed.context ?? {});
    const currentStepIds = Object.keys(current?.context ?? {});
    const resumedStepResult = current?.context?.[resumedStepId] as { status?: string } | undefined;

    // Every one of these must still look exactly as it did at claim time. The status alone
    // is not enough evidence: the engine deliberately suppresses `running` step persists
    // while the last persisted status is `suspended`, so a run that failed midway can still
    // read back as `running`.
    return (
      current?.status === 'running' &&
      currentPaths.length === claimedPaths.length &&
      claimedPaths.every(path => currentPaths.includes(path)) &&
      currentStepIds.length === claimedStepIds.length &&
      claimedStepIds.every(stepId => currentStepIds.includes(stepId)) &&
      resumedStepResult?.status === 'suspended'
    );
  }

  storedState(): undefined {
    return undefined;
  }

  async loadResourceId(): Promise<string | undefined> {
    const store = await this.#getStore();
    const run = await store?.getWorkflowRunById({
      workflowName: this.#workflowName,
      runId: this.#runId,
      storageVersion: 1,
    });
    return run?.resourceId;
  }

  async loadStep(): Promise<StepSnapshot | null> {
    return this.#load(await this.#getStore());
  }

  async loadSteps(stepIds: string[]): Promise<StepResults> {
    const context = (await this.#load(await this.#getStore()))?.context ?? {};
    return Object.fromEntries(stepIds.filter(id => context[id]).map(id => [id, context[id] as StepResults[string]]));
  }

  async loadState(keys?: string[]): Promise<Record<string, any>> {
    const snapshot = await this.#load(await this.#getStore());
    // The evented engine keeps a v1 run's latest state in its `__state` pseudo-step.
    return pickStateKeys((snapshot?.context?.__state as Record<string, any>) ?? snapshot?.value ?? {}, keys);
  }

  async writeStepResult({
    stepId,
    result,
    requestContext,
    state,
    statePatch,
    startGuard,
    completionGuard,
  }: StepResultWrite): Promise<StepWriteResult | undefined> {
    if (statePatch) throw new Error('Storage v1 runs write the whole state, not a patch');
    const store = await this.#getStore();
    const results = await store?.updateWorkflowResults({
      workflowName: this.#workflowName,
      runId: this.#runId,
      stepId,
      result,
      requestContext,
      ...(state !== undefined ? { state } : {}),
      ...(startGuard ? { startGuard } : {}),
      ...(completionGuard ? { completionGuard } : {}),
    });
    return results && { results };
  }

  mergeStepResult(write: StepResultWrite): Promise<StepWriteResult | undefined> {
    // v1 stores already merge a foreach result's array by index.
    return this.writeStepResult(write);
  }

  async writeState({ state, statePatch, requestContext }: StateWrite & { requestContext: Record<string, any> }) {
    if (statePatch) throw new Error('Storage v1 runs write the whole state, not a patch');
    // Passing `state` makes the store replace `__state` whole instead of merging it like a step result.
    await this.writeStepResult({
      stepId: '__state',
      result: state as StepResult<any, any, any, any>,
      requestContext,
      state,
    });
  }

  async delete(): Promise<void> {
    const store = await this.#getStore();
    await store?.deleteWorkflowRunById({ workflowName: this.#workflowName, runId: this.#runId });
  }

  async loadDriveStartState(): Promise<undefined> {
    return undefined;
  }
}

// Keyed by the loaded snapshot, not the RunStorage: the parent-claim path loads a parent's
// snapshot through a throwaway RunStorage, and the parent Run's own RunStorage releases it.
const claimedSeqs = new WeakMap<WorkflowRunState, number>();
const storedStates = new WeakMap<
  WorkflowRunState,
  { seq: number; patchBytes: number; patchCount: number; runToken?: string }
>();

class RunStorageV2 implements RunStorage {
  readonly #workflowName: string;
  readonly #runId: string;
  readonly #getStore: () => Promise<WorkflowsStorage | undefined>;

  constructor({ workflowName, runId, getStore }: RunStorageArgs) {
    this.#workflowName = workflowName;
    this.#runId = runId;
    this.#getStore = getStore;
  }

  async #loadSummary(store: WorkflowsStorage): Promise<WorkflowRunState | null> {
    const run = await store.loadWorkflowRun({
      workflowName: this.#workflowName,
      runId: this.#runId,
      successfulSteps: 'summary',
    });
    if (!run) return null;
    const context: Record<string, unknown> = { ...run.steps };
    for (const stepId of run.summarizedStepIds) {
      context[stepId] = stubStepResult(run.steps[stepId] as StepResultSummary);
    }
    const snapshot = { ...run.header, context, value: run.state } as WorkflowRunState;
    claimedSeqs.set(snapshot, run.lastSeq);
    storedStates.set(snapshot, {
      seq: run.lastSeq,
      patchBytes: run.statePatchBytes,
      patchCount: run.statePatchCount,
      runToken: run.runToken,
    });
    return snapshot;
  }

  async loadHeader(): Promise<WorkflowRunHeader | null> {
    const store = await this.#getStore();
    const stored = await store?.loadWorkflowRunHeader({ workflowName: this.#workflowName, runId: this.#runId });
    return stored?.header ?? null;
  }

  async updateHeader(opts: UpdateWorkflowStateOptions): Promise<WorkflowRunHeader | null> {
    const store = await this.#getStore();
    const updated = await store?.updateWorkflowRunHeader({
      workflowName: this.#workflowName,
      runId: this.#runId,
      opts,
    });
    return updated?.header ?? null;
  }

  async loadForResume({ wait }: { wait: boolean }): Promise<WorkflowRunState | null> {
    const store = await this.#getStore();
    if (!store) return null;
    if (!wait) return this.#loadSummary(store);
    return waitForSuspendedSnapshot(
      { loadWorkflowSnapshot: () => this.#loadSummary(store) },
      this.#workflowName,
      this.#runId,
    );
  }

  async loadFull(): Promise<WorkflowRunState | null> {
    const store = await this.#getStore();
    const run = await store?.loadWorkflowRun({
      workflowName: this.#workflowName,
      runId: this.#runId,
      successfulSteps: 'full',
    });
    if (!run) return null;
    const snapshot = { ...run.header, context: run.steps, value: run.state } as WorkflowRunState;
    storedStates.set(snapshot, {
      seq: run.lastSeq,
      patchBytes: run.statePatchBytes,
      patchCount: run.statePatchCount,
      runToken: run.runToken,
    });
    return snapshot;
  }

  async writeSnapshot(
    snapshot: WorkflowRunState,
    resourceId?: string,
    { stateBase }: { stateBase?: StateRef } = {},
  ): Promise<void> {
    const store = await this.#getStore();
    // The evented engine keeps its state in `context.__state`; on v2 that's the run's state, not a step.
    const { context, value, ...header } = snapshot;
    const { __state: _state, ...steps } = context as Record<string, any>;
    await store?.writeWorkflowRunCheckpoint({
      workflowName: this.#workflowName,
      runId: this.#runId,
      resourceId,
      threadId: getSnapshotMemoryInfo(snapshot)?.threadId,
      header,
      steps: steps as WorkflowRunState['context'],
      ...(stateBase ? { stateBase } : { state: value }),
    });
  }

  storedState(
    snapshot: WorkflowRunState,
  ): { seq: number; patchBytes: number; patchCount: number; runToken?: string } | undefined {
    return storedStates.get(snapshot);
  }

  async loadDriveStartState(): Promise<Record<string, any> | undefined> {
    const store = await this.#getStore();
    const args = { workflowName: this.#workflowName, runId: this.#runId };
    const seq = (await store?.loadWorkflowRunHeader(args))?.startStateSeq;
    if (seq === undefined) return undefined;
    return (await store!.loadWorkflowRunState({ ...args, seq })) ?? undefined;
  }

  async isClaimUnused(claimed: WorkflowRunState, resumedStepId: string): Promise<boolean> {
    // Without the seq it was claimed at, the run may have written since. A run stuck `running`
    // is safer than re-arming a suspension whose downstream steps may have fired.
    const claimedSeq = claimedSeqs.get(claimed);
    if (claimedSeq === undefined) return false;
    // With no write since the claim, the resumed step's stored result is the claimed one.
    if ((claimed.context?.[resumedStepId] as { status?: string } | undefined)?.status !== 'suspended') return false;

    const store = await this.#getStore();
    const current = await store?.loadWorkflowRunHeader({ workflowName: this.#workflowName, runId: this.#runId });
    if (!current) return false;

    // Every step write appends an entry, so an unchanged `lastSeq` proves no step was written.
    // The engine's first write also clears `suspendedPaths`, even when it appends no step.
    const claimedPaths = Object.keys(claimed.suspendedPaths ?? {});
    const currentPaths = Object.keys(current.header.suspendedPaths ?? {});
    return (
      current.header.status === 'running' &&
      current.lastSeq === claimedSeq &&
      currentPaths.length === claimedPaths.length &&
      claimedPaths.every(path => currentPaths.includes(path))
    );
  }

  async loadResourceId(): Promise<string | undefined> {
    const store = await this.#getStore();
    return (await store?.loadWorkflowRunHeader({ workflowName: this.#workflowName, runId: this.#runId }))?.resourceId;
  }

  async loadStep(stepId: string): Promise<StepSnapshot | null> {
    const store = await this.#getStore();
    const args = { workflowName: this.#workflowName, runId: this.#runId };
    const stored = await store?.loadWorkflowRunHeader(args);
    if (!stored) return null;
    // Bounded by the header's `lastSeq`, so a write landing between the two reads isn't half-seen.
    const context = (await store!.loadWorkflowRunSteps({ ...args, stepIds: [stepId], upToSeq: stored.lastSeq })) ?? {};
    return { ...stored.header, context } as StepSnapshot;
  }

  async loadSteps(stepIds: string[], { upToSeq }: { upToSeq?: number } = {}): Promise<StepResults> {
    const store = await this.#getStore();
    return (
      (await store?.loadWorkflowRunSteps({ workflowName: this.#workflowName, runId: this.#runId, stepIds, upToSeq })) ??
      {}
    );
  }

  async loadState(keys?: string[]): Promise<Record<string, any>> {
    const store = await this.#getStore();
    return (await store?.loadWorkflowRunState({ workflowName: this.#workflowName, runId: this.#runId, keys })) ?? {};
  }

  async writeStepResult({
    stepId,
    result,
    requestContext,
    state,
    statePatch,
    startGuard,
    completionGuard,
  }: StepResultWrite): Promise<StepWriteResult | undefined> {
    if (state) throw wholeStateOnV2();
    const store = await this.#getStore();
    if (!store) return undefined;
    const written = await store.appendWorkflowRunEntries({
      workflowName: this.#workflowName,
      runId: this.#runId,
      steps: { [stepId]: result },
      requestContext,
      ...(statePatch?.length ? { statePatch } : {}),
      startGuard,
      completionGuard,
    });
    return written ? { results: { [stepId]: result }, seq: written.lastSeq } : { results: {} };
  }

  async mergeStepResult({
    stepId,
    result,
    requestContext,
    state,
    statePatch,
    startGuard,
    completionGuard,
  }: StepResultWrite): Promise<StepWriteResult | undefined> {
    if (state) throw wholeStateOnV2();
    if (startGuard || completionGuard) throw new Error('Storage v2 runs do not support step guards');
    const store = await this.#getStore();
    if (!store) return undefined;
    const merged = await store.mergeWorkflowRunStepResult({
      workflowName: this.#workflowName,
      runId: this.#runId,
      stepId,
      result,
      requestContext,
      ...(statePatch?.length ? { statePatch } : {}),
    });
    return merged ? { results: { [stepId]: merged.result }, seq: merged.lastSeq } : { results: {} };
  }

  async writeState({ state, statePatch, requestContext }: StateWrite & { requestContext: Record<string, any> }) {
    if (state) throw wholeStateOnV2();
    if (!statePatch?.length) return;
    const store = await this.#getStore();
    await store?.appendWorkflowRunEntries({
      workflowName: this.#workflowName,
      runId: this.#runId,
      steps: {},
      requestContext,
      statePatch,
    });
  }

  async delete(): Promise<void> {
    const store = await this.#getStore();
    await store?.deleteWorkflowRunById({ workflowName: this.#workflowName, runId: this.#runId });
  }
}

function wholeStateOnV2(): Error {
  // A whole state would drop the keys a concurrent step (a parallel arm, a foreach iteration) wrote.
  return new Error('Storage v2 runs write state as a patch, not the whole state');
}
