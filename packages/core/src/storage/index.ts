import { WorkflowRunState } from '../workflows';

export abstract class MastraStorage {
  abstract persistWorkflowSnapshot(params: {
    workflowName: string;
    runId: string;
    snapshot: WorkflowRunState;
  }): Promise<void>;

  abstract loadWorkflowSnapshot(params: { workflowName: string; runId: string }): Promise<WorkflowRunState | null>;
}
