import type { StepResult, WorkflowRunState } from '../../../workflows';
import type {
  ClaimRunOwnershipInput,
  ClaimRunOwnershipResult,
  ReleaseRunOwnershipInput,
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
   * operations below, and rejecting writes whose `fence` is no longer the
   * run's current claim, atomically with the write itself.
   *
   * Adapters that return true must pass the run-fencing conformance suite.
   */
  supportsRunFencing(): boolean {
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

  /** Extend the lease. Succeeds only while `ownerId` and `generation` still hold the run. */
  async renewRunOwnership(_args: RenewRunOwnershipInput): Promise<RenewRunOwnershipResult> {
    throw runFencingNotSupportedError('workflows', this.constructor.name);
  }

  /**
   * Give up a claim. Keeps the generation so later claims stay monotonic,
   * unless `remove` deletes the record. Returns false if the claim was no
   * longer current.
   */
  async releaseRunOwnership(_args: ReleaseRunOwnershipInput): Promise<boolean> {
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
    fence,
  }: {
    workflowName: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    requestContext: Record<string, any>;
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
