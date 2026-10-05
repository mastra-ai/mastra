import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  normalizePerPage,
  TABLE_WORKFLOW_SNAPSHOT,
  matchesExpectedWorkflowStatus,
  WorkflowsStorage,
  ensureDate,
} from '@mastra/core/storage';
import type {
  StorageListWorkflowRunsInput,
  WorkflowRun,
  WorkflowRuns,
  UpdateWorkflowStateOptions,
} from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';

import { RedisDB } from '../../db';
import type { RedisDomainConfig } from '../../db';
import type { RedisClient } from '../../types';
import { getKey } from '../utils';

function parseWorkflowRun(row: Record<string, unknown>): WorkflowRun {
  let parsedSnapshot: WorkflowRunState | string = row.snapshot as string;
  if (typeof parsedSnapshot === 'string') {
    try {
      parsedSnapshot = JSON.parse(row.snapshot as string) as WorkflowRunState;
    } catch (e) {
      console.warn(`Failed to parse snapshot for workflow ${row.workflow_name}: ${e}`);
    }
  }

  return {
    workflowName: row.workflow_name as string,
    runId: row.run_id as string,
    snapshot: parsedSnapshot,
    createdAt: ensureDate(row.createdAt as string | Date)!,
    updatedAt: ensureDate(row.updatedAt as string | Date)!,
    resourceId: row.resourceId as string | undefined,
  };
}

type SnapshotRecord = {
  namespace: string;
  workflow_name: string;
  run_id: string;
  resourceId?: string;
  snapshot: WorkflowRunState;
  createdAt: string | Date;
  updatedAt: string | Date;
};

function escapeGlob(value: string): string {
  return value.replace(/[*?[\]\\]/g, '\\$&');
}

function snapshotKey(namespace: string, workflowName: string, runId: string): string {
  return getKey(TABLE_WORKFLOW_SNAPSHOT, { namespace, workflow_name: workflowName, run_id: runId });
}

/**
 * Earlier versions appended `:resourceId:<id>` to snapshot keys. Matches those keys for a run.
 */
function legacySnapshotKeyPattern(namespace: string, workflowName: string, runId: string): string {
  return `${escapeGlob(snapshotKey(namespace, workflowName, runId))}:resourceId:*`;
}

export class WorkflowsRedis extends WorkflowsStorage {
  private client: RedisClient;
  private db: RedisDB;

  constructor(config: RedisDomainConfig) {
    super();
    this.client = config.client;
    this.db = new RedisDB({ client: config.client });
  }

  /**
   * Reads a run's snapshot record by its canonical key, falling back to legacy
   * `:resourceId:`-suffixed keys only when the canonical key is missing.
   */
  private async getSnapshotRecord(
    namespace: string,
    workflowName: string,
    runId: string,
  ): Promise<SnapshotRecord | null> {
    const data = await this.client.get(snapshotKey(namespace, workflowName, runId));
    if (data) {
      return JSON.parse(data) as SnapshotRecord;
    }

    const legacyKeys = await this.db.scanKeys(legacySnapshotKeyPattern(namespace, workflowName, runId));
    if (legacyKeys.length === 0) {
      return null;
    }
    const legacyData = await this.client.get(legacyKeys[0]!);
    return legacyData ? (JSON.parse(legacyData) as SnapshotRecord) : null;
  }

  public supportsConcurrentUpdates(): boolean {
    return false;
  }

  public async dangerouslyClearAll(): Promise<void> {
    await this.db.deleteData({ tableName: TABLE_WORKFLOW_SNAPSHOT });
  }

