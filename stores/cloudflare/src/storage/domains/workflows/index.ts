import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { TABLE_WORKFLOW_SNAPSHOT, ensureDate, WorkflowsStorage } from '@mastra/core/storage';
import type { WorkflowRun, WorkflowRuns } from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import type { StoreOperationsCloudflare } from '../operations';

export class WorkflowsStorageCloudflare extends WorkflowsStorage {
  private operations: StoreOperationsCloudflare;

  constructor({ operations }: { operations: StoreOperationsCloudflare }) {
    super();
    this.operations = operations;
  }

  private validateWorkflowParams(params: { workflowName: string; runId: string }): void {
    const { workflowName, runId } = params;
    if (!workflowName || !runId) {
      throw new Error('Invalid workflow snapshot parameters');
    }
  }

  updateWorkflowResults(
    {
      // workflowName,
      // runId,
      // stepId,
      // result,
      // runtimeContext,
    }: {
      workflowName: string;
      runId: string;
      stepId: string;
      result: StepResult<any, any, any, any>;
      runtimeContext: Record<string, any>;
    },
  ): Promise<Record<string, StepResult<any, any, any, any>>> {
    throw new Error('Method not implemented.');
  }
  updateWorkflowState(
    {
      // workflowName,
      // runId,
      // opts,
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
    },
  ): Promise<WorkflowRunState | undefined> {
    throw new Error('Method not implemented.');
  }

