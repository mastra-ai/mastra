import type { StepResult, WorkflowRunState } from '../../../workflows';
import { TABLE_WORKFLOW_SNAPSHOT } from '../../constants';
import type { StorageWorkflowRun, WorkflowRun, WorkflowRuns } from '../../types';
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
    workflowId,
    runId,
    stepId,
    result,
    runtimeContext,
  }: {
    workflowId: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    runtimeContext: Record<string, any>;
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
    snapshot.runtimeContext = { ...snapshot.runtimeContext, ...runtimeContext };

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

  async persistWorkflowSnapshot({
    workflowId,
    runId,
    resourceId,
    snapshot,
  }: {
    workflowId: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
  }) {
    const data = {
      workflow_name: workflowId,
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
    workflowId,
    runId,
  }: {
    workflowId: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    this.logger.debug('Loading workflow snapshot', { workflowId, runId });
    const d = await this.operations.load<{ snapshot: WorkflowRunState }>({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      keys: { workflow_name: workflowId, run_id: runId },
    });

    // Return a deep copy to prevent mutation
    return d ? JSON.parse(JSON.stringify(d.snapshot)) : null;
  }

  async getWorkflowRuns({
    workflowId,
    fromDate,
    toDate,
    limit,
    offset,
    resourceId,
  }: {
    workflowId?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
    resourceId?: string;
  } = {}): Promise<WorkflowRuns> {
    let runs = Array.from(this.collection.values());

    if (workflowId) runs = runs.filter((run: any) => run.workflow_name === workflowId);
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
    if (limit !== undefined && offset !== undefined) {
      const start = offset;
      const end = start + limit;
      runs = runs.slice(start, end);
    }

    // Deserialize snapshot if it's a string
    const parsedRuns = runs.map((run: any) => ({
      ...run,
      snapshot: typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : JSON.parse(JSON.stringify(run.snapshot)),
      createdAt: new Date(run.createdAt),
      updatedAt: new Date(run.updatedAt),
      runId: run.run_id,
      workflowId: run.workflow_name,
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
      workflowId: run.workflow_name,
      resourceId: run.resourceId,
    };

    return parsedRun as WorkflowRun;
  }
}
