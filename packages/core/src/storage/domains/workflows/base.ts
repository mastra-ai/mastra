import { MastraBase } from '../../../base';
import type { WorkflowRunState } from '../../../workflows';
import type { WorkflowRun, WorkflowRuns } from '../../types';

export abstract class WorkflowsStorage extends MastraBase {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'WORKFLOWS',
    });
  }

  abstract persistWorkflowSnapshot(_: {
    workflowName: string;
    runId: string;
    snapshot: WorkflowRunState;
  }): Promise<void>;

  abstract loadWorkflowSnapshot({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null>;

  abstract getWorkflowRuns(args?: {
    workflowName?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
    resourceId?: string;
  }): Promise<WorkflowRuns>;

  abstract getWorkflowRunById(args: { runId: string; workflowName?: string }): Promise<WorkflowRun | null>;
}