  async persistWorkflowSnapshot(params: {
    workflowName: string;
    runId: string;
    snapshot: WorkflowRunState;
  }): Promise<void> {
    try {
      const { workflowName, runId, snapshot } = params;

      await this.operations.putKV({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        key: this.operations.getKey(TABLE_WORKFLOW_SNAPSHOT, { workflow_name: workflowName, run_id: runId }),
        value: {
          workflow_name: workflowName,
          run_id: runId,
          snapshot: typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_PERSIST_WORKFLOW_SNAPSHOT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Error persisting workflow snapshot for workflow ${params.workflowName}, run ${params.runId}`,
          details: {
            workflowName: params.workflowName,
            runId: params.runId,
          },
        },
        error,
      );
    }
  }

  async loadWorkflowSnapshot(params: { workflowName: string; runId: string }): Promise<WorkflowRunState | null> {
    try {
      this.validateWorkflowParams(params);
      const { workflowName, runId } = params;

      const key = this.operations.getKey(TABLE_WORKFLOW_SNAPSHOT, { workflow_name: workflowName, run_id: runId });
      const data = await this.operations.getKV(TABLE_WORKFLOW_SNAPSHOT, key);
      if (!data) return null;

      // Parse the snapshot from JSON string if needed
      const snapshotData = typeof data.snapshot === 'string' ? JSON.parse(data.snapshot) : data.snapshot;
      return snapshotData;
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_LOAD_WORKFLOW_SNAPSHOT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Error loading workflow snapshot for workflow ${params.workflowName}, run ${params.runId}`,
          details: {
            workflowName: params.workflowName,
            runId: params.runId,
          },
        },
        error,
      );
      this.logger.trackException?.(mastraError);
      this.logger.error(mastraError.toString());
      return null;
    }
  }

  private parseWorkflowRun(row: any): WorkflowRun {
    let parsedSnapshot: WorkflowRunState | string = row.snapshot as string;
    if (typeof parsedSnapshot === 'string') {
      try {
        parsedSnapshot = JSON.parse(row.snapshot as string) as WorkflowRunState;
      } catch (e) {
        // If parsing fails, return the raw snapshot string
        console.warn(`Failed to parse snapshot for workflow ${row.workflow_name}: ${e}`);
      }
    }

    return {
      workflowName: row.workflow_name,
      runId: row.run_id,
      snapshot: parsedSnapshot,
      createdAt: ensureDate(row.createdAt)!,
      updatedAt: ensureDate(row.updatedAt)!,
      resourceId: row.resourceId,
    };
  }

  private buildWorkflowSnapshotPrefix({
    workflowName,
    runId,
    resourceId,
  }: {
    namespace?: string;
    workflowName?: string;
    runId?: string;
    resourceId?: string;
  }): string {
    // Add namespace prefix if configured
    const prefix = this.operations.namespacePrefix ? `${this.operations.namespacePrefix}:` : '';
    let key = `${prefix}${TABLE_WORKFLOW_SNAPSHOT}`;
    if (workflowName) key += `:${workflowName}`;
    if (runId) key += `:${runId}`;
    if (resourceId) key += `:${resourceId}`;
    return key;
  }

  async getWorkflowRuns({
    workflowName,
    limit = 20,
    offset = 0,
    resourceId,
    fromDate,
    toDate,
  }: {
    workflowName?: string;
    limit?: number;
    offset?: number;
    resourceId?: string;
    fromDate?: Date;
    toDate?: Date;
  } = {}): Promise<WorkflowRuns> {
    try {
      // List all keys in the workflow snapshot table
      const prefix = this.buildWorkflowSnapshotPrefix({ workflowName });
      const keyObjs = await this.operations.listKV(TABLE_WORKFLOW_SNAPSHOT, { prefix });
      const runs: WorkflowRun[] = [];
      for (const { name: key } of keyObjs) {
        // Extract workflow_name, run_id, resourceId from key
        const parts = key.split(':');
        const idx = parts.indexOf(TABLE_WORKFLOW_SNAPSHOT);
        if (idx === -1 || parts.length < idx + 3) continue;
        const wfName = parts[idx + 1];
        const _runId = parts[idx + 2];
        // If resourceId is present in the key, it's at idx+3
        const keyResourceId = parts.length > idx + 3 ? parts[idx + 3] : undefined;
        // Filter by namespace, workflowName, resourceId if provided
        if (workflowName && wfName !== workflowName) continue;
        // If resourceId filter is provided, the key must have that resourceId
        if (resourceId && keyResourceId !== resourceId) continue;
        // Load the snapshot
        const data = await this.operations.getKV(TABLE_WORKFLOW_SNAPSHOT, key);
        if (!data) continue;
        try {
          // Additional check: if resourceId filter is provided but key doesn't have resourceId, skip
          if (resourceId && !keyResourceId) continue;
          // Filter by fromDate/toDate
          const createdAt = ensureDate(data.createdAt);
          if (fromDate && createdAt && createdAt < fromDate) continue;
          if (toDate && createdAt && createdAt > toDate) continue;
          // Parse the snapshot from JSON string if needed
          const snapshotData = typeof data.snapshot === 'string' ? JSON.parse(data.snapshot) : data.snapshot;
          const resourceIdToUse = keyResourceId || data.resourceId;
          const run = this.parseWorkflowRun({
            ...data,
            workflow_name: wfName,
            resourceId: resourceIdToUse,
            snapshot: snapshotData,
          });
          runs.push(run);
        } catch (err) {
          this.logger.error('Failed to parse workflow snapshot:', { key, error: err });
        }
      }
      // Sort by createdAt descending
      runs.sort((a, b) => {
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bDate - aDate;
      });
      // Apply pagination
      const pagedRuns = runs.slice(offset, offset + limit);
      return {
        runs: pagedRuns,
        total: runs.length,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_GET_WORKFLOW_RUNS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
      this.logger.trackException?.(mastraError);
      this.logger.error(mastraError.toString());
      return { runs: [], total: 0 };
    }
  }

  async getWorkflowRunById({
    runId,
    workflowName,
  }: {
    runId: string;
    workflowName: string;
  }): Promise<WorkflowRun | null> {
    try {
      if (!runId || !workflowName) {
        throw new Error('runId, workflowName, are required');
      }
      // Try to find the data by listing keys with the prefix and finding the exact match
      const prefix = this.buildWorkflowSnapshotPrefix({ workflowName, runId });
      const keyObjs = await this.operations.listKV(TABLE_WORKFLOW_SNAPSHOT, { prefix });
      if (!keyObjs.length) return null;

      // Find the exact key that matches our workflow and run
      const exactKey = keyObjs.find(k => {
        const parts = k.name.split(':');
        const idx = parts.indexOf(TABLE_WORKFLOW_SNAPSHOT);
        if (idx === -1 || parts.length < idx + 3) return false;
        const wfName = parts[idx + 1];
        const rId = parts[idx + 2];
        return wfName === workflowName && rId === runId;
      });

      if (!exactKey) return null;
      const data = await this.operations.getKV(TABLE_WORKFLOW_SNAPSHOT, exactKey.name);
      if (!data) return null;
      // Parse the snapshot from JSON string if needed
      const snapshotData = typeof data.snapshot === 'string' ? JSON.parse(data.snapshot) : data.snapshot;
      return this.parseWorkflowRun({ ...data, snapshot: snapshotData });
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_GET_WORKFLOW_RUN_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            workflowName,
            runId,
          },
        },
        error,
      );
      this.logger.trackException?.(mastraError);
      this.logger.error(mastraError.toString());
      return null;
    }
  }
}
