import { TABLE_WORKFLOW_SNAPSHOT, normalizePerPage, WorkflowsStorage } from '@mastra/core/storage';
import type {
  StorageListWorkflowRunsInput,
  StorageWorkflowRun,
  WorkflowRun,
  WorkflowRuns,
  UpdateWorkflowStateOptions,
} from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';

import { ConvexDB, resolveConvexConfig } from '../../db';
import type { ConvexDomainConfig } from '../../db';

type RawWorkflowRun = Omit<StorageWorkflowRun, 'createdAt' | 'updatedAt' | 'snapshot'> & {
  createdAt: string;
  updatedAt: string;
  snapshot: WorkflowRunState | string;
};

export class WorkflowsConvex extends WorkflowsStorage {
  #db: ConvexDB;
  constructor(config: ConvexDomainConfig) {
    super();
    const client = resolveConvexConfig(config);
    this.#db = new ConvexDB(client);
  }

  async init(): Promise<void> {
    // No-op for Convex; schema is managed server-side.
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
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
    const run = await this.getRun(workflowName, runId);
    if (!run) return {};

    const snapshot = this.ensureSnapshot(run);
    snapshot.context = snapshot.context || {};
    snapshot.context[stepId] = result;
    snapshot.requestContext = { ...(snapshot.requestContext || {}), ...requestContext };

    await this.persistWorkflowSnapshot({
      workflowName,
      runId,
      resourceId: run.resourceId,
      snapshot,
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
    const run = await this.getRun(workflowName, runId);
    if (!run) return undefined;

    const snapshot = this.ensureSnapshot(run);
    const updated = { ...snapshot, ...opts };

    await this.persistWorkflowSnapshot({
      workflowName,
      runId,
      resourceId: run.resourceId,
      snapshot: updated,
    });

    return updated;
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
  }): Promise<void> {
    const now = new Date();
    // Use semantic operation to check for existing record
    let existing: { createdAt?: string } | null = null;
    try {
      existing = await this.#db.getWorkflowRun<{ createdAt?: string }>(workflowName, runId);
    } catch {
      // Fallback to load
      existing = await this.#db.load<{ createdAt?: string } | null>({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        keys: { workflow_name: workflowName, run_id: runId },
      });
    }

