import { MastraBase } from '../../../base';
import type { StepResult, WorkflowRunState } from '../../../workflows';
import type { WorkflowRun, WorkflowRuns, StorageListWorkflowRunsInput } from '../../types';

export abstract class WorkflowsStorageBase extends MastraBase {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'WORKFLOWS',
    });
  }

  abstract init(): Promise<void>;

  abstract updateWorkflowResults({
    workflowId,
    runId,
    stepId,
    result,
    requestContext,
  }: {
    workflowId: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    requestContext: Record<string, any>;
  }): Promise<Record<string, StepResult<any, any, any, any>>>;

  abstract updateWorkflowState({
    workflowId,
    runId,
    opts,
  }: {
    workflowId: string;
    runId: string;
    opts: {
      status: string;
      result?: StepResult<any, any, any, any>;
      error?: string;
      suspendedPaths?: Record<string, number[]>;
      waitingPaths?: Record<string, number[]>;
    };
  }): Promise<WorkflowRunState | undefined>;

  abstract createWorkflowSnapshot(_: {
    workflowId: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
    createdAt?: Date;
    updatedAt?: Date;
  }): Promise<void>;

  abstract getWorkflowSnapshot({
    workflowId,
    runId,
  }: {
    workflowId: string;
    runId: string;
  }): Promise<WorkflowRunState | null>;

  abstract listWorkflowRuns(args?: StorageListWorkflowRunsInput): Promise<WorkflowRuns>;

  abstract getWorkflowRunById(args: { runId: string; workflowId?: string }): Promise<WorkflowRun | null>;

  abstract dropData(): Promise<void>;

  async createIndexes(): Promise<void> {
    // Optional: subclasses can override this method to implement index creation
  }

  async dropIndexes(): Promise<void> {
    // Optional: subclasses can override this method to implement index dropping
  }
}
