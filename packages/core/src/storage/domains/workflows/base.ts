import type { StepResult, WorkflowRunState } from '../../../workflows';
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

  async getSuspendedWorkflowRunByResumeLabel({
    workflowName,
    resourceId,
    resumeLabel,
  }: {
    workflowName?: string;
    resourceId?: string;
    resumeLabel: string;
  }): Promise<WorkflowRun | null> {
    const listRuns = async (status: 'suspended' | 'waiting') =>
      await this.listWorkflowRuns({
        ...(workflowName ? { workflowName } : {}),
        ...(resourceId ? { resourceId } : {}),
        status,
        perPage: false,
      });

    const [suspended, waiting] = await Promise.all([listRuns('suspended'), listRuns('waiting')]);
    const runs = [...suspended.runs, ...waiting.runs].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return (
      runs.find(run => {
        try {
          const snapshot =
            typeof run.snapshot === 'string' ? (JSON.parse(run.snapshot) as WorkflowRunState) : run.snapshot;
          return Object.prototype.hasOwnProperty.call(snapshot.resumeLabels ?? {}, resumeLabel);
        } catch {
          return false;
        }
      }) ?? null
    );
  }
}
