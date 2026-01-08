import type { StepResult, WorkflowRunState } from '../../../workflows';
import { normalizePerPage } from '../../base';
import type {
  StorageWorkflowRun,
  WorkflowRun,
  WorkflowRuns,
  StorageListWorkflowRunsInput,
  UpdateWorkflowStateOptions,
} from '../../types';
import type { InMemoryDB } from '../inmemory-db';
import { WorkflowsStorage } from './base';

export class WorkflowsInMemory extends WorkflowsStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.workflows.clear();
  }

  private getWorkflowKey(workflowName: string, runId: string): string {
    return `${workflowName}-${runId}`;
  }

  async updateWorkflowResults({
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
  }): Promise<Record<string, StepResult<any, any, any, any>>> {
    this.logger.debug(`WorkflowsInMemory: updateWorkflowResults called for ${workflowName} ${runId} ${stepId}`, result);
    const key = this.getWorkflowKey(workflowName, runId);
    const run = this.db.workflows.get(key);

    if (!run) {
      return {};
    }

    let snapshot: WorkflowRunState;
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

      this.db.workflows.set(key, {
        ...run,
        snapshot,
      });
    } else {
      snapshot = typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot;
    }

    if (!snapshot || !snapshot?.context) {
      throw new Error(`Snapshot not found for runId ${runId}`);
    }

    snapshot.context[stepId] = result;
    snapshot.requestContext = { ...snapshot.requestContext, ...requestContext };

    this.db.workflows.set(key, {
      ...run,
      snapshot: snapshot,
    });

    return JSON.parse(JSON.stringify(snapshot.context));
  }

  async updateWorkflowState({
    workflowName,
    runId,
    opts,
  }: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
  }): Promise<WorkflowRunState | undefined> {
    const key = this.getWorkflowKey(workflowName, runId);
    const run = this.db.workflows.get(key);

    if (!run) {
      return;
    }

    let snapshot: WorkflowRunState;
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

      this.db.workflows.set(key, {
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
    this.db.workflows.set(key, {
      ...run,
      snapshot: snapshot,
    });

    return snapshot;
  }

  async persistWorkflowSnapshot({
    workflowName,
    runId,
    resourceId,
    snapshot,
    createdAt,
    updatedAt,
  }: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
    createdAt?: Date;
    updatedAt?: Date;
  }): Promise<void> {
    const key = this.getWorkflowKey(workflowName, runId);
    const now = new Date();
    const data: StorageWorkflowRun = {
      workflow_name: workflowName,
      run_id: runId,
      resourceId,
      snapshot,
      createdAt: createdAt ?? now,
      updatedAt: updatedAt ?? now,
    };

    this.db.workflows.set(key, data);
  }

  async loadWorkflowSnapshot({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    this.logger.debug('Loading workflow snapshot', { workflowName, runId });
    const key = this.getWorkflowKey(workflowName, runId);
    const run = this.db.workflows.get(key);

    if (!run) {
      return null;
    }

    const snapshot = typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot;
    // Return a deep copy to prevent mutation
    return snapshot ? JSON.parse(JSON.stringify(snapshot)) : null;
  }

  async listWorkflowRuns({
    workflowName,
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

    let runs = Array.from(this.db.workflows.values());

    if (workflowName) runs = runs.filter((run: any) => run.workflow_name === workflowName);
    if (status) {
      runs = runs.filter((run: any) => {
        let snapshot: WorkflowRunState | string = run?.snapshot!;

        if (!snapshot) {
          return false;
        }

        if (typeof snapshot === 'string') {
          try {
            snapshot = JSON.parse(snapshot) as WorkflowRunState;
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

  async getWorkflowRunById({
    runId,
    workflowName,
  }: {
    runId: string;
    workflowName?: string;
  }): Promise<WorkflowRun | null> {
    const runs = Array.from(this.db.workflows.values()).filter((r: any) => r.run_id === runId);
    let run = runs.find((r: any) => r.workflow_name === workflowName);

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

  async deleteWorkflowRunById({ runId, workflowName }: { runId: string; workflowName: string }): Promise<void> {
    const key = this.getWorkflowKey(workflowName, runId);
    this.db.workflows.delete(key);
  }
}
