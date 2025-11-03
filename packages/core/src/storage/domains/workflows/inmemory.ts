import type { StepResult, WorkflowRunState } from '../../../workflows';
import { normalizePerPage } from '../../base';
import { TABLE_WORKFLOW_SNAPSHOT } from '../../constants';
import type { StorageWorkflowRun, WorkflowRun, WorkflowRuns, StorageListWorkflowRunsInput } from '../../types';
import type { StoreOperations } from '../operations';
import { WorkflowsStorage } from './base';

export type InMemoryWorkflows = Map<string, StorageWorkflowRun>;

export class WorkflowsInMemory extends WorkflowsStorage {
  operations: StoreOperations;
  collection: InMemoryWorkflows;

  constructor({ collection, operations }: { collection: InMemoryWorkflows; operations: StoreOperations }) {
    super();
    this.collection = collection;
    this.operations = operations;
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
    this.logger.debug(`MockStore: updateWorkflowResults called for ${workflowName} ${runId} ${stepId}`, result);
    const run = this.collection.get(`${workflowName}-${runId}`);

    if (!run) {
      return {};
    }

    let snapshot;
    if (!run.snapshot) {
      snapshot = {
        context: {},
        activePaths: [],
        timestamp: Date.now(),
        suspendedPaths: {},
        resumeLabels: {},
        serializedStepGraph: [],
        value: {},
        waitingPaths: {},
        status: 'pending',
        runId: run.run_id,
      } as WorkflowRunState;

      this.collection.set(`${workflowName}-${runId}`, {
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

    this.collection.set(`${workflowName}-${runId}`, {
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
    opts: {
      status: string;
      result?: StepResult<any, any, any, any>;
      error?: string;
      suspendedPaths?: Record<string, number[]>;
      waitingPaths?: Record<string, number[]>;
    };
  }): Promise<WorkflowRunState | undefined> {
    const run = this.collection.get(`${workflowName}-${runId}`);

    if (!run) {
      return;
    }

    let snapshot;
    if (!run.snapshot) {
      snapshot = {
        context: {},
        activePaths: [],
        timestamp: Date.now(),
        suspendedPaths: {},
        resumeLabels: {},
        serializedStepGraph: [],
        value: {},
        waitingPaths: {},
        status: 'pending',
        runId: run.run_id,
      } as WorkflowRunState;

      this.collection.set(`${workflowName}-${runId}`, {
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
    this.collection.set(`${workflowName}-${runId}`, {
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
  }: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
  }) {
    const data = {
      workflow_name: workflowName,
      run_id: runId,
      resourceId,
      snapshot,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.operations.insert({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      record: data,
    });
  }

  async loadWorkflowSnapshot({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    this.logger.debug('Loading workflow snapshot', { workflowName, runId });
    const d = await this.operations.load<{ snapshot: WorkflowRunState }>({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      keys: { workflow_name: workflowName, run_id: runId },
    });

    // Return a deep copy to prevent mutation
    return d ? JSON.parse(JSON.stringify(d.snapshot)) : null;
  }

  async listWorkflowRuns({
    workflowName,
    fromDate,
    toDate,
    perPage,
    page,
    resourceId,
  }: StorageListWorkflowRunsInput = {}): Promise<WorkflowRuns> {
    if (page !== undefined && page < 0) {
      throw new Error('page must be >= 0');
    }

    let runs = Array.from(this.collection.values());

    if (workflowName) runs = runs.filter((run: any) => run.workflow_name === workflowName);
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
    const runs = Array.from(this.collection.values()).filter((r: any) => r.run_id === runId);
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
}
