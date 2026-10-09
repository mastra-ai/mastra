import type { StepResult, WorkflowRunState } from '../../../workflows';
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
import { StorageDomain } from '../base';

export abstract class WorkflowsStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'WORKFLOWS',
    });
  }

  abstract supportsConcurrentUpdates(): boolean;

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
   * computed on the store's clock.
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
   * `force`. The record keeps its generation and owner: claims stay
   * monotonic, and the released owner's late writes are still accepted until
   * the run is claimed again. Returns false if the claim was no longer current.
   */
  async releaseRunOwnership(_args: RunFence): Promise<boolean> {
    throw runFencingNotSupportedError('workflows', this.constructor.name);
  }

  async getRunOwnership(_args: { runId: string }): Promise<RunOwnershipRecord | null> {
    throw runFencingNotSupportedError('workflows', this.constructor.name);
  }

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

  abstract persistWorkflowSnapshot(_: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
    createdAt?: Date;
    updatedAt?: Date;
    fence?: RunFence;
  }): Promise<void>;

  abstract loadWorkflowSnapshot({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null>;

  abstract listWorkflowRuns(args?: StorageListWorkflowRunsInput): Promise<WorkflowRuns>;

  abstract getWorkflowRunById(args: { runId: string; workflowName?: string }): Promise<WorkflowRun | null>;

  abstract deleteWorkflowRunById(args: { runId: string; workflowName: string; fence?: RunFence }): Promise<void>;
}
