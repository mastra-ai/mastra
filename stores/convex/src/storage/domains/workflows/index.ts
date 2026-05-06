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

  supportsConcurrentUpdates(): boolean {
    return false;
  }

  async init(): Promise<void> {
    // No-op for Convex; schema is managed server-side.
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
  }

  async updateWorkflowResults(_args: {
    workflowName: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    requestContext: Record<string, any>;
  }): Promise<Record<string, StepResult<any, any, any, any>>> {
    throw new Error(
      'updateWorkflowResults is not implemented for Convex storage. Convex does not support atomic read-modify-write operations needed for concurrent workflow updates.',
    );
  }

  async updateWorkflowState(_args: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
  }): Promise<WorkflowRunState | undefined> {
    throw new Error(
      'updateWorkflowState is not implemented for Convex storage. Convex does not support atomic read-modify-write operations needed for concurrent workflow updates.',
    );
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
    const now = new Date();
    // Check if a record already exists to preserve createdAt
    const existing = await this.#db.load<{ createdAt?: string } | null>({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      keys: { workflow_name: workflowName, run_id: runId },
    });

    await this.#db.insert({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      record: {
        workflow_name: workflowName,
        run_id: runId,
        resourceId,
        // Convex rejects any field whose name starts with `$` (reserved prefix).
        // Workflow snapshots embed tool outputs whose serialized Zod->JSON Schemas
        // contain $schema/$ref/$defs/$id keys, so we serialize the snapshot here.
        // loadWorkflowSnapshot / ensureSnapshot already handle the string case.
        snapshot: JSON.stringify(snapshot),
        createdAt: existing?.createdAt ?? (createdAt ? new Date(createdAt).toISOString() : now.toISOString()),
        updatedAt: updatedAt ? new Date(updatedAt).toISOString() : now.toISOString(),
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
    const row = await this.#db.load<{ snapshot: WorkflowRunState | string } | null>({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      keys: { workflow_name: workflowName, run_id: runId },
    });

    if (!row) return null;
    return typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : JSON.parse(JSON.stringify(row.snapshot));
  }

  async listWorkflowRuns(args: StorageListWorkflowRunsInput = {}): Promise<WorkflowRuns> {
    const { workflowName, fromDate, toDate, perPage, page, resourceId, status } = args;

    // Pass known filters to queryTable for server-side filtering instead of fetching all rows
    const filters: Array<{ field: string; value: string }> = [];
    if (workflowName) {
      filters.push({ field: 'workflow_name', value: workflowName });
    }
    if (resourceId) {
      filters.push({ field: 'resourceId', value: resourceId });
    }

    let rows = await this.#db.queryTable<RawWorkflowRun>(
      TABLE_WORKFLOW_SNAPSHOT,
      filters.length > 0 ? filters : undefined,
    );
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
    let match: RawWorkflowRun | null;
    if (workflowName) {
      // O(1) composite key lookup via by_workflow_run index
      match = await this.#db.load<RawWorkflowRun | null>({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        keys: { workflow_name: workflowName, run_id: runId },
      });
    } else {
      // Fallback: filter by run_id server-side (no dedicated index, but avoids full unfiltered scan)
      const rows = await this.#db.queryTable<RawWorkflowRun>(TABLE_WORKFLOW_SNAPSHOT, [
        { field: 'run_id', value: runId },
      ]);
      match = rows[0] ?? null;
    }
    if (!match) return null;

    return {
      workflowName: match.workflow_name,
      runId: match.run_id,
      snapshot: this.ensureSnapshot(match),
      createdAt: new Date(match.createdAt),
      updatedAt: new Date(match.updatedAt),
      resourceId: match.resourceId,
    };
  }

  async deleteWorkflowRunById({ runId, workflowName }: { runId: string; workflowName: string }): Promise<void> {
    await this.#db.deleteMany(TABLE_WORKFLOW_SNAPSHOT, [`${workflowName}-${runId}`]);
  }

  private async getRun(workflowName: string, runId: string): Promise<RawWorkflowRun | null> {
    // O(1) composite key lookup instead of querying by workflow_name then filtering in JS
    return this.#db.load<RawWorkflowRun | null>({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      keys: { workflow_name: workflowName, run_id: runId },
    });
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
