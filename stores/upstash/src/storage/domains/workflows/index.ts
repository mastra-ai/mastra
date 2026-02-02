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
import type { Redis } from '@upstash/redis';
import { UpstashDB, resolveUpstashConfig } from '../../db';
import type { UpstashDomainConfig } from '../../db';
import { getKey } from '../utils';

export class WorkflowsUpstash extends WorkflowsStorage {
  private client: Redis;
  #db: UpstashDB;

  constructor(config: UpstashDomainConfig) {
    super();
    const client = resolveUpstashConfig(config);
    this.client = client;
    this.#db = new UpstashDB({ client });
  }

  supportsConcurrentUpdates(): boolean {
    return true;
  }

  private parseWorkflowRun(row: any): WorkflowRun {
    let parsedSnapshot: WorkflowRunState | string = row.snapshot as string;
    if (typeof parsedSnapshot === 'string') {
      try {
        parsedSnapshot = JSON.parse(row.snapshot as string) as WorkflowRunState;
      } catch (e) {
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

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_WORKFLOW_SNAPSHOT });
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
    try {
      const key = getKey(TABLE_WORKFLOW_SNAPSHOT, {
        namespace: 'workflows',
        workflow_name: workflowName,
        run_id: runId,
      });

      const now = new Date().toISOString();

      // Use Lua script for atomic read-modify-write operation
      // This ensures concurrent updates don't overwrite each other
      // The script returns the updated full record as JSON string
      const luaScript = `
        local key = KEYS[1]
        local stepId = ARGV[1]
        local resultJson = ARGV[2]
        local requestContextJson = ARGV[3]
        local now = ARGV[4]
        local namespace = ARGV[5]
        local workflowName = ARGV[6]
        local runId = ARGV[7]
        local timestamp = tonumber(ARGV[8])

        -- Get existing data
        local existing = redis.call('GET', key)
        local data
        local snapshot

        if existing then
          data = cjson.decode(existing)
          snapshot = data.snapshot
          if type(snapshot) == 'string' then
            snapshot = cjson.decode(snapshot)
          end
        else
          -- Create new record with default snapshot
          snapshot = {
            context = {},
            activePaths = {},
            timestamp = timestamp,
            suspendedPaths = {},
            activeStepsPath = {},
            resumeLabels = {},
            serializedStepGraph = {},
            status = 'pending',
            value = {},
            waitingPaths = {},
            runId = runId,
            requestContext = {}
          }
          data = {
            namespace = namespace,
            workflow_name = workflowName,
            run_id = runId,
            createdAt = now,
            updatedAt = now
          }
        end

        -- Initialize context if nil
        if snapshot.context == nil then
          snapshot.context = {}
        end

        -- Merge the new step result
        local stepResult = cjson.decode(resultJson)
        snapshot.context[stepId] = stepResult

        -- Merge request context
        local newRequestContext = cjson.decode(requestContextJson)
        if snapshot.requestContext == nil then
          snapshot.requestContext = {}
        end
        for k, v in pairs(newRequestContext) do
          snapshot.requestContext[k] = v
        end

        -- Update the record
        data.snapshot = snapshot
        data.updatedAt = now

        -- Save back
        redis.call('SET', key, cjson.encode(data))

        -- Return the full updated data
        return cjson.encode(data)
      `;

      const resultJson = await this.client.eval(
        luaScript,
        [key],
        [
          stepId,
          JSON.stringify(result),
          JSON.stringify(requestContext),
          now,
          'workflows',
          workflowName,
          runId,
          String(Date.now()),
        ],
      );

      // Parse the result - handle both string and already-parsed object
      let data: any;
      if (typeof resultJson === 'string') {
        data = JSON.parse(resultJson);
      } else {
        data = resultJson;
      }

      const snapshot = typeof data.snapshot === 'string' ? JSON.parse(data.snapshot) : data.snapshot;
      return snapshot.context;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('UPSTASH', 'UPDATE_WORKFLOW_RESULTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName, runId, stepId },
        },
        error,
      );
    }
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
    try {
      const key = getKey(TABLE_WORKFLOW_SNAPSHOT, {
        namespace: 'workflows',
        workflow_name: workflowName,
        run_id: runId,
      });

      const now = new Date().toISOString();

      // Use Lua script for atomic read-modify-write operation
      // This ensures concurrent updates don't overwrite each other
      const luaScript = `
        local key = KEYS[1]
        local optsJson = ARGV[1]
        local now = ARGV[2]

        -- Get existing data
        local existing = redis.call('GET', key)

        if not existing then
          return nil
        end

        local data = cjson.decode(existing)
        local snapshot = data.snapshot

        if type(snapshot) == 'string' then
          snapshot = cjson.decode(snapshot)
        end

        if not snapshot or not snapshot.context then
          return nil
        end

        -- Merge the new options with the existing snapshot
        local opts = cjson.decode(optsJson)
        for k, v in pairs(opts) do
          snapshot[k] = v
        end

        -- Update the record
        data.snapshot = snapshot
        data.updatedAt = now

        -- Save back
        redis.call('SET', key, cjson.encode(data))

        -- Return the full updated data
        return cjson.encode(data)
      `;

      const resultJson = await this.client.eval(luaScript, [key], [JSON.stringify(opts), now]);

      if (!resultJson) {
        return undefined;
      }

      // Parse the result - handle both string and already-parsed object
      let data: any;
      if (typeof resultJson === 'string') {
        data = JSON.parse(resultJson);
      } else {
        data = resultJson;
      }

      const snapshot = typeof data.snapshot === 'string' ? JSON.parse(data.snapshot) : data.snapshot;
      return snapshot;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('UPSTASH', 'UPDATE_WORKFLOW_STATE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName, runId },
        },
        error,
      );
    }
  }

  async persistWorkflowSnapshot(params: {
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
      await this.#db.insert({
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
          id: createStorageErrorId('UPSTASH', 'PERSIST_WORKFLOW_SNAPSHOT', 'FAILED'),
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

  async loadWorkflowSnapshot(params: {
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
      const data = await this.client.get<{
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
          id: createStorageErrorId('UPSTASH', 'LOAD_WORKFLOW_SNAPSHOT', 'FAILED'),
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

  async getWorkflowRunById({
    runId,
    workflowName,
  }: {
    runId: string;
    workflowName?: string;
  }): Promise<WorkflowRun | null> {
    try {
      const key =
        getKey(TABLE_WORKFLOW_SNAPSHOT, { namespace: 'workflows', workflow_name: workflowName, run_id: runId }) + '*';
      const keys = await this.#db.scanKeys(key);
      const workflows = await Promise.all(
        keys.map(async key => {
          const data = await this.client.get<{
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
      const data = workflows.find(w => w?.run_id === runId && w?.workflow_name === workflowName) as WorkflowRun | null;
      if (!data) return null;
      return this.parseWorkflowRun(data);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('UPSTASH', 'GET_WORKFLOW_RUN_BY_ID', 'FAILED'),
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

  async deleteWorkflowRunById({ runId, workflowName }: { runId: string; workflowName: string }): Promise<void> {
    const key = getKey(TABLE_WORKFLOW_SNAPSHOT, { namespace: 'workflows', workflow_name: workflowName, run_id: runId });
    try {
      await this.client.del(key);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('UPSTASH', 'DELETE_WORKFLOW_RUN_BY_ID', 'FAILED'),
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

  async listWorkflowRuns({
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
            id: createStorageErrorId('UPSTASH', 'LIST_WORKFLOW_RUNS', 'INVALID_PAGE'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { page },
          },
          new Error('page must be >= 0'),
        );
      }

      // Get all workflow keys
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
      const keys = await this.#db.scanKeys(pattern);

      // Check if we have any keys before using pipeline
      if (keys.length === 0) {
        return { runs: [], total: 0 };
      }

      // Use pipeline for batch fetching to improve performance
      const pipeline = this.client.pipeline();
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
        .filter(record => !workflowName || record.workflow_name === workflowName)
        .map(w => this.parseWorkflowRun(w!))
        .filter(w => {
          if (fromDate && w.createdAt < fromDate) return false;
          if (toDate && w.createdAt > toDate) return false;
          if (status) {
            let snapshot = w.snapshot;
            if (typeof snapshot === 'string') {
              try {
                snapshot = JSON.parse(snapshot) as WorkflowRunState;
              } catch (e) {
                this.logger.warn(`Failed to parse snapshot for workflow ${w.workflowName}: ${e}`);
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
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('UPSTASH', 'LIST_WORKFLOW_RUNS', 'FAILED'),
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
