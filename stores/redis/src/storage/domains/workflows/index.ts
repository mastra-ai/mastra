import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  normalizePerPage,
  TABLE_WORKFLOW_SNAPSHOT,
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

export class WorkflowsRedis extends WorkflowsStorage {
  private client: RedisClient;
  private db: RedisDB;

  constructor(config: RedisDomainConfig) {
    super();
    this.client = config.client;
    this.db = new RedisDB({ client: config.client });
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
      const existingSnapshot = await this.loadWorkflowSnapshot({
        namespace: 'workflows',
        workflowName,
        runId,
      });

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
        snapshot,
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
      const existingSnapshot = await this.loadWorkflowSnapshot({
        namespace: 'workflows',
        workflowName,
        runId,
      });

      if (!existingSnapshot || !existingSnapshot.context) {
        return undefined;
      }

      const updatedSnapshot = { ...existingSnapshot, ...opts };

      await this.persistWorkflowSnapshot({
        namespace: 'workflows',
        workflowName,
        runId,
        snapshot: updatedSnapshot,
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
      await this.db.insert({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        record: {
          namespace,
          workflow_name: workflowName,
          run_id: runId,
          resourceId,
          snapshot,
          createdAt: createdAt ?? new Date(),
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
    const key = getKey(TABLE_WORKFLOW_SNAPSHOT, {
      namespace,
      workflow_name: workflowName,
      run_id: runId,
    });
    try {
      const data = await this.client.get(key);
      if (!data) {
        return null;
      }
      const parsed = JSON.parse(data) as {
        namespace: string;
        workflow_name: string;
        run_id: string;
        snapshot: WorkflowRunState;
      };
      return parsed.snapshot;
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
      const key =
        getKey(TABLE_WORKFLOW_SNAPSHOT, { namespace: 'workflows', workflow_name: workflowName, run_id: runId }) + '*';
      const keys = await this.db.scanKeys(key);

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

      const data = workflows.find(w => w?.run_id === runId && w?.workflow_name === workflowName);
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
    const key = getKey(TABLE_WORKFLOW_SNAPSHOT, { namespace: 'workflows', workflow_name: workflowName, run_id: runId });
    try {
      await this.client.del(key);
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

      let pattern = getKey(TABLE_WORKFLOW_SNAPSHOT, { namespace: 'workflows' }) + ':*';
      if (workflowName && resourceId) {
        pattern = getKey(TABLE_WORKFLOW_SNAPSHOT, {
          namespace: 'workflows',
          workflow_name: workflowName,
          run_id: '*',
          resourceId,
        });
      } else if (workflowName) {
        pattern = getKey(TABLE_WORKFLOW_SNAPSHOT, { namespace: 'workflows', workflow_name: workflowName }) + ':*';
      } else if (resourceId) {
        pattern = getKey(TABLE_WORKFLOW_SNAPSHOT, {
          namespace: 'workflows',
          workflow_name: '*',
          run_id: '*',
          resourceId,
        });
      }
      const keys = await this.db.scanKeys(pattern);

      if (keys.length === 0) {
        return { runs: [], total: 0 };
      }

      const results = await this.client.mGet(keys);

      let runs = results
        .filter((data): data is string => data !== null)
        .map(data => JSON.parse(data) as Record<string, unknown>)
        .filter(
          (record): record is Record<string, unknown> =>
            record !== null && record !== undefined && typeof record === 'object' && 'workflow_name' in record,
        )
        .filter(record => !workflowName || record.workflow_name === workflowName)
        .map(w => parseWorkflowRun(w))
        .filter(w => {
          if (fromDate && w.createdAt < fromDate) {
            return false;
          }
          if (toDate && w.createdAt > toDate) {
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
