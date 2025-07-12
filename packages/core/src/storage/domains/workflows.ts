import type { WorkflowRunState } from '../../workflows';
import type { WorkflowRun, WorkflowRuns } from '../types';
import { MastraStorageBase } from './base';
import type { MastraStore } from './store';

export abstract class MastraWorkflowsStorage extends MastraStorageBase {
  constructor({ store }: { store: MastraStore }) {
    super({ name: 'WORKFLOWS', store });
  }

  abstract getWorkflowRuns(args?: {
    workflowName?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
    resourceId?: string;
  }): Promise<WorkflowRuns>;

  abstract getWorkflowRunById(args: { runId: string; workflowName?: string }): Promise<WorkflowRun | null>;

  abstract persistWorkflowSnapshot({
    workflowName,
    runId,
    snapshot,
  }: {
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
}
