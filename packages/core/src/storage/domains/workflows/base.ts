import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import type { StepResult, WorkflowRunState } from '../../../workflows';
import type {
  DeleteWorkflowRunsOlderThanArgs,
  DeleteWorkflowRunsOlderThanResponse,
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

  /**
   * Deletes all workflow runs where createdAt is before the specified date.
   * This is useful for implementing data retention policies.
   *
   * @param args.beforeDate - Delete workflow runs created before this date
   * @param args.filters - Optional filters to scope which workflow runs are deleted
   * @returns The number of workflow runs deleted
   */
  async deleteWorkflowRunsOlderThan(_args: DeleteWorkflowRunsOlderThanArgs): Promise<DeleteWorkflowRunsOlderThanResponse> {
    throw new MastraError({
      id: 'WORKFLOWS_STORAGE_DELETE_RUNS_OLDER_THAN_NOT_IMPLEMENTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support deleting workflow runs by date',
    });
  }
}
