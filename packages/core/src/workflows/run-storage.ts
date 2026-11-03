import type { WorkflowsStorage } from '../storage/domains/workflows/base';
import type { StateRef, StepResultSummary, WorkflowRunHeader } from '../storage/domains/workflows/journal';
import { getSnapshotMemoryInfo } from '../storage/domains/workflows/snapshot-memory-info';
import type { UpdateWorkflowStateOptions } from '../storage/types';
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
  /** True when the compare-and-set applied. */
  updateHeader(opts: UpdateWorkflowStateOptions): Promise<boolean>;
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
  storedState(snapshot: WorkflowRunState): { seq: number; patchBytes: number; patchCount: number } | undefined;
  /**
   * The state the run's current drive started from: as of its latest checkpoint, or as of the
   * resume that started the drive. Undefined for v1, or when the run or that version isn't stored.
   */
  loadDriveStartState(): Promise<Record<string, any> | undefined>;

  // The evented engine's operations. Storage v2 doesn't implement them yet.

  loadResourceId(): Promise<string | undefined>;
  /** The header and `stepId`'s result. v1 loads every step. */
  loadStep(stepId: string): Promise<WorkflowRunState | null>;
  /**
   * Returns every step's result after the write: `{}` when the run isn't stored, undefined
   * without a store. `state` is written in the same write.
   */
  writeStepResult(write: StepResultWrite): Promise<StepResults | undefined>;
  /** A foreach step's write: the store merges `result.output` into the stored array by index. */
  mergeStepResult(write: StepResultWrite): Promise<StepResults | undefined>;
  writeState(state: Record<string, any>, requestContext: Record<string, any>): Promise<void>;
  delete(): Promise<void>;
}

type StepResults = Record<string, StepResult<any, any, any, any>>;

type StepResultWrite = {
  stepId: string;
  result: StepResult<any, any, any, any>;
  requestContext: Record<string, any>;
  state?: Record<string, any>;
};

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

  async updateHeader(opts: UpdateWorkflowStateOptions): Promise<boolean> {
    const store = await this.#getStore();
    const updated = await store?.updateWorkflowState({
      workflowName: this.#workflowName,
      runId: this.#runId,
      storageVersion: 1,
      opts,
    });
    return !!updated;
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

  async loadStep(): Promise<WorkflowRunState | null> {
    return this.#load(await this.#getStore());
  }

  async writeStepResult({ stepId, result, requestContext, state }: StepResultWrite): Promise<StepResults | undefined> {
    const store = await this.#getStore();
    return store?.updateWorkflowResults({
      workflowName: this.#workflowName,
      runId: this.#runId,
      stepId,
      result,
      requestContext,
      ...(state !== undefined ? { state } : {}),
    });
  }

  mergeStepResult(write: StepResultWrite): Promise<StepResults | undefined> {
    // v1 stores already merge a foreach result's array by index.
    return this.writeStepResult(write);
  }

  async writeState(state: Record<string, any>, requestContext: Record<string, any>): Promise<void> {
    await this.writeStepResult({ stepId: '__state', result: state as StepResult<any, any, any, any>, requestContext });
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
const storedStates = new WeakMap<WorkflowRunState, { seq: number; patchBytes: number; patchCount: number }>();

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
    storedStates.set(snapshot, { seq: run.lastSeq, patchBytes: run.statePatchBytes, patchCount: run.statePatchCount });
    return snapshot;
  }

  async loadHeader(): Promise<WorkflowRunHeader | null> {
    const store = await this.#getStore();
    const stored = await store?.loadWorkflowRunHeader({ workflowName: this.#workflowName, runId: this.#runId });
    return stored?.header ?? null;
  }

  async updateHeader(opts: UpdateWorkflowStateOptions): Promise<boolean> {
    const store = await this.#getStore();
    const updated = await store?.updateWorkflowRunHeader({
      workflowName: this.#workflowName,
      runId: this.#runId,
      opts,
    });
    return !!updated;
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
    storedStates.set(snapshot, { seq: run.lastSeq, patchBytes: run.statePatchBytes, patchCount: run.statePatchCount });
    return snapshot;
  }

  async writeSnapshot(
    snapshot: WorkflowRunState,
    resourceId?: string,
    { stateBase }: { stateBase?: StateRef } = {},
  ): Promise<void> {
    const store = await this.#getStore();
    const { context, value, ...header } = snapshot;
    await store?.writeWorkflowRunCheckpoint({
      workflowName: this.#workflowName,
      runId: this.#runId,
      resourceId,
      threadId: getSnapshotMemoryInfo(snapshot)?.threadId,
      header,
      steps: context,
      ...(stateBase ? { stateBase } : { state: value }),
    });
  }

  storedState(snapshot: WorkflowRunState): { seq: number; patchBytes: number; patchCount: number } | undefined {
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
    throw notOnV2('loadResourceId');
  }

  async loadStep(): Promise<WorkflowRunState | null> {
    throw notOnV2('loadStep');
  }

  async writeStepResult(): Promise<StepResults | undefined> {
    throw notOnV2('writeStepResult');
  }

  async mergeStepResult(): Promise<StepResults | undefined> {
    throw notOnV2('mergeStepResult');
  }

  async writeState(): Promise<void> {
    throw notOnV2('writeState');
  }

  async delete(): Promise<void> {
    throw notOnV2('delete');
  }
}

function notOnV2(operation: string): Error {
  return new Error(`RunStorage.${operation} doesn't support storage v2 runs yet`);
}
