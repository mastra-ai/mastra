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
  getRunOwnerships,
  releaseRunOwnership,
  renewRunOwnership,
  runClaimKey,
} from '../run-fencing';
import type { RunFenceCheck } from '../run-fencing';
import { escapeRedisGlob, getKey } from '../utils';

type WorkflowRunRecord = {
  namespace?: string;
  workflow_name: string;
  run_id: string;
  snapshot: WorkflowRunState | string;
  createdAt: string | Date;
  updatedAt: string | Date;
  resourceId?: string;
};

/**
 * A run with its snapshot reduced to what `listWorkflowRuns({ summary: true })` returns: `status`
 * and `timestamp` when set, and `parentWorkflow` only when both of its IDs are non-empty strings.
 * A missing snapshot, or one that failed to parse and stayed a string, reduces to `{}`.
 */
function summarizeWorkflowRun(run: WorkflowRun): WorkflowRun {
  const source = run.snapshot !== null && typeof run.snapshot === 'object' ? run.snapshot : {};
  const { status, timestamp, parentWorkflow } = source as Partial<WorkflowRunState>;
  const snapshot: Record<string, unknown> = {};

  if (status !== undefined && status !== null) {
    snapshot.status = status;
  }

  if (timestamp !== undefined && timestamp !== null) {
    snapshot.timestamp = timestamp;
  }

  const workflowId = parentWorkflow?.workflowId;
  const runId = parentWorkflow?.runId;
  if (typeof workflowId === 'string' && workflowId !== '' && typeof runId === 'string' && runId !== '') {
    snapshot.parentWorkflow = { workflowId, runId };
  }

  return { ...run, snapshot: snapshot as unknown as WorkflowRunState };
}

/** The namespace every workflow snapshot is stored under. */
const WORKFLOW_NAMESPACE = 'workflows';

/**
 * The key a snapshot is stored under. It is derived from the run identity only:
 * a run's resourceId is stored in the record, not the key, so persist, update
 * and delete all reach the same record.
 */
function canonicalSnapshotKey(namespace: string, workflowName: string, runId: string): string {
  return getKey(TABLE_WORKFLOW_SNAPSHOT, { namespace, workflow_name: workflowName, run_id: runId });
}

/**
 * The pre-canonical key shape, which suffixed a run's snapshot with its
 * resourceId. Still read so records written by older releases keep working; a
 * resource-suffixed record is migrated to {@link canonicalSnapshotKey} on write.
 */
function legacySnapshotKey(namespace: string, workflowName: string, runId: string, resourceId: string): string {
  return getKey(TABLE_WORKFLOW_SNAPSHOT, {
    namespace,
    workflow_name: workflowName,
    run_id: runId,
    resourceId,
  });
}

/** The literal prefix of every legacy copy of one run's snapshot. */
function legacySnapshotPrefix(namespace: string, workflowName: string, runId: string): string {
  return `${canonicalSnapshotKey(namespace, workflowName, runId)}:resourceId:`;
}

/** Whether a stored record names the run being read, updated or deleted. */
function recordMatchesRun(
  record: WorkflowRunRecord | null | undefined,
  namespace: string,
  workflowName: string,
  runId: string,
): boolean {
  return (
    !!record &&
    record.run_id === runId &&
    record.workflow_name === workflowName &&
    (record.namespace ?? 'workflows') === namespace
  );
}

/**
 * Lua shared by every script that reads, writes or deletes a run's snapshot.
 *
 * A key is not proof of identity: `run_id` and `workflow_name` are free-form, so
 * the canonical key of run `r:resourceId:x` is byte-identical to a legacy key of
 * run `r` with resource `x`. Every record is therefore matched on its stored
 * identity before it is adopted, overwritten or deleted — inside the same script
 * as the mutation, so a key that changed since it was read is never acted on.
 */