  public async updateWorkflowResults({
    workflowName,
    runId,
    stepId,
    result,
    requestContext,
  }: {
    workflowName: string;
    runId: string;
    stepId: string;
    result: StepResult<unknown, unknown, unknown, unknown>;
    requestContext: Record<string, unknown>;
  }): Promise<Record<string, StepResult<unknown, unknown, unknown, unknown>>> {
    try {
      const existingRecord = await this.getSnapshotRecord('workflows', workflowName, runId);

      const existingSnapshot = existingRecord?.snapshot;
      let snapshot = existingSnapshot;

      if (!snapshot) {
        snapshot = {
          context: {},
          activePaths: [],
          timestamp: Date.now(),
          suspendedPaths: {},
          activeStepsPath: {},
          resumeLabels: {},
          serializedStepGraph: [],
          status: 'pending',
          value: {},
          waitingPaths: {},
          runId,
          requestContext: {},
        } as WorkflowRunState;
      }

      snapshot.context[stepId] = result;
      snapshot.requestContext = { ...snapshot.requestContext, ...requestContext };

      await this.persistWorkflowSnapshot({
        namespace: 'workflows',
        workflowName,
        runId,
        resourceId: existingRecord?.resourceId,
        snapshot,
        createdAt: existingRecord?.createdAt ? ensureDate(existingRecord.createdAt) : undefined,
      });

      return snapshot.context;
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('REDIS', 'UPDATE_WORKFLOW_RESULTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName, runId, stepId },
        },
        error,
      );
    }
  }

  public async updateWorkflowState({
    workflowName,
    runId,
    opts,
  }: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
  }): Promise<WorkflowRunState | undefined> {
    try {
      const existingRecord = await this.getSnapshotRecord('workflows', workflowName, runId);

      const existingSnapshot = existingRecord?.snapshot;

      if (!existingSnapshot || !existingSnapshot.context) {
        return undefined;
      }

      // Best-effort only: this store reports `supportsConcurrentUpdates() === false`, so the
      // read and the write are not a single critical section.
      const { expectedStatus, ...state } = opts;
      if (!matchesExpectedWorkflowStatus(existingSnapshot.status, expectedStatus)) {
        return undefined;
      }

      const updatedSnapshot = { ...existingSnapshot, ...state };

      await this.persistWorkflowSnapshot({
        namespace: 'workflows',
        workflowName,
        runId,
        resourceId: existingRecord.resourceId,
        snapshot: updatedSnapshot,
        createdAt: existingRecord?.createdAt ? ensureDate(existingRecord.createdAt) : undefined,
      });

      return updatedSnapshot;
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('REDIS', 'UPDATE_WORKFLOW_STATE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName, runId },
        },
        error,
      );
    }
  }

  public async persistWorkflowSnapshot(params: {
    namespace?: string;
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
    createdAt?: Date;
    updatedAt?: Date;
  }): Promise<void> {
    const { namespace = 'workflows', workflowName, runId, resourceId, snapshot, createdAt, updatedAt } = params;
    try {
      let finalCreatedAt = createdAt;
      let finalResourceId = resourceId;
      if (!finalCreatedAt || !finalResourceId) {
        // No SCAN here (it would run on every new run); a legacy key is only reachable when resourceId is known.
        const canonicalKey = snapshotKey(namespace, workflowName, runId);
        const existingData =
          (await this.client.get(canonicalKey)) ??
          (resourceId ? await this.client.get(`${canonicalKey}:resourceId:${resourceId}`) : null);
        const existing = existingData ? (JSON.parse(existingData) as SnapshotRecord) : null;
        finalCreatedAt ??= existing?.createdAt ? ensureDate(existing.createdAt) : new Date();
        finalResourceId ??= existing?.resourceId;
      }

      await this.db.insert({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        record: {
          namespace,
          workflow_name: workflowName,
          run_id: runId,
          resourceId: finalResourceId,
          snapshot,
          createdAt: finalCreatedAt,
          updatedAt: updatedAt ?? new Date(),
        },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('REDIS', 'PERSIST_WORKFLOW_SNAPSHOT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            namespace,
            workflowName,
            runId,
          },
        },
        error,
      );
    }
  }

  public async loadWorkflowSnapshot(params: {
    namespace: string;
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    const { namespace = 'workflows', workflowName, runId } = params;
    try {
      const record = await this.getSnapshotRecord(namespace, workflowName, runId);
      return record?.snapshot ?? null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('REDIS', 'LOAD_WORKFLOW_SNAPSHOT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            namespace,
            workflowName,
            runId,
          },
        },
        error,
      );
    }
  }

  public async getWorkflowRunById({
    runId,
    workflowName,
  }: {
    runId: string;
    workflowName?: string;
  }): Promise<WorkflowRun | null> {
    try {
      const workflowNamePattern = workflowName ? escapeGlob(workflowName) : '*';
      const canonicalPattern = `${escapeGlob(getKey(TABLE_WORKFLOW_SNAPSHOT, { namespace: 'workflows' }))}:workflow_name:${workflowNamePattern}:run_id:${escapeGlob(runId)}`;
      const keys = [
        ...(await this.db.scanKeys(canonicalPattern)),
        ...(await this.db.scanKeys(`${canonicalPattern}:resourceId:*`)),
      ];

      if (keys.length === 0) {
        return null;
      }

      const results = await this.client.mGet(keys);
      const workflows = results
        .filter((data): data is string => data !== null)
        .map(
          data =>
            JSON.parse(data) as {
              workflow_name: string;
              run_id: string;
              snapshot: WorkflowRunState | string;
              createdAt: string | Date;
              updatedAt: string | Date;
              resourceId: string;
            },
        );

      const data = workflows.find(workflow => {
        if (!workflow) {
          return false;
        }

        const runIdMatch = workflow.run_id === runId;

        if (workflowName) {
          return runIdMatch && workflow.workflow_name === workflowName;
        }

        return runIdMatch;
      });

      if (!data) {
        return null;
      }

      return parseWorkflowRun(data as Record<string, unknown>);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('REDIS', 'GET_WORKFLOW_RUN_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            namespace: 'workflows',
            runId,
            workflowName: workflowName || '',
          },
        },
        error,
      );
    }
  }

  public async deleteWorkflowRunById({ runId, workflowName }: { runId: string; workflowName: string }): Promise<void> {
    try {
      const legacyKeys = await this.db.scanKeys(legacySnapshotKeyPattern('workflows', workflowName, runId));
      await this.client.del([snapshotKey('workflows', workflowName, runId), ...legacyKeys]);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('REDIS', 'DELETE_WORKFLOW_RUN_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            namespace: 'workflows',
            runId,
            workflowName,
          },
        },
        error,
      );
    }
  }

  public async listWorkflowRuns({
    workflowName,
    fromDate,
    toDate,
    perPage,
    page,
    resourceId,
    status,
  }: StorageListWorkflowRunsInput = {}): Promise<WorkflowRuns> {
    try {
      if (page !== undefined && page < 0) {
        throw new MastraError(
          {
            id: createStorageErrorId('REDIS', 'LIST_WORKFLOW_RUNS', 'INVALID_PAGE'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { page },
          },
          new Error('page must be >= 0'),
        );
      }

      const normalizedFrom = fromDate ? ensureDate(fromDate) : undefined;
      const normalizedTo = toDate ? ensureDate(toDate) : undefined;

      const pattern = workflowName
        ? `${escapeGlob(getKey(TABLE_WORKFLOW_SNAPSHOT, { namespace: 'workflows', workflow_name: workflowName }))}:*`
        : `${getKey(TABLE_WORKFLOW_SNAPSHOT, { namespace: 'workflows' })}:*`;
      const keys = await this.db.scanKeys(pattern);

      if (keys.length === 0) {
        return { runs: [], total: 0 };
      }

      const results = await this.client.mGet(keys);

      // A run can exist under both its canonical key and a legacy `:resourceId:` key; the canonical one wins.
      const recordsByRun = new Map<string, { record: Record<string, unknown>; legacy: boolean }>();
      results.forEach((data, index) => {
        if (data === null) return;
        const record = JSON.parse(data) as Record<string, unknown>;
        if (record === null || typeof record !== 'object' || !('workflow_name' in record)) return;
        const legacy =
          keys[index] !==
          snapshotKey(
            (record.namespace as string | undefined) ?? 'workflows',
            record.workflow_name as string,
            record.run_id as string,
          );
        const runKey = `${record.workflow_name}\u0000${record.run_id}`;
        const current = recordsByRun.get(runKey);
        if (!current || (current.legacy && !legacy)) {
          recordsByRun.set(runKey, { record, legacy });
        }
      });

      let runs = [...recordsByRun.values()]
        .map(({ record }) => record)
        .filter(record => !workflowName || record.workflow_name === workflowName)
        .filter(record => !resourceId || record.resourceId === resourceId)
        .map(w => parseWorkflowRun(w))
        .filter(w => {
          if (normalizedFrom && w.createdAt < normalizedFrom) {
            return false;
          }
          if (normalizedTo && w.createdAt > normalizedTo) {
            return false;
          }
          if (status) {
            let snapshot = w.snapshot;
            if (typeof snapshot === 'string') {
              try {
                snapshot = JSON.parse(snapshot) as WorkflowRunState;
              } catch (e) {
                console.warn(`Failed to parse snapshot for workflow ${w.workflowName}: ${e}`);
                return false;
              }
            }
            return snapshot.status === status;
          }
          return true;
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const total = runs.length;

      if (typeof perPage === 'number' && typeof page === 'number') {
        const normalizedPerPage = normalizePerPage(perPage, Number.MAX_SAFE_INTEGER);
        const offset = page * normalizedPerPage;
        runs = runs.slice(offset, offset + normalizedPerPage);
      }

      return { runs, total };
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('REDIS', 'LIST_WORKFLOW_RUNS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            namespace: 'workflows',
            workflowName: workflowName || '',
            resourceId: resourceId || '',
          },
        },
        error,
      );
    }
  }
}
