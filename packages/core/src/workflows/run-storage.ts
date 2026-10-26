import type { WorkflowsStorage } from '../storage/domains/workflows/base';
import type { StepResultSummary, WorkflowRunHeader } from '../storage/domains/workflows/journal';
import type { UpdateWorkflowStateOptions } from '../storage/types';
import { stubStepResult } from './run-journal';
import type { WorkflowRunState } from './types';
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
   * The pending/waiting snapshot written before the engine runs. With `inheritsState` (a storage v2
   * nested run starting from its parent's stored state), the state isn't stored: the parent's is
   * read in its place.
   */
  writeInitial(snapshot: WorkflowRunState, resourceId?: string, opts?: { inheritsState?: boolean }): Promise<void>;
  /** After a claim: has nothing been written to the run since `claimed` was loaded? */
  isClaimUnused(claimed: WorkflowRunState, resumedStepId: string): Promise<boolean>;
  /** What the store reported for the state of a snapshot loaded by `loadForResume` or `loadFull`. */
  statePatchBytes(snapshot: WorkflowRunState): number | undefined;
}

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

  async writeInitial(snapshot: WorkflowRunState, resourceId?: string): Promise<void> {
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

  statePatchBytes(): undefined {
    return undefined;
  }
}

// Keyed by the loaded snapshot, not the RunStorage: the parent-claim path loads a parent's
// snapshot through a throwaway RunStorage, and the parent Run's own RunStorage releases it.
const claimedSeqs = new WeakMap<WorkflowRunState, number>();
const loadedStatePatchBytes = new WeakMap<WorkflowRunState, number>();

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
    loadedStatePatchBytes.set(snapshot, run.statePatchBytes);
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
    loadedStatePatchBytes.set(snapshot, run.statePatchBytes);
    return snapshot;
  }

  async writeInitial(
    snapshot: WorkflowRunState,
    resourceId?: string,
    { inheritsState = false }: { inheritsState?: boolean } = {},
  ): Promise<void> {
    const store = await this.#getStore();
    const { context, value, ...header } = snapshot;
    await store?.writeWorkflowRunCheckpoint({
      workflowName: this.#workflowName,
      runId: this.#runId,
      resourceId,
      header,
      steps: context,
      state: inheritsState ? undefined : value,
    });
  }

  statePatchBytes(snapshot: WorkflowRunState): number | undefined {
    return loadedStatePatchBytes.get(snapshot);
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
}