const SNAPSHOT_IDENTITY_LUA = `
  local function matchesIdentity(rec, rid, wf, ns)
    if not rec then return false end
    if rec['run_id'] ~= rid or rec['workflow_name'] ~= wf then return false end
    local storedNs = rec['namespace']
    if storedNs == nil then storedNs = 'workflows' end
    return storedNs == ns
  end

  local function canonicalKeyOf(rec, tableName)
    if not rec or rec['workflow_name'] == nil or rec['run_id'] == nil then return nil end
    local ns = rec['namespace']
    if ns == nil then ns = 'workflows' end
    return tableName .. ':namespace:' .. ns .. ':workflow_name:' .. rec['workflow_name'] .. ':run_id:' .. rec['run_id']
  end

  -- Moves a record that belongs to a *different* run off the key this write is
  -- about to take, onto that run's own canonical key, so the occupant's snapshot
  -- survives. Returns an error message when the collision cannot be resolved; a
  -- record that already names this run, or an empty key, is left alone.
  local function displaceForeignOccupant(canonicalKey, occupant, raw, rid, wf, ns, tableName)
    if matchesIdentity(occupant, rid, wf, ns) then return nil end
    if type(occupant['workflow_name']) ~= 'string' or type(occupant['run_id']) ~= 'string' then
      return 'snapshot key for run ' .. rid .. ' holds a record with no run identity'
    end
    local destination = canonicalKeyOf(occupant, tableName)
    if destination == nil or destination == canonicalKey then
      return 'snapshot key for run ' .. rid .. ' is also the snapshot key of run ' .. occupant['run_id']
    end
    local destinationRaw = redis.call('GET', destination)
    if destinationRaw then
      local occupantNs = occupant['namespace']
      if occupantNs == nil then occupantNs = 'workflows' end
      if not matchesIdentity(cjson.decode(destinationRaw), occupant['run_id'], occupant['workflow_name'], occupantNs) then
        return 'snapshot key for run ' .. occupant['run_id'] .. ' is held by another run'
      end
    else
      redis.call('SET', destination, raw)
    end
    return nil
  end
`;

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

  /** Reads the records with one pipeline request per hundred runs. */
  override async getRunOwnerships({ runIds }: { runIds: string[] }): Promise<Map<string, RunOwnershipRecord>> {
    try {
      return await getRunOwnerships(this.client, runIds);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('UPSTASH', 'GET_RUN_OWNERSHIPS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { runCount: runIds.length },
        },
        error,
      );
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
      // Canonical first: when both a canonical and a legacy copy exist, the
      // canonical one is the source of truth. A canonical key can hold a
      // different run's legacy record (see {@link SNAPSHOT_IDENTITY_LUA}), so a
      // record is returned only when it names the run being read.
      const keyVariants: string[] = [canonicalSnapshotKey(namespace, workflowName, runId)];
      if (resourceId) {
        keyVariants.push(legacySnapshotKey(namespace, workflowName, runId, resourceId));
      }

      for (const key of keyVariants) {
        const data = await this.client.get<WorkflowRunRecord>(key);
        if (recordMatchesRun(data, namespace, workflowName, runId)) return data;
      }
    }

    const key = `${getKey(TABLE_WORKFLOW_SNAPSHOT, { namespace })}:*run_id:${escapeRedisGlob(runId)}*`;
    const keys = await this.#db.scanKeys(key);
    const workflows = await Promise.all(
      keys.map(async key => {
        return this.client.get<WorkflowRunRecord>(key);
      }),
    );

    const matches = workflows.filter((next): next is WorkflowRunRecord =>
      workflowName ? recordMatchesRun(next, namespace, workflowName, runId) : !!next?.run_id && next.run_id === runId,
    );

    if (resourceId) {
      // A run's resourceId lives on the record, not the key. On a run split
      // across a resourceId-less canonical copy and a legacy copy that carries
      // the resourceId, the legacy copy is the one that names the resource, so
      // prefer it and fall back to nothing.
      return matches.find(w => w.resourceId === resourceId) ?? null;
    }

    return matches[0] ?? null;
  }

  /**
   * Legacy resource-suffixed copies of one run's snapshot, for a write to fold
   * into the canonical record.
   *
   * A legacy key is the canonical key plus `:resourceId:<resourceId>`, so it can
   * only be named outright when its resourceId is known. A run written by an
   * older release can be *split*: a canonical copy with no resourceId (written
   * by an update that did not know the resource) next to a legacy copy that has
   * one. Those copies cannot be named, so `discover` asks for a scan; the MATCH
   * prefix is escaped and every hit is re-checked against the literal prefix, so
   * a runId containing `*`, `?` or `[` cannot widen the scan to other runs.
   *
   * A key can carry the literal prefix and still belong to a *different* run
   * whose id embeds `:resourceId:`: run `a`'s legacy key and run
   * `a:resourceId:r`'s canonical key are the same string. The stored record,
   * not the key, is the run's identity, so every candidate is read back and
   * kept only when it is a copy of this run ({@link recordMatchesRun}). The
   * scripts re-check identity before acting on a key, because the record can
   * change between this scan and the mutation.
   */
  async #legacySnapshotKeys({
    namespace,
    workflowName,
    runId,
    knownResourceIds,
    discover,
  }: {
    namespace: string;
    workflowName: string;
    runId: string;
    knownResourceIds: Array<string | undefined>;
    discover: boolean;
  }): Promise<string[]> {
    const prefix = legacySnapshotPrefix(namespace, workflowName, runId);
    const candidates = new Set(
      knownResourceIds.filter((resourceId): resourceId is string => !!resourceId).map(id => `${prefix}${id}`),
    );

    if (discover) {
      const scanned = await this.#db.scanKeys(`${escapeRedisGlob(prefix)}*`);
      for (const key of scanned) {
        if (key.startsWith(prefix)) candidates.add(key);
      }
    }

    const keys: string[] = [];
    for (const key of candidates) {
      const record = await this.client.get<WorkflowRunRecord>(key);
      if (recordMatchesRun(record, namespace, workflowName, runId)) keys.push(key);
    }

    return keys;
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
      // Snapshots are canonical; fold in any legacy resource-suffixed copies of
      // this run (a run split across a canonical and a legacy copy) so the atomic
      // write below merges them and drops them.
      const canonicalKey = canonicalSnapshotKey(WORKFLOW_NAMESPACE, workflowName, runId);
      const canonicalRecord = await this.client.get<WorkflowRunRecord>(canonicalKey);
      // The canonical key can hold another run's record; only a copy that names
      // this run may be merged into.
      const existing = recordMatchesRun(canonicalRecord, WORKFLOW_NAMESPACE, workflowName, runId)
        ? canonicalRecord
        : null;
      const legacyKeys = await this.#legacySnapshotKeys({
        namespace: WORKFLOW_NAMESPACE,
        workflowName,
        runId,
        knownResourceIds: [existing?.resourceId],
        // The canonical copy is missing, is another run's, or has no resourceId,
        // so legacy copies (if any) cannot be named and have to be discovered.
        discover: !existing?.resourceId,
      });

      const now = new Date().toISOString();

      // Use Lua script for atomic read-modify-write operation
      // This ensures concurrent updates don't overwrite each other
      // The script returns the updated full record as JSON string
      const luaScript = `
        local canonicalKey = KEYS[1]
        local legacyCount = tonumber(ARGV[1])
        local stepId = ARGV[2]
        local resultJson = ARGV[3]
        local requestContextJson = ARGV[4]
        local now = ARGV[5]
        local namespace = ARGV[6]
        local workflowName = ARGV[7]
        local runId = ARGV[8]
        local timestamp = tonumber(ARGV[9])
        local stateJson = ARGV[10]
        local tableName = ARGV[11]

${SNAPSHOT_IDENTITY_LUA}

        -- Read the canonical record first, then a legacy resource-suffixed copy.
        -- A record is used only when it names this run: the canonical key can
        -- hold another run's legacy record (see displaceForeignOccupant).
        local canonicalRaw = redis.call('GET', canonicalKey)
        local existing = nil
        local displaced = nil
        if canonicalRaw then
          local occupant = cjson.decode(canonicalRaw)
          if matchesIdentity(occupant, runId, workflowName, namespace) then
            existing = canonicalRaw
          else
            displaced = occupant
          end
        end

        local legacyKeys = {}
        local legacy = nil
        for i = 2, 1 + legacyCount do
          local copy = redis.call('GET', KEYS[i])
          if copy then
            local copyRecord = cjson.decode(copy)
            if matchesIdentity(copyRecord, runId, workflowName, namespace) then
              legacyKeys[#legacyKeys + 1] = KEYS[i]
              if not legacy then
                legacy = copy
              end
            end
          end
        end
        if not existing then
          existing = legacy
        end
        local data
        local snapshot

        if existing then
          data = cjson.decode(existing)
          snapshot = data.snapshot
          if type(snapshot) == 'string' then
            snapshot = cjson.decode(snapshot)
          end
          -- A canonical copy written by an update that did not know the resource
          -- has no resourceId; adopt it from a legacy copy before that copy goes.
          if data.resourceId == nil and legacy then
            local legacyData = cjson.decode(legacy)
            if legacyData.resourceId ~= nil then
              data.resourceId = legacyData.resourceId
            end
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

        -- Another run's record must not be overwritten: move it to its own
        -- canonical key first, in this same script.
        if displaced then
          local placeErr = displaceForeignOccupant(canonicalKey, displaced, cjson.encode(displaced), runId, workflowName, namespace, tableName)
          if placeErr then
            return redis.error_reply(placeErr)
          end
        end

        -- Save back to the canonical key and drop every legacy copy.
        redis.call('SET', canonicalKey, cjson.encode(data))
        for _, key in ipairs(legacyKeys) do
          redis.call('DEL', key)
        end

        -- Return the full updated data
        return cjson.encode(data)
      `;

      const resultJson = await evalFenced(
        this.client,
        luaScript,
        [canonicalKey, ...legacyKeys],
        [
          String(legacyKeys.length),
          stepId,
          JSON.stringify(result),
          JSON.stringify(requestContext),
          now,
          WORKFLOW_NAMESPACE,
          workflowName,
          runId,
          String(Date.now()),
          state === undefined ? '' : JSON.stringify(state),
          TABLE_WORKFLOW_SNAPSHOT,
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
      // Canonical key plus every legacy resource-suffixed copy, so a run written
      // by an older release is migrated to the canonical key by the atomic write.
      const canonicalKey = canonicalSnapshotKey(WORKFLOW_NAMESPACE, workflowName, runId);
      const canonicalRecord = await this.client.get<WorkflowRunRecord>(canonicalKey);
      // The canonical key can hold another run's record; only a copy that names
      // this run may be updated.
      const existing = recordMatchesRun(canonicalRecord, WORKFLOW_NAMESPACE, workflowName, runId)
        ? canonicalRecord
        : null;
      const legacyKeys = await this.#legacySnapshotKeys({
        namespace: WORKFLOW_NAMESPACE,
        workflowName,
        runId,
        knownResourceIds: [existing?.resourceId],
        // The canonical copy is missing, is another run's, or has no resourceId,
        // so legacy copies (if any) cannot be named and have to be discovered.
        discover: !existing?.resourceId,
      });

      const now = new Date().toISOString();

      // Use Lua script for atomic read-modify-write operation
      // This ensures concurrent updates don't overwrite each other
      const luaScript = `
        local canonicalKey = KEYS[1]
        local legacyCount = tonumber(ARGV[1])
        local optsJson = ARGV[2]
        local now = ARGV[3]
        local expectedStatusJson = ARGV[4]
        local namespace = ARGV[5]
        local workflowName = ARGV[6]
        local runId = ARGV[7]
        local tableName = ARGV[8]

${SNAPSHOT_IDENTITY_LUA}

        -- Read the canonical record first, then a legacy resource-suffixed copy.
        -- A record is used only when it names this run: the canonical key can
        -- hold another run's legacy record (see displaceForeignOccupant).
        local canonicalRaw = redis.call('GET', canonicalKey)
        local existing = nil
        local displaced = nil
        if canonicalRaw then
          local occupant = cjson.decode(canonicalRaw)
          if matchesIdentity(occupant, runId, workflowName, namespace) then
            existing = canonicalRaw
          else
            displaced = occupant
          end
        end

        local legacyKeys = {}
        local legacy = nil
        for i = 2, 1 + legacyCount do
          local copy = redis.call('GET', KEYS[i])
          if copy then
            local copyRecord = cjson.decode(copy)
            if matchesIdentity(copyRecord, runId, workflowName, namespace) then
              legacyKeys[#legacyKeys + 1] = KEYS[i]
              if not legacy then
                legacy = copy
              end
            end
          end
        end
        if not existing then
          existing = legacy
        end

        if not existing then
          return nil
        end

        local data = cjson.decode(existing)
        local snapshot = data.snapshot

        if type(snapshot) == 'string' then
          snapshot = cjson.decode(snapshot)
        end

        -- A canonical copy written by an update that did not know the resource
        -- has no resourceId; adopt it from a legacy copy before that copy goes.
        if data.resourceId == nil and legacy then
          local legacyData = cjson.decode(legacy)
          if legacyData.resourceId ~= nil then
            data.resourceId = legacyData.resourceId
          end
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

        -- Another run's record must not be overwritten: move it to its own
        -- canonical key first, in this same script.
        if displaced then
          local placeErr = displaceForeignOccupant(canonicalKey, displaced, cjson.encode(displaced), runId, workflowName, namespace, tableName)
          if placeErr then
            return redis.error_reply(placeErr)
          end
        end

        -- Save back to the canonical key and drop every legacy copy.
        redis.call('SET', canonicalKey, cjson.encode(data))
        for _, key in ipairs(legacyKeys) do
          redis.call('DEL', key)
        end

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
        [canonicalKey, ...legacyKeys],
        [
          String(legacyKeys.length),
          JSON.stringify(state),
          now,
          expectedStatusJson,
          WORKFLOW_NAMESPACE,
          workflowName,
          runId,
          TABLE_WORKFLOW_SNAPSHOT,
        ],
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
      const canonicalKey = canonicalSnapshotKey(namespace, workflowName, runId);
      // The canonical key can hold another run's record; only a copy that names
      // this run may be read, folded in or overwritten.
      const canonicalRecord = resourceId ? null : await this.client.get<WorkflowRunRecord>(canonicalKey);
      const existing = recordMatchesRun(canonicalRecord, namespace, workflowName, runId) ? canonicalRecord : null;
      // Snapshots live under the canonical key; any legacy resource-suffixed copy
      // is folded in and removed by the same atomic write. A caller that names
      // the resourceId points straight at its legacy key. A caller that does not
      // may be writing a run that a pre-fix release kept solely, or as well,
      // under a legacy key, so its legacy copies are discovered by scan and
      // confirmed by identity.
      const legacyKeys = await this.#legacySnapshotKeys({
        namespace,
        workflowName,
        runId,
        knownResourceIds: [resourceId ?? existing?.resourceId],
        discover: !resourceId,
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
        local canonicalKey = KEYS[1]
        local legacyCount = tonumber(ARGV[1])
        local next = cjson.decode(ARGV[2])
        local namespace = ARGV[3]
        local workflowName = ARGV[4]
        local runId = ARGV[5]
        local tableName = ARGV[6]

${SNAPSHOT_IDENTITY_LUA}

        -- Metadata precedence: the canonical copy wins for createdAt. A canonical
        -- copy written before the resource-aware fix has no resourceId, so adopt
        -- it from a legacy sibling before that sibling is dropped. When there is
        -- no canonical copy, the first legacy sibling that carries the metadata
        -- supplies it (parity with the pre-fix read-then-overwrite behaviour).
        -- Only records that name this run are read: the canonical key can hold
        -- another run's legacy record (see displaceForeignOccupant).
        local createdAtLocked = false
        local canonicalRaw = redis.call("GET", canonicalKey)
        local displaced = nil
        if canonicalRaw then
          local current = cjson.decode(canonicalRaw)
          if matchesIdentity(current, runId, workflowName, namespace) then
            if current["createdAt"] then
              next["createdAt"] = current["createdAt"]
              createdAtLocked = true
            end
            if next["resourceId"] == nil and current["resourceId"] then
              next["resourceId"] = current["resourceId"]
            end
          else
            displaced = current
          end
        end

        local legacyKeys = {}
        for i = 2, 1 + legacyCount do
          local legacyRaw = redis.call("GET", KEYS[i])
          if legacyRaw then
            local copy = cjson.decode(legacyRaw)
            if matchesIdentity(copy, runId, workflowName, namespace) then
              legacyKeys[#legacyKeys + 1] = KEYS[i]
              if not createdAtLocked and copy["createdAt"] then
                next["createdAt"] = copy["createdAt"]
                createdAtLocked = true
              end
              if next["resourceId"] == nil and copy["resourceId"] then
                next["resourceId"] = copy["resourceId"]
              end
            end
          end
        end

        -- Another run's record must not be overwritten: move it to its own
        -- canonical key first, in this same script.
        if displaced then
          local placeErr = displaceForeignOccupant(canonicalKey, displaced, cjson.encode(displaced), runId, workflowName, namespace, tableName)
          if placeErr then
            return redis.error_reply(placeErr)
          end
        end

        redis.call("SET", canonicalKey, cjson.encode(next))
        for _, key in ipairs(legacyKeys) do
          redis.call("DEL", key)
        end
        return 1
        `,
        [canonicalKey, ...legacyKeys],
        [String(legacyKeys.length), JSON.stringify(record), namespace, workflowName, runId, TABLE_WORKFLOW_SNAPSHOT],
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
      // Delete the canonical key and every legacy resource-suffixed copy for
      // this run, so no orphaned record is left behind. The pattern is escaped
      // and every hit re-checked against the literal prefix, so a runId holding
      // `*`, `?` or `[` cannot widen the scan to other runs. The delete itself
      // re-checks the stored identity inside the script: `run_id` is free-form,
      // so the canonical key of one run can be the legacy key of another, and
      // only records that name this run may go.
      const canonicalKey = canonicalSnapshotKey(WORKFLOW_NAMESPACE, workflowName, runId);
      const legacyKeys = await this.#legacySnapshotKeys({
        namespace: WORKFLOW_NAMESPACE,
        workflowName,
        runId,
        knownResourceIds: [],
        discover: true,
      });

      await evalFenced(
        this.client,
        `
        local canonicalKey = KEYS[1]
        local legacyCount = tonumber(ARGV[1])
        local namespace = ARGV[2]
        local workflowName = ARGV[3]
        local runId = ARGV[4]

${SNAPSHOT_IDENTITY_LUA}

        local canonicalRaw = redis.call('GET', canonicalKey)
        if canonicalRaw then
          local current = cjson.decode(canonicalRaw)
          if matchesIdentity(current, runId, workflowName, namespace) then
            redis.call('DEL', canonicalKey)
          end
        end

        for i = 2, 1 + legacyCount do
          local legacyRaw = redis.call('GET', KEYS[i])
          if legacyRaw then
            local copy = cjson.decode(legacyRaw)
            if matchesIdentity(copy, runId, workflowName, namespace) then
              redis.call('DEL', KEYS[i])
            end
          end
        end

        return 1
        `,
        [canonicalKey, ...legacyKeys],
        [String(legacyKeys.length), WORKFLOW_NAMESPACE, workflowName, runId],
        check,
      );
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

  /**
   * Lists runs newest first. With `summary`, each snapshot keeps only its status, timestamp and
   * parent run; the full snapshots are still read from Upstash.
   */
  async listWorkflowRuns({
    workflowName,
    fromDate,
    toDate,
    perPage,
    page,
    resourceId,
    status,
    summary,
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

      // Pair each record with the key it was read from, so a run that still has
      // both a canonical and a legacy copy can be collapsed to one entry.
      const entries: Array<{ key: string; record: Record<string, any> }> = [];
      keys.forEach((key, index) => {
        const record = results[index] as Record<string, any> | null;
        if (record && typeof record === 'object' && 'workflow_name' in record) {
          entries.push({ key, record });
        }
      });

      // Collapse duplicate copies of the same run, preferring the canonical key.
      // This runs before filtering so neither listings nor counts double-count a
      // run whose legacy copy has not been migrated yet.
      const canonicalKeyOf = (record: Record<string, any>) =>
        canonicalSnapshotKey(record.namespace ?? WORKFLOW_NAMESPACE, record.workflow_name, record.run_id);

      const byRun = new Map<string, { key: string; record: Record<string, any> }>();
      for (const entry of entries) {
        const { record } = entry;
        // Identity is the run's fields, not its key: a run id or workflow name
        // containing the separator would otherwise make two distinct runs (e.g.
        // `wf` / `a:b` and `wf:a` / `b`) collapse into one entry.
        const identity = JSON.stringify([record.namespace ?? WORKFLOW_NAMESPACE, record.workflow_name, record.run_id]);
        const kept = byRun.get(identity);
        if (!kept) {
          byRun.set(identity, entry);
          continue;
        }

        const preferEntry = kept.key !== canonicalKeyOf(kept.record) && entry.key === canonicalKeyOf(record);
        const winner = preferEntry ? entry : kept;
        const sibling = preferEntry ? kept : entry;

        // A canonical copy written by an update that did not know the resource
        // has no resourceId; adopt it from the legacy sibling so a run split
        // across both copies still matches a resource-scoped listing.
        if (!winner.record.resourceId && sibling.record.resourceId) {
          winner.record.resourceId = sibling.record.resourceId;
        }
        // Keep the earliest createdAt across the copies.
        if (
          sibling.record.createdAt &&
          (!winner.record.createdAt || String(sibling.record.createdAt) < String(winner.record.createdAt))
        ) {
          winner.record.createdAt = sibling.record.createdAt;
        }

        byRun.set(identity, winner);
      }

      // Filter and transform results
      let runs = [...byRun.values()]
        .map(({ record }) => record)
        // Only filter by workflowName if it was specifically requested
        .filter(record => !workflowName || record.workflow_name === workflowName)
        .filter(record => !resourceId || record.resourceId === resourceId)
        .map(record => this.parseWorkflowRun(record))
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

      // Every snapshot is fetched whole, so summary mode only trims the result, after the status filter.
      return { runs: summary ? runs.map(summarizeWorkflowRun) : runs, total };
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
