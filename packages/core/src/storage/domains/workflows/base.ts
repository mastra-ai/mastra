import type { StepResult, WorkflowRunState, WorkflowRunStatus } from '../../../workflows';
import type {
  ClaimRunOwnershipInput,
  ClaimRunOwnershipResult,
  RenewRunOwnershipInput,
  RenewRunOwnershipResult,
  RunFence,
  RunOwnershipRecord,
} from '../../run-fencing';
import { runFencingNotSupportedError } from '../../run-fencing';
import type { UpdateWorkflowStateOptions, WorkflowRun, WorkflowRuns, StorageListWorkflowRunsInput } from '../../types';
import type { WorkflowStepStartGuard, WorkflowStepCompletionGuard } from '../../workflow-step-guard';
import { StorageDomain } from '../base';

export abstract class WorkflowsStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'WORKFLOWS',
    });
  }

  abstract supportsConcurrentUpdates(): boolean;

  /** Atomic occurrence checks for evented step writes and replay-safe continuation. */
  supportsWorkflowStepGuards(): boolean {
    return false;
  }

  /**
   * Whether this adapter implements run ownership: the claim/renew/release
   * operations below, and rejecting writes whose fence is no longer the run's
   * current claim, atomically with the write itself. A write's fence is its
   * `fence` argument, otherwise the one `resolveRunFence()` returns for the
   * run it writes.
   *
   * This fences workflow writes only. A run is fully fenced only when the
   * memory store it writes to supports run fencing too, which a composite
   * store taking its domains from different adapters, or an agent whose
   * memory has its own storage, does not guarantee. Otherwise an execution
   * that lost the run can no longer write here, but its messages, threads and
   * working memory still land.
   *
   * A rejected write throws a `RunFenceConflictError` itself, not wrapped in
   * another error, and writes nothing.
   *
   * Adapters that return true must pass the run-fencing conformance suite.
   * An adapter that has to probe its backend to know returns a promise, and
   * rejects when the probe fails: it must never answer false and later true.
   */
  supportsRunFencing(): boolean | Promise<boolean> {
    return false;
  }

  /**
   * Claim a run for an execution. Succeeds when the run has no live owner, or
   * when `force` is set, and increments the run's generation. Lease expiry is
   * computed on the store's clock. Every claim, renewal and release sets
   * `updatedAt` from the store's clock.
   *
   * A run with no record starts at the store's clock in epoch milliseconds (at
   * least 1) rather than 1. Retention prunes ownership records and memory
   * fences independently, so a run claimed again after `workflows.runOwnership`
   * retention pruned its record must still outrank any fence or stream event
   * left from before. This relies on the store's clock not moving backward
   * between the two claims.
   *
   * Later claims increment by 1 rather than reading the clock again. A takeover
   * then depends only on the stored generation, which the atomic claim already
   * reads, so clock skew cannot affect it. The generation orders claims; it is
   * not a timestamp.
   */
  async claimRunOwnership(_args: ClaimRunOwnershipInput): Promise<ClaimRunOwnershipResult> {
    throw runFencingNotSupportedError('workflows', this.constructor.name);
  }

  /**
   * Extend the lease. Succeeds only while `ownerId` and `generation` still
   * hold the run and the claim has not been released.
   */
  async renewRunOwnership(_args: RenewRunOwnershipInput): Promise<RenewRunOwnershipResult> {
    throw runFencingNotSupportedError('workflows', this.constructor.name);
  }

  /**
   * Give up a claim by clearing its lease, so the run can be claimed without
   * `force`. The record keeps its generation and owner, and the released
   * owner's late writes are still accepted until the run is claimed again or
   * its record is pruned. Returns false if the claim was no longer current.
   */
  async releaseRunOwnership(_args: RunFence): Promise<boolean> {
    throw runFencingNotSupportedError('workflows', this.constructor.name);
  }

  async getRunOwnership(_args: { runId: string }): Promise<RunOwnershipRecord | null> {
    throw runFencingNotSupportedError('workflows', this.constructor.name);
  }

  /**
   * In-memory, LibSQL, and PostgreSQL storage return an empty object without writing when the workflow run does not
   * exist. Remaining adapters are being aligned under COR-1448; callers must not rely on this method to create the
   * initial run snapshot.
   */
  abstract updateWorkflowResults({
    workflowName,
    runId,
    stepId,
    result,
    requestContext,
    state,
    fence,
  }: {
    workflowName: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    requestContext: Record<string, any>;
    /**
     * Workflow state to record as `context.__state` in the same atomic update as
     * the step result, so a crash can't persist one without the other.
     */
    state?: Record<string, any>;
    fence?: RunFence;
    startGuard?: WorkflowStepStartGuard;
    completionGuard?: WorkflowStepCompletionGuard;
  }): Promise<Record<string, StepResult<any, any, any, any>>>;

  abstract updateWorkflowState({
    workflowName,
    runId,
    opts,
    fence,
  }: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
    fence?: RunFence;
  }): Promise<WorkflowRunState | undefined>;

  /**
   * Whether `persistWorkflowSnapshot` enforces its `expectedStatus` guard atomically
   * with the write. Adapters that return false ignore the guard, so callers that
   * need it must check the run status themselves before writing.
   */
  supportsGuardedSnapshotWrites(): boolean {
    return false;
  }

  /**
   * Upserts a run snapshot.
   *
   * `expectedStatus` is an optional compare-and-set guard, honored only by adapters
   * where `supportsGuardedSnapshotWrites()` is true. When the run already has a
   * snapshot whose status is not one of these values, the write is skipped and the
   * call resolves to `false`. A run with no snapshot yet is always written. Adapters
   * that honor the guard resolve to `true` after a write; others resolve to `undefined`.
   */
  abstract persistWorkflowSnapshot(_: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
    createdAt?: Date;
    updatedAt?: Date;
    fence?: RunFence;
    expectedStatus?: WorkflowRunStatus | WorkflowRunStatus[];
  }): Promise<boolean | void>;

  abstract loadWorkflowSnapshot({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null>;

  /**
   * Returns only the persisted status of a run, or `null` when the run has no
   * snapshot. Adapters should override this to avoid reading the whole snapshot;
   * the default loads it.
   */
  async loadWorkflowRunStatus({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunStatus | null> {
    const snapshot = await this.loadWorkflowSnapshot({ workflowName, runId });
    return snapshot?.status ?? null;
  }

  abstract listWorkflowRuns(args?: StorageListWorkflowRunsInput): Promise<WorkflowRuns>;

  abstract getWorkflowRunById(args: { runId: string; workflowName?: string }): Promise<WorkflowRun | null>;

  abstract deleteWorkflowRunById(args: { runId: string; workflowName: string; fence?: RunFence }): Promise<void>;
}
