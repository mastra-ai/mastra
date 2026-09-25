import type { StepResult, WorkflowRunState } from '../../../workflows';
import type {
  UpdateWorkflowStateOptions,
  WorkflowRun,
  WorkflowRuns,
  WorkflowRunSummaries,
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

  /** Default fallback for adapters without a database-side projection. */
  async listWorkflowRunSummaries(args?: StorageListWorkflowRunsInput): Promise<WorkflowRunSummaries> {
    const { runs, total } = await this.listWorkflowRuns(args);
    return {
      total,
      runs: runs.map(run => {
        const snapshot =
          typeof run.snapshot === 'string' ? (JSON.parse(run.snapshot) as WorkflowRunState) : run.snapshot;
        return {
          workflowName: run.workflowName,
          runId: run.runId,
          status: snapshot.status,
          timestamp: snapshot.timestamp,
          createdAt: run.createdAt,
          updatedAt: run.updatedAt,
          resourceId: run.resourceId,
        };
      }),
    };
  }

  abstract getWorkflowRunById(args: { runId: string; workflowName?: string }): Promise<WorkflowRun | null>;

  abstract deleteWorkflowRunById(args: { runId: string; workflowName: string }): Promise<void>;
}