    await this.#db.insert({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      record: {
        workflow_name: workflowName,
        run_id: runId,
        resourceId,
        snapshot,
        createdAt: existing?.createdAt ?? now.toISOString(),
        updatedAt: now.toISOString(),
      },
    });
  }

  async loadWorkflowSnapshot({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    // Use semantic operation for optimized lookup
    let row: { snapshot: WorkflowRunState | string } | null = null;
    try {
      row = await this.#db.getWorkflowRun<{ snapshot: WorkflowRunState | string }>(workflowName, runId);
    } catch {
      // Fallback to load
      row = await this.#db.load<{ snapshot: WorkflowRunState | string } | null>({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        keys: { workflow_name: workflowName, run_id: runId },
      });
    }

    if (!row) return null;
    return typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : JSON.parse(JSON.stringify(row.snapshot));
  }

  async listWorkflowRuns(args: StorageListWorkflowRunsInput = {}): Promise<WorkflowRuns> {
    const { workflowName, fromDate, toDate, perPage, page, resourceId, status } = args;

    // Use semantic operation for optimized listing
    let rows: RawWorkflowRun[];
    try {
      const response = await this.#db.listWorkflowRuns<RawWorkflowRun>({
        workflowName,
        resourceId,
        status,
        limit: 1000, // Safe batch size
      });
      rows = response.result;
    } catch {
      // Fallback to queryTable with filter
      if (workflowName) {
        rows = await this.#db.queryTable<RawWorkflowRun>(TABLE_WORKFLOW_SNAPSHOT, [
          { field: 'workflow_name', value: workflowName },
        ]);
      } else if (resourceId) {
        rows = await this.#db.queryTable<RawWorkflowRun>(TABLE_WORKFLOW_SNAPSHOT, [
          { field: 'resourceId', value: resourceId },
        ]);
      } else {
        rows = await this.#db.queryTable<RawWorkflowRun>(TABLE_WORKFLOW_SNAPSHOT, undefined);
      }
    }

    // Apply any remaining filters that weren't handled server-side
    if (workflowName) rows = rows.filter(run => run.workflow_name === workflowName);
    if (resourceId) rows = rows.filter(run => run.resourceId === resourceId);
    if (fromDate) rows = rows.filter(run => new Date(run.createdAt).getTime() >= fromDate.getTime());
    if (toDate) rows = rows.filter(run => new Date(run.createdAt).getTime() <= toDate.getTime());
    if (status) {
      rows = rows.filter(run => {
        const snapshot = this.ensureSnapshot(run);
        return snapshot.status === status;
      });
    }

    const total = rows.length;
    rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (perPage !== undefined && page !== undefined) {
      const normalized = normalizePerPage(perPage, Number.MAX_SAFE_INTEGER);
      const offset = page * normalized;
      rows = rows.slice(offset, offset + normalized);
    }

    const runs: WorkflowRun[] = rows.map(run => ({
      workflowName: run.workflow_name,
      runId: run.run_id,
      snapshot: this.ensureSnapshot(run),
      createdAt: new Date(run.createdAt),
      updatedAt: new Date(run.updatedAt),
      resourceId: run.resourceId,
    }));

    return { runs, total };
  }

  async getWorkflowRunById({
    runId,
    workflowName,
  }: {
    runId: string;
    workflowName?: string;
  }): Promise<WorkflowRun | null> {
    // If we have workflowName, use the semantic operation
    if (workflowName) {
      try {
        const match = await this.#db.getWorkflowRun<RawWorkflowRun>(workflowName, runId);
        if (!match) return null;
        return this.deserializeWorkflowRun(match);
      } catch {
        // Fall through to generic lookup
      }
    }

    // Fallback: query all runs and filter
    const runs = await this.#db.queryTable<RawWorkflowRun>(TABLE_WORKFLOW_SNAPSHOT, undefined, 1000);
    const match = runs.find(run => run.run_id === runId && (!workflowName || run.workflow_name === workflowName));
    if (!match) return null;

    return this.deserializeWorkflowRun(match);
  }

  async deleteWorkflowRunById({ runId, workflowName }: { runId: string; workflowName: string }): Promise<void> {
    await this.#db.deleteMany(TABLE_WORKFLOW_SNAPSHOT, [`${workflowName}-${runId}`]);
  }

  private async getRun(workflowName: string, runId: string): Promise<RawWorkflowRun | null> {
    // Use semantic operation for optimized lookup
    try {
      return await this.#db.getWorkflowRun<RawWorkflowRun>(workflowName, runId);
    } catch {
      // Fallback to queryTable with filter
      const runs = await this.#db.queryTable<RawWorkflowRun>(TABLE_WORKFLOW_SNAPSHOT, [
        { field: 'workflow_name', value: workflowName },
      ]);
      return runs.find(run => run.run_id === runId) ?? null;
    }
  }

  private deserializeWorkflowRun(run: RawWorkflowRun): WorkflowRun {
    return {
      workflowName: run.workflow_name,
      runId: run.run_id,
      snapshot: this.ensureSnapshot(run),
      createdAt: new Date(run.createdAt),
      updatedAt: new Date(run.updatedAt),
      resourceId: run.resourceId,
    };
  }

  private ensureSnapshot(run: { snapshot: WorkflowRunState | string }): WorkflowRunState {
    if (!run.snapshot) {
      return {
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
        runId: '',
      };
    }

    if (typeof run.snapshot === 'string') {
      return JSON.parse(run.snapshot);
    }

    return JSON.parse(JSON.stringify(run.snapshot));
  }
}
