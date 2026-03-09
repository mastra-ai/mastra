import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  TABLE_WORKFLOW_SNAPSHOT,
  ensureDate,
  WorkflowsStorage,
  normalizePerPage,
} from '@mastra/core/storage';
import type {
  WorkflowRun,
  WorkflowRuns,
  StorageListWorkflowRunsInput,
  UpdateWorkflowStateOptions,
} from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import { CloudflareKVDB, resolveCloudflareConfig } from '../../db';
import type { CloudflareDomainConfig } from '../../types';

export class WorkflowsStorageCloudflare extends WorkflowsStorage {
  #db: CloudflareKVDB;

  constructor(config: CloudflareDomainConfig) {
    super();
    this.#db = new CloudflareKVDB(resolveCloudflareConfig(config));
  }

  supportsConcurrentUpdates(): boolean {
    // Cloudflare KV is eventually-consistent and doesn't support atomic read-modify-write
    // operations or conditional writes needed for concurrent updates
    return false;
  }

  async init(): Promise<void> {
    // Cloudflare KV is schemaless, no table creation needed
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
  }

  private validateWorkflowParams(params: { workflowName: string; runId: string }): void {
    const { workflowName, runId } = params;
    if (!workflowName || !runId) {
      throw new Error('Invalid workflow snapshot parameters');
    }
  }

  async updateWorkflowResults(_args: {
    workflowName: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    requestContext: Record<string, any>;
  }): Promise<Record<string, StepResult<any, any, any, any>>> {
    throw new Error(
      'updateWorkflowResults is not implemented for Cloudflare KV storage. Cloudflare KV is eventually-consistent and does not support atomic read-modify-write operations needed for concurrent workflow updates.',
    );
  }

