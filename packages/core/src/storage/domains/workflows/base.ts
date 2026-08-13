import type { StepResult, WorkflowRunState } from '../../../workflows';
import type {
  ClaimWorkflowResumeOptions,
  ClaimWorkflowResumeResult,
  UpdateWorkflowStateOptions,
  WorkflowRun,
  WorkflowRuns,
  StorageListWorkflowRunsInput,
} from '../../types';
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
   * Atomically claims a suspended run for resumption when the storage supports it.
   * Stores that cannot provide a compare-and-set operation return `supported: false`.
   */
  async claimWorkflowResume(_: ClaimWorkflowResumeOptions): Promise<ClaimWorkflowResumeResult> {
    return { supported: false, claimed: false };
  }

  abstract updateWorkflowResults({
    workflowName,
    runId,
    stepId,
    result,
    requestContext,
  }: {
    workflowName: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    requestContext: Record<string, any>;
  }): Promise<Record<string, StepResult<any, any, any, any>>>;

  abstract updateWorkflowState({
    workflowName,
    runId,
    opts,
  }: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
  }): Promise<WorkflowRunState | undefined>;

  abstract persistWorkflowSnapshot(_: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
    createdAt?: Date;
    updatedAt?: Date;
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

  abstract deleteWorkflowRunById(args: { runId: string; workflowName: string }): Promise<void>;
}
