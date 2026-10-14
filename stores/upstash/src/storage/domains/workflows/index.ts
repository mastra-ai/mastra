import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  isRunFenceConflictError,
  normalizePerPage,
  resolveRunFence,
  TABLE_WORKFLOW_RUN_OWNERS,
  TABLE_WORKFLOW_SNAPSHOT,
  WorkflowsStorage,
  ensureDate,
} from '@mastra/core/storage';
import type {
  ClaimRunOwnershipInput,
  ClaimRunOwnershipResult,
  RenewRunOwnershipInput,
  RenewRunOwnershipResult,
  RunFence,
  RunOwnershipRecord,
  StorageListWorkflowRunsInput,
  WorkflowRun,
  WorkflowRuns,
  UpdateWorkflowStateOptions,
} from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import type { Redis } from '@upstash/redis';
import { UpstashDB, resolveUpstashConfig } from '../../db';
import type { UpstashDomainConfig } from '../../db';
import {
  claimRunOwnership,
  evalFenced,
  getRunOwnership,
  releaseRunOwnership,
  renewRunOwnership,
  runClaimKey,
  writeBatch,
} from '../run-fencing';
import type { RunFenceCheck } from '../run-fencing';
import { getKey } from '../utils';

type WorkflowRunRecord = {
  workflow_name: string;
  run_id: string;
  snapshot: WorkflowRunState | string;
  createdAt: string | Date;
  updatedAt: string | Date;
  resourceId?: string;
};

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

  override supportsRunFencing(): boolean {
    return true;
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_WORKFLOW_SNAPSHOT });
    await this.#db.scanAndDelete(`${runClaimKey(TABLE_WORKFLOW_RUN_OWNERS, '')}*`);
  }

  #runFenceCheck(fence: RunFence | undefined, runId: string, operation: string): RunFenceCheck | undefined {
    const resolved = resolveRunFence(this, fence, runId);
    return resolved && { claims: TABLE_WORKFLOW_RUN_OWNERS, fence: resolved, operation };
  }

  #ownershipError(operation: string, runId: string, error: unknown): MastraError {
    return new MastraError(
      {
        id: createStorageErrorId('UPSTASH', operation, 'FAILED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        details: { runId },
      },
      error,
    );
  }

  // Each operation is one script over the run's ownership hash, so racing
  // claimers and renewals serialize on Redis and resolve to a single winner.
  override async claimRunOwnership(args: ClaimRunOwnershipInput): Promise<ClaimRunOwnershipResult> {
    try {
      return await claimRunOwnership(this.client, args);
    } catch (error) {
      throw this.#ownershipError('CLAIM_RUN_OWNERSHIP', args.runId, error);
    }
  }

  override async renewRunOwnership(args: RenewRunOwnershipInput): Promise<RenewRunOwnershipResult> {
    try {
      return await renewRunOwnership(this.client, args);
    } catch (error) {
      throw this.#ownershipError('RENEW_RUN_OWNERSHIP', args.runId, error);
    }
  }

  override async releaseRunOwnership(fence: RunFence): Promise<boolean> {
    try {
      return await releaseRunOwnership(this.client, fence);
    } catch (error) {
      throw this.#ownershipError('RELEASE_RUN_OWNERSHIP', fence.runId, error);
    }
  }

  override async getRunOwnership({ runId }: { runId: string }): Promise<RunOwnershipRecord | null> {
    try {
      return await getRunOwnership(this.client, runId);
    } catch (error) {
      throw this.#ownershipError('GET_RUN_OWNERSHIP', runId, error);
    }
  }

  private async getWorkflowRunRecord({
    namespace,
    runId,
    resourceId,
    workflowName,
  }: {
    namespace: string;
    runId: string;
    resourceId?: string;
    workflowName?: string;
  }) {
    if (workflowName) {
      const keyVariants: Array<Record<string, string>> = [
        ...(resourceId ? [{ namespace, workflow_name: workflowName, run_id: runId, resourceId }] : []),
        { namespace, workflow_name: workflowName, run_id: runId },
      ];

      for (const keys of keyVariants) {
        const data = await this.#db.get<WorkflowRunRecord>({
          tableName: TABLE_WORKFLOW_SNAPSHOT,
          keys,
        });
        if (data) return data;
      }
    }

    const key = `${getKey(TABLE_WORKFLOW_SNAPSHOT, { namespace })}:*run_id:${runId}*`;
    const keys = await this.#db.scanKeys(key);
    const workflows = await Promise.all(
      keys.map(async key => {
        return this.client.get<WorkflowRunRecord>(key);
      }),
    );

    return (
      workflows.find(
        w =>
          w?.run_id === runId &&
          (!workflowName || w.workflow_name === workflowName) &&
          (!resourceId || w.resourceId === resourceId),
      ) ?? null
    );
  }

  async updateWorkflowResults({
    workflowName,
    runId,
    stepId,
    result,
    requestContext,
    state,
    fence,
  }: {
    workflowName: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    requestContext: Record<string, any>;
    state?: Record<string, any>;
    fence?: RunFence;
  }): Promise<Record<string, StepResult<any, any, any, any>>> {
    const check = this.#runFenceCheck(fence, runId, 'updateWorkflowResults');
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
        local stateJson = ARGV[9]

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

        -- Record workflow state in the same write when provided
        if stateJson ~= '' then
          snapshot.context['__state'] = cjson.decode(stateJson)
        end

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

      const resultJson = await evalFenced(
        this.client,
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
          state === undefined ? '' : JSON.stringify(state),
        ],
        check,
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
    fence,
  }: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
    fence?: RunFence;
  }): Promise<WorkflowRunState | undefined> {
    const check = this.#runFenceCheck(fence, runId, 'updateWorkflowState');
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
        local expectedStatusJson = ARGV[3]

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

        -- Compare-and-set guard: bail out unless the persisted status is one the caller expects.
        -- This runs inside the same script as the write, so the check and the write are atomic.
        if expectedStatusJson ~= '' then
          local expected = cjson.decode(expectedStatusJson)
          local matched = false
          for _, status in ipairs(expected) do
            if snapshot.status == status then
              matched = true
            end
          end
          if not matched then
            return nil
          end
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

      const { expectedStatus, ...state } = opts;
      const expectedStatusJson =
        expectedStatus === undefined
          ? ''
          : JSON.stringify(Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus]);

      const resultJson = await evalFenced(
        this.client,
        luaScript,
        [key],
        [JSON.stringify(state), now, expectedStatusJson],
        check,
      );

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
    fence?: RunFence;
  }): Promise<void> {
    const { namespace = 'workflows', workflowName, runId, resourceId, snapshot, createdAt, updatedAt } = params;
    const check = this.#runFenceCheck(params.fence, runId, 'persistWorkflowSnapshot');
    try {
      const now = new Date();
      const key = getKey(TABLE_WORKFLOW_SNAPSHOT, {
        namespace,
        workflow_name: workflowName,
        run_id: runId,
        ...(resourceId ? { resourceId } : {}),
      });

      const record = {
        namespace,
        workflow_name: workflowName,
        run_id: runId,
        resourceId,
        snapshot,
        createdAt: (createdAt ?? now).toISOString(),
        updatedAt: (updatedAt ?? now).toISOString(),
      };

      await evalFenced(
        this.client,
        `
        local existing = redis.call("GET", KEYS[1])
        local next = cjson.decode(ARGV[1])
        if existing then
          local current = cjson.decode(existing)
          if current["createdAt"] then
            next["createdAt"] = current["createdAt"]
          end
        end
        redis.call("SET", KEYS[1], cjson.encode(next))
        return 1
        `,
        [key],
        [JSON.stringify(record)],
        check,
      );
    } catch (error) {
      if (isRunFenceConflictError(error)) throw error;
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
    try {
      const data = await this.getWorkflowRunRecord({ namespace, runId, workflowName });
      if (!data) return null;
      return typeof data.snapshot === 'string' ? (JSON.parse(data.snapshot) as WorkflowRunState) : data.snapshot;
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
      const data = await this.getWorkflowRunRecord({ namespace: 'workflows', runId, workflowName });
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

  async deleteWorkflowRunById({
    runId,
    workflowName,
    fence,
  }: {
    runId: string;
    workflowName: string;
    fence?: RunFence;
  }): Promise<void> {
    const check = this.#runFenceCheck(fence, runId, 'deleteWorkflowRunById');
    try {
      const record = await this.getWorkflowRunRecord({ namespace: 'workflows', runId, workflowName });
      const key = getKey(TABLE_WORKFLOW_SNAPSHOT, {
        namespace: 'workflows',
        workflow_name: workflowName,
        run_id: runId,
        ...(record?.resourceId ? { resourceId: record.resourceId } : {}),
      });
      const batch = writeBatch(this.client, check);
      batch.del(key);
      await batch.exec();
    } catch (error) {
      if (isRunFenceConflictError(error)) throw error;
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

      // Get workflow keys, then filter returned records. Resource-scoped keys include
      // resourceId after run_id, so broad namespace scanning avoids missing those variants.
      const pattern = `${getKey(TABLE_WORKFLOW_SNAPSHOT, { namespace: 'workflows' })}:*`;
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
        .filter(record => !resourceId || record.resourceId === resourceId)
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
