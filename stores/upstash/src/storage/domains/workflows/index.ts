import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { normalizePerPage, TABLE_WORKFLOW_SNAPSHOT, WorkflowsStorageBase } from '@mastra/core/storage';
import type { StorageListWorkflowRunsInput, WorkflowRun, WorkflowRuns } from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import { UpstashDomainBase } from '../base';
import type { UpstashDomainConfig } from '../base';
import { ensureDate, getKey } from '../utils';

function parseWorkflowRun(row: any): WorkflowRun {
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
export class WorkflowsStorageUpstash extends WorkflowsStorageBase {
  private domainBase: UpstashDomainBase;

  constructor(opts: UpstashDomainConfig) {
    super();
    this.domainBase = new UpstashDomainBase(opts);
  }

  async init(): Promise<void> {
    // Upstash/Redis doesn't require table creation
  }

  async close(): Promise<void> {
    // Redis client doesn't need explicit cleanup
  }

  async dropData(): Promise<void> {
    await this.domainBase.getOperations().clearKeyspace({ tableName: TABLE_WORKFLOW_SNAPSHOT });
  }

  updateWorkflowResults(
    {
      // workflowId,
      // runId,
      // stepId,
      // result,
      // requestContext,
    }: {
      workflowId: string;
      runId: string;
      stepId: string;
      result: StepResult<any, any, any, any>;
      requestContext: Record<string, any>;
    },
  ): Promise<Record<string, StepResult<any, any, any, any>>> {
    throw new Error('Method not implemented.');
  }
  updateWorkflowState(
    {
      // workflowId,
      // runId,
      // opts,
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
    },
  ): Promise<WorkflowRunState | undefined> {
    throw new Error('Method not implemented.');
  }

  async createWorkflowSnapshot(params: {
    namespace: string;
    workflowId: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
    createdAt?: Date;
    updatedAt?: Date;
  }): Promise<void> {
    const { namespace = 'workflows', workflowId, runId, resourceId, snapshot } = params;
    try {
      await this.domainBase.getOperations().insert({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        record: {
          namespace,
          workflow_name: workflowId,
          run_id: runId,
          resourceId,
          snapshot,
          createdAt: params.createdAt ?? new Date(),
          updatedAt: params.updatedAt ?? new Date(),
        },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_UPSTASH_STORAGE_PERSIST_WORKFLOW_SNAPSHOT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            namespace,
            workflowId,
            runId,
          },
        },
        error,
      );
    }
  }

  async getWorkflowSnapshot(params: {
    namespace: string;
    workflowId: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    const { namespace = 'workflows', workflowId, runId } = params;
    const key = getKey(TABLE_WORKFLOW_SNAPSHOT, {
      namespace,
      workflow_name: workflowId,
      run_id: runId,
    });
    try {
      const data = await this.domainBase.getClient().get<{
        namespace: string;
        workflow_name: string;
        run_id: string;
        snapshot: WorkflowRunState;
      }>(key);
      if (!data) return null;
      return data.snapshot;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_UPSTASH_STORAGE_LOAD_WORKFLOW_SNAPSHOT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            namespace,
            workflowId,
            runId,
          },
        },
        error,
      );
    }
  }

  async getWorkflowRunById({ runId, workflowId }: { runId: string; workflowId?: string }): Promise<WorkflowRun | null> {
    try {
      const key =
        getKey(TABLE_WORKFLOW_SNAPSHOT, { namespace: 'workflows', workflow_name: workflowId, run_id: runId }) + '*';
      const keys = await this.domainBase.getOperations().scanKeys(key);
      const workflows = await Promise.all(
        keys.map(async key => {
          const data = await this.domainBase.getClient().get<{
            workflow_name: string;
            run_id: string;
            snapshot: WorkflowRunState | string;
            createdAt: string | Date;
            updatedAt: string | Date;
            resourceId: string;
          }>(key);
          return data;
        }),
      );
      const data = workflows.find(w => w?.run_id === runId && w?.workflow_name === workflowId) as WorkflowRun | null;
      if (!data) return null;
      return parseWorkflowRun(data);
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_UPSTASH_STORAGE_GET_WORKFLOW_RUN_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            namespace: 'workflows',
            runId,
            workflowId: workflowId || '',
          },
        },
        error,
      );
    }
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
    try {
      if (page !== undefined && page < 0) {
        throw new MastraError(
          {
            id: 'UPSTASH_STORE_INVALID_PAGE',
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { page },
          },
          new Error('page must be >= 0'),
        );
      }

      // Get all workflow keys
      let pattern = getKey(TABLE_WORKFLOW_SNAPSHOT, { namespace: 'workflows' }) + ':*';
      if (workflowId && resourceId) {
        pattern = getKey(TABLE_WORKFLOW_SNAPSHOT, {
          namespace: 'workflows',
          workflow_name: workflowId,
          run_id: '*',
          resourceId,
        });
      } else if (workflowId) {
        pattern = getKey(TABLE_WORKFLOW_SNAPSHOT, { namespace: 'workflows', workflow_name: workflowId }) + ':*';
      } else if (resourceId) {
        pattern = getKey(TABLE_WORKFLOW_SNAPSHOT, {
          namespace: 'workflows',
          workflow_name: '*',
          run_id: '*',
          resourceId,
        });
      }
      const keys = await this.domainBase.getOperations().scanKeys(pattern);

      // Check if we have any keys before using pipeline
      if (keys.length === 0) {
        return { runs: [], total: 0 };
      }

      // Use pipeline for batch fetching to improve performance
      const pipeline = this.domainBase.getClient().pipeline();
      keys.forEach(key => pipeline.get(key));
      const results = await pipeline.exec();

      // Filter and transform results - handle undefined results
      let runs = results
        .map((result: any) => result as Record<string, any> | null)
        .filter(
          (record): record is Record<string, any> =>
            record !== null && record !== undefined && typeof record === 'object' && 'workflow_name' in record,
        )
        // Only filter by workflowName if it was specifically requested
        .filter(record => !workflowId || record.workflow_name === workflowId)
        .map(w => parseWorkflowRun(w!))
        .filter(w => {
          if (fromDate && w.createdAt < fromDate) return false;
          if (toDate && w.createdAt > toDate) return false;
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

      // Apply pagination if requested
      if (typeof perPage === 'number' && typeof page === 'number') {
        const normalizedPerPage = normalizePerPage(perPage, Number.MAX_SAFE_INTEGER);
        const offset = page * normalizedPerPage;
        runs = runs.slice(offset, offset + normalizedPerPage);
      }

      return { runs, total };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_UPSTASH_STORAGE_LIST_WORKFLOW_RUNS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            namespace: 'workflows',
            workflowId: workflowId || '',
            resourceId: resourceId || '',
          },
        },
        error,
      );
    }
  }
}