  async updateWorkflowState(_args: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
  }): Promise<WorkflowRunState | undefined> {
    throw new Error(
      'updateWorkflowState is not implemented for Cloudflare KV storage. Cloudflare KV is eventually-consistent and does not support atomic read-modify-write operations needed for concurrent workflow updates.',
    );
  }

  async persistWorkflowSnapshot(params: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
    createdAt?: Date;
    updatedAt?: Date;
  }): Promise<void> {
    try {
      const { workflowName, runId, resourceId, snapshot, createdAt, updatedAt } = params;
      const now = new Date();

      // Check if existing record exists to preserve createdAt
      const existingKey = this.#db.getKey(TABLE_WORKFLOW_SNAPSHOT, { workflow_name: workflowName, run_id: runId });
      const existing = await this.#db.getKV(TABLE_WORKFLOW_SNAPSHOT, existingKey);

      await this.#db.putKV({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        key: existingKey,
        value: {
          workflow_name: workflowName,
          run_id: runId,
          resourceId,
          snapshot: JSON.stringify(snapshot),
          createdAt: existing?.createdAt ?? createdAt ?? now,
          updatedAt: updatedAt ?? now,
        },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE', 'PERSIST_WORKFLOW_SNAPSHOT', 'FAILED'),
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

      const key = this.#db.getKey(TABLE_WORKFLOW_SNAPSHOT, { workflow_name: workflowName, run_id: runId });
      const data = await this.#db.getKV(TABLE_WORKFLOW_SNAPSHOT, key);
      if (!data) return null;

      // Parse the snapshot from JSON string if needed
      const snapshotData = typeof data.snapshot === 'string' ? JSON.parse(data.snapshot) : data.snapshot;
      return snapshotData;
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE', 'LOAD_WORKFLOW_SNAPSHOT', 'FAILED'),
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
        this.logger.warn(`Failed to parse snapshot for workflow ${row.workflow_name}: ${e}`);
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
    const prefix = this.#db.namespacePrefix ? `${this.#db.namespacePrefix}:` : '';
    let key = `${prefix}${TABLE_WORKFLOW_SNAPSHOT}`;
    if (workflowName) key += `:${workflowName}`;
    if (runId) key += `:${runId}`;
    if (resourceId) key += `:${resourceId}`;
    return key;
  }

  async listWorkflowRuns({
    workflowName,
    page = 0,
    perPage = 20,
    resourceId,
    fromDate,
    toDate,
    status,
  }: StorageListWorkflowRunsInput = {}): Promise<WorkflowRuns> {
    try {
      if (page < 0 || !Number.isInteger(page)) {
        throw new MastraError(
          {
            id: createStorageErrorId('CLOUDFLARE', 'LIST_WORKFLOW_RUNS', 'INVALID_PAGE'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { page },
          },
          new Error('page must be a non-negative integer'),
        );
      }

      const normalizedPerPage = normalizePerPage(perPage, 20);
      const offset = page * normalizedPerPage;
      // List all keys in the workflow snapshot table
      const prefix = this.buildWorkflowSnapshotPrefix({ workflowName });
      const keyObjs = await this.#db.listKV(TABLE_WORKFLOW_SNAPSHOT, { prefix });
      const runs: WorkflowRun[] = [];
      for (const { name: key } of keyObjs) {
        // Extract workflow_name, run_id, and optionally resourceId from key
        const parts = key.split(':');
        const idx = parts.indexOf(TABLE_WORKFLOW_SNAPSHOT);
        if (idx === -1 || parts.length < idx + 3) continue;
        const wfName = parts[idx + 1];
        // resourceId may be in key (legacy) at idx+3
        const keyResourceId = parts.length > idx + 3 ? parts[idx + 3] : undefined;
        // Filter by workflowName if provided
        if (workflowName && wfName !== workflowName) continue;
        // Load the snapshot
        const data = await this.#db.getKV(TABLE_WORKFLOW_SNAPSHOT, key);
        if (!data) continue;
        try {
          // Filter by resourceId - check both key (legacy) and data (current)
          const effectiveResourceId = keyResourceId || data.resourceId;
          if (resourceId && effectiveResourceId !== resourceId) continue;
          const snapshotData = typeof data.snapshot === 'string' ? JSON.parse(data.snapshot) : data.snapshot;
          if (status && snapshotData.status !== status) continue;
          // Filter by fromDate/toDate
          const createdAt = ensureDate(data.createdAt);
          if (fromDate && createdAt && createdAt < fromDate) continue;
          if (toDate && createdAt && createdAt > toDate) continue;
          // Parse the snapshot from JSON string if needed
          const run = this.parseWorkflowRun({
            ...data,
            workflow_name: wfName,
            resourceId: effectiveResourceId,
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
      const pagedRuns = runs.slice(offset, offset + normalizedPerPage);
      return {
        runs: pagedRuns,
        total: runs.length,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE', 'LIST_WORKFLOW_RUNS', 'FAILED'),
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
      const keyObjs = await this.#db.listKV(TABLE_WORKFLOW_SNAPSHOT, { prefix });
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
      const data = await this.#db.getKV(TABLE_WORKFLOW_SNAPSHOT, exactKey.name);
      if (!data) return null;
      // Parse the snapshot from JSON string if needed
      const snapshotData = typeof data.snapshot === 'string' ? JSON.parse(data.snapshot) : data.snapshot;
      return this.parseWorkflowRun({ ...data, snapshot: snapshotData });
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE', 'GET_WORKFLOW_RUN_BY_ID', 'FAILED'),
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

  async deleteWorkflowRunById({ runId, workflowName }: { runId: string; workflowName: string }): Promise<void> {
    try {
      if (!runId || !workflowName) {
        throw new Error('runId and workflowName are required');
      }
      const key = this.#db.getKey(TABLE_WORKFLOW_SNAPSHOT, { workflow_name: workflowName, run_id: runId });
      await this.#db.deleteKV(TABLE_WORKFLOW_SNAPSHOT, key);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE', 'DELETE_WORKFLOW_RUN_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            workflowName,
            runId,
          },
        },
        error,
      );
    }
  }
}
