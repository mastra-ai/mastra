import type { StepResult, WorkflowRunState } from '../../../workflows';
import { normalizePerPage } from '../../base';
import type { StorageWorkflowRun, WorkflowRun, WorkflowRuns, StorageListWorkflowRunsInput } from '../../types';
import { WorkflowsStorageBase } from './base';

export type WorkflowsStorageData = Map<string, StorageWorkflowRun>;

export class WorkflowsStorageInMemory extends WorkflowsStorageBase {
  collection: WorkflowsStorageData;

  constructor() {
    super();
    this.collection = new Map<string, StorageWorkflowRun>();
  }

  async init(): Promise<void> {
    this.collection = new Map<string, StorageWorkflowRun>();
  }

  async updateWorkflowResults({
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
  }): Promise<Record<string, StepResult<any, any, any, any>>> {
    this.logger.debug(`MockStore: updateWorkflowResults called for ${workflowId} ${runId} ${stepId}`, result);
    const run = this.collection.get(`${workflowId}-${runId}`);

    if (!run) {
      return {};
    }

    let snapshot;
    if (!run.snapshot) {
      snapshot = {
        context: {},
        activePaths: [],
        activeStepsPath: {},
        timestamp: Date.now(),
        suspendedPaths: {},
        resumeLabels: {},
        serializedStepGraph: [],
        value: {},
        waitingPaths: {},
        status: 'pending',
        runId: run.run_id,
      } as WorkflowRunState;

      this.collection.set(`${workflowId}-${runId}`, {
        ...run,
        snapshot,
      });
    }

    snapshot = typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot;

    if (!snapshot || !snapshot?.context) {
      throw new Error(`Snapshot not found for runId ${runId}`);
    }

    snapshot.context[stepId] = result;
    snapshot.requestContext = { ...snapshot.requestContext, ...requestContext };

    this.collection.set(`${workflowId}-${runId}`, {
      ...run,
      snapshot: snapshot,
    });

    return JSON.parse(JSON.stringify(snapshot.context));
  }

  async updateWorkflowState({
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
  }): Promise<WorkflowRunState | undefined> {
    const run = this.collection.get(`${workflowId}-${runId}`);

    if (!run) {
      return;
    }

    let snapshot;
    if (!run.snapshot) {
      snapshot = {
        context: {},
        activePaths: [],
        activeStepsPath: {},
        timestamp: Date.now(),
        suspendedPaths: {},
        resumeLabels: {},
        serializedStepGraph: [],
        value: {},
        waitingPaths: {},
        status: 'pending',
        runId: run.run_id,
      } as WorkflowRunState;

      this.collection.set(`${workflowId}-${runId}`, {
        ...run,
        snapshot,
      });
    } else {
      snapshot = typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot;
    }

    if (!snapshot || !snapshot?.context) {
      throw new Error(`Snapshot not found for runId ${runId}`);
    }

    snapshot = { ...snapshot, ...opts };
    this.collection.set(`${workflowId}-${runId}`, {
      ...run,
      snapshot: snapshot,
    });

    return snapshot;
  }

  async createWorkflowSnapshot({
    workflowId,
    runId,
    resourceId,
    snapshot,
    createdAt,
    updatedAt,
  }: {
    workflowId: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    const record = {
      id: workflowId ? `${workflowId}-${runId}` : runId,
      workflow_name: workflowId,
      run_id: runId,
      resourceId,
      snapshot,
      createdAt: createdAt || new Date(),
      updatedAt: updatedAt || new Date(),
    };

    this.collection.set(record.id, record);
  }

  async getWorkflowSnapshot({
    workflowId,
    runId,
  }: {
    workflowId: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    this.logger.debug('Loading workflow snapshot', { workflowId, runId });

    this.collection.get(`${workflowId}-${runId}`);

    const d = this.collection.get(`${workflowId}-${runId}`);

    // Return a deep copy to prevent mutation
    return d ? JSON.parse(JSON.stringify(d.snapshot)) : null;
  }

  async listWorkflowRuns({
    workflowId,
    fromDate,
    toDate,
    perPage,
    page,
    resourceId,
    status,
  }: StorageListWorkflowRunsInput = {}): Promise<WorkflowRuns> {
    if (page !== undefined && page < 0) {
      throw new Error('page must be >= 0');
    }

    let runs = Array.from(this.collection.values());

    if (workflowId) runs = runs.filter((run: any) => run.workflow_name === workflowId);
    if (status) {
      runs = runs.filter((run: any) => {
        let snapshot: WorkflowRunState | string = run?.snapshot!;

        if (!snapshot) {
          return false;
        }

        if (typeof snapshot === 'string') {
          try {
            snapshot = JSON.parse(snapshot) as WorkflowRunState;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (error) {
            return false;
          }
        } else {
          snapshot = JSON.parse(JSON.stringify(snapshot)) as WorkflowRunState;
        }

        return snapshot.status === status;
      });
    }

    if (fromDate && toDate) {
      runs = runs.filter(
        (run: any) =>
          new Date(run.createdAt).getTime() >= fromDate.getTime() &&
          new Date(run.createdAt).getTime() <= toDate.getTime(),
      );
    } else if (fromDate) {
      runs = runs.filter((run: any) => new Date(run.createdAt).getTime() >= fromDate.getTime());
    } else if (toDate) {
      runs = runs.filter((run: any) => new Date(run.createdAt).getTime() <= toDate.getTime());
    }
    if (resourceId) runs = runs.filter((run: any) => run.resourceId === resourceId);

    const total = runs.length;

    // Sort by createdAt
    runs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply pagination
    if (perPage !== undefined && page !== undefined) {
      // Use MAX_SAFE_INTEGER as default to maintain "no pagination" behavior when undefined
      const normalizedPerPage = normalizePerPage(perPage, Number.MAX_SAFE_INTEGER);
      const offset = page * normalizedPerPage;
      const start = offset;
      const end = start + normalizedPerPage;
      runs = runs.slice(start, end);
    }

    // Deserialize snapshot if it's a string
    const parsedRuns = runs.map((run: any) => ({
      ...run,
      snapshot: typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : JSON.parse(JSON.stringify(run.snapshot)),
      createdAt: new Date(run.createdAt),
      updatedAt: new Date(run.updatedAt),
      runId: run.run_id,
      workflowName: run.workflow_name,
      resourceId: run.resourceId,
    }));

    return { runs: parsedRuns as WorkflowRun[], total };
  }

  async getWorkflowRunById({ runId, workflowId }: { runId: string; workflowId?: string }): Promise<WorkflowRun | null> {
    const runs = Array.from(this.collection.values()).filter((r: any) => r.run_id === runId);
    let run = runs.find((r: any) => r.workflow_name === workflowId);

    if (!run) return null;

    // Return a deep copy to prevent mutation
    const parsedRun = {
      ...run,
      snapshot: typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : JSON.parse(JSON.stringify(run.snapshot)),
      createdAt: new Date(run.createdAt),
      updatedAt: new Date(run.updatedAt),
      runId: run.run_id,
      workflowName: run.workflow_name,
      resourceId: run.resourceId,
    };

    return parsedRun as WorkflowRun;
  }

  async dropData(): Promise<void> {
    this.collection.clear();
  }
}
