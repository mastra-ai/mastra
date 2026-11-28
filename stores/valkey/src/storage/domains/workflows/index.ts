import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  isRunFenceConflictError,
  normalizePerPage,
  resolveRunFence,
  TABLE_WORKFLOW_RUN_OWNERS,
  TABLE_WORKFLOW_SNAPSHOT,
  matchesExpectedWorkflowStatus,
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

import { ValkeyDB } from '../../db';
import type { ValkeyDomainConfig } from '../../db';
import type { ValkeyClient } from '../../types';
import {
  claimRunOwnership,
  getRunOwnership,
  getRunOwnerships,
  releaseRunOwnership,
  renewRunOwnership,
  runClaimKey,
  writeBatch,
} from '../run-fencing';
import type { RunFenceCheck, WriteBatch } from '../run-fencing';
import { getKey, processRecord } from '../utils';

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
 *
 * The pattern is only a cheap candidate filter. Both `run_id` and `resourceId` are free-form, so a
 * canonical key whose run ID contains `:` is byte-identical to a legacy key of a shorter run ID
 * (`run_id:r:resourceId:x` is both the legacy key of run `r` with resource `x` and the canonical key
 * of run `r:resourceId:x`). Existing legacy keys cannot be rewritten to a stricter delimiter, so
 * every candidate is confirmed with {@link recordMatchesRun} before it is read or deleted.
 */
function legacySnapshotKeyPattern(namespace: string, workflowName: string, runId: string): string {
  return `${escapeGlob(snapshotKey(namespace, workflowName, runId))}:resourceId:*`;
}

/** Whether a stored record belongs to the run being read, updated or deleted. */
function recordMatchesRun(record: SnapshotRecord, namespace: string, workflowName: string, runId: string): boolean {
  return (
    record.run_id === runId && record.workflow_name === workflowName && (record.namespace ?? 'workflows') === namespace
  );
}

export class WorkflowsValkey extends WorkflowsStorage {
  private client: ValkeyClient;
  private db: ValkeyDB;

  constructor(config: ValkeyDomainConfig) {
    super();
    this.client = config.client;
    this.db = new ValkeyDB({ client: config.client });
  }

  /**
   * Reads a run's snapshot record by its canonical key, falling back to legacy
   * `:resourceId:`-suffixed keys only when the canonical key is missing. Legacy candidates are
   * matched on the run identity stored in the record, not on the key shape alone.
   */
  private async getSnapshotRecord(
    namespace: string,
    workflowName: string,
    runId: string,
  ): Promise<SnapshotRecord | null> {
    const data = await this.client.get(snapshotKey(namespace, workflowName, runId));
    if (data) {
      const record = JSON.parse(data) as SnapshotRecord;
      // The canonical key can hold a legacy record of a shorter run ID whose key is byte-identical
      // (`run_id:r:resourceId:x`); only the record naming this run may be returned.
      if (recordMatchesRun(record, namespace, workflowName, runId)) {
        return record;
      }
    }

    const legacyKeys = await this.db.scanKeys(legacySnapshotKeyPattern(namespace, workflowName, runId));
    if (legacyKeys.length === 0) {
      return null;
    }

    const legacyRecords = await this.client.mGet(legacyKeys);
    for (const legacyData of legacyRecords) {
      if (!legacyData) continue;
      const record = JSON.parse(legacyData) as SnapshotRecord;
      if (recordMatchesRun(record, namespace, workflowName, runId)) {
        return record;
      }
    }

    return null;
  }

  /**
   * Moves a foreign record off a canonical key before this run is written there, so the other
   * run's snapshot survives (see {@link snapshotKey} and {@link legacySnapshotKeyPattern}): run `r`
   * with resource `x` and run `r:resourceId:x` share one key. The move rides in the caller's batch,
   * so it is applied atomically with this run's write. When the occupant's own canonical key is
   * already taken by another run, or is the same key, the collision is unresolvable and this throws
   * without mutating rather than destroy a snapshot.
   */
  private async displaceForeignOccupant(
    batch: WriteBatch,
    namespace: string,
    workflowName: string,
    runId: string,
    canonicalKey: string,
  ): Promise<void> {
    const data = await this.client.get(canonicalKey);
    if (!data) return;

    const occupant = JSON.parse(data) as SnapshotRecord;
    if (recordMatchesRun(occupant, namespace, workflowName, runId)) return;
    if (typeof occupant.workflow_name !== 'string' || typeof occupant.run_id !== 'string') {
      throw new Error(`Cannot place run ${runId}: the snapshot key holds a record with no run identity`);
    }

    const occupantNamespace = occupant.namespace ?? namespace;
    const destination = snapshotKey(occupantNamespace, occupant.workflow_name, occupant.run_id);
    if (destination === canonicalKey) {
      throw new Error(`Cannot place run ${runId}: run ${occupant.run_id} resolves to the same snapshot key`);
    }

    const destinationData = await this.client.get(destination);
    if (destinationData) {
      const existing = JSON.parse(destinationData) as SnapshotRecord;
      // The occupant already has a canonical copy, so this run may take the contested key.
      if (recordMatchesRun(existing, occupantNamespace, occupant.workflow_name, occupant.run_id)) return;
      throw new Error(`Cannot place run ${runId}: run ${occupant.run_id}'s snapshot key is occupied by another run`);
    }

    batch.set(destination, data);
  }

  public supportsConcurrentUpdates(): boolean {
    return false;
  }

  public override supportsRunFencing(): boolean {
    return true;
  }

  public async dangerouslyClearAll(): Promise<void> {
    await this.db.deleteData({ tableName: TABLE_WORKFLOW_SNAPSHOT });
    await this.db.scanAndDelete(`${runClaimKey(TABLE_WORKFLOW_RUN_OWNERS, '')}*`);
  }

  #runFenceCheck(fence: RunFence | undefined, runId: string, operation: string): RunFenceCheck | undefined {
    const resolved = resolveRunFence(this, fence, runId);
    return resolved && { claims: TABLE_WORKFLOW_RUN_OWNERS, fence: resolved, operation };
  }

  #ownershipError(operation: string, runId: string, error: unknown): MastraError {
    return new MastraError(
      {
        id: createStorageErrorId('VALKEY', operation, 'FAILED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        details: { runId },
      },
      error,
    );
  }

  // Each operation is one script over the run's ownership hash, so racing
  // claimers and renewals serialize on Valkey and resolve to a single winner.
  public override async claimRunOwnership(args: ClaimRunOwnershipInput): Promise<ClaimRunOwnershipResult> {
    try {
      return await claimRunOwnership(this.client, args);
    } catch (error) {
      throw this.#ownershipError('CLAIM_RUN_OWNERSHIP', args.runId, error);
    }
  }

  public override async renewRunOwnership(args: RenewRunOwnershipInput): Promise<RenewRunOwnershipResult> {
    try {
      return await renewRunOwnership(this.client, args);
    } catch (error) {
      throw this.#ownershipError('RENEW_RUN_OWNERSHIP', args.runId, error);
    }
  }

  public override async releaseRunOwnership(fence: RunFence): Promise<boolean> {
    try {
      return await releaseRunOwnership(this.client, fence);
    } catch (error) {
      throw this.#ownershipError('RELEASE_RUN_OWNERSHIP', fence.runId, error);
    }
  }

  public override async getRunOwnership({ runId }: { runId: string }): Promise<RunOwnershipRecord | null> {
    try {
      return await getRunOwnership(this.client, runId);
    } catch (error) {
      throw this.#ownershipError('GET_RUN_OWNERSHIP', runId, error);
    }
  }

  /** Reads the records with single-key script calls the client multiplexes, 500 at a time. */
  public override async getRunOwnerships({ runIds }: { runIds: string[] }): Promise<Map<string, RunOwnershipRecord>> {
    try {
      return await getRunOwnerships(this.client, runIds);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('VALKEY', 'GET_RUN_OWNERSHIPS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { runCount: runIds.length },
        },
        error,
      );
    }
  }

  public async updateWorkflowResults({
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
    result: StepResult<unknown, unknown, unknown, unknown>;
    requestContext: Record<string, unknown>;
    state?: Record<string, unknown>;
    fence?: RunFence;
  }): Promise<Record<string, StepResult<unknown, unknown, unknown, unknown>>> {
    const resolvedFence = resolveRunFence(this, fence, runId);
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
      if (state !== undefined) {
        (snapshot.context as Record<string, unknown>).__state = state;
      }
      snapshot.requestContext = { ...snapshot.requestContext, ...requestContext };

      await this.persistWorkflowSnapshot({
        namespace: 'workflows',
        workflowName,
        runId,
        resourceId: existingRecord?.resourceId,
        snapshot,
        createdAt: existingRecord?.createdAt ? ensureDate(existingRecord.createdAt) : undefined,
        fence: resolvedFence,
      });

      return snapshot.context;
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('VALKEY', 'UPDATE_WORKFLOW_RESULTS', 'FAILED'),
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
    fence,
  }: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
    fence?: RunFence;
  }): Promise<WorkflowRunState | undefined> {
    const resolvedFence = resolveRunFence(this, fence, runId);
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
        fence: resolvedFence,
      });

      return updatedSnapshot;
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('VALKEY', 'UPDATE_WORKFLOW_STATE', 'FAILED'),
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
    fence?: RunFence;
  }): Promise<void> {
    const { namespace = 'workflows', workflowName, runId, resourceId, snapshot, createdAt, updatedAt } = params;
    const check = this.#runFenceCheck(params.fence, runId, 'persistWorkflowSnapshot');
    try {
      let finalCreatedAt = createdAt;
      let finalResourceId = resourceId;
      if (!finalCreatedAt || !finalResourceId) {
        // No SCAN here (it would run on every new run); a legacy key is only reachable when resourceId is known.
        const canonicalKey = snapshotKey(namespace, workflowName, runId);
        // Either key can hold a colliding run's record (see `legacySnapshotKeyPattern`), so only a
        // record naming this run may donate its `createdAt` or `resourceId`.
        const readOwnRecord = (data: string | null): SnapshotRecord | null => {
          if (!data) return null;
          const record = JSON.parse(data) as SnapshotRecord;
          return recordMatchesRun(record, namespace, workflowName, runId) ? record : null;
        };
        let existing = readOwnRecord(await this.client.get(canonicalKey));
        if (!existing && resourceId) {
          existing = readOwnRecord(await this.client.get(`${canonicalKey}:resourceId:${resourceId}`));
        }
        finalCreatedAt ??= existing?.createdAt ? ensureDate(existing.createdAt) : new Date();
        finalResourceId ??= existing?.resourceId;
      }

      const { key, processedRecord } = processRecord(TABLE_WORKFLOW_SNAPSHOT, {
        namespace,
        workflow_name: workflowName,
        run_id: runId,
        resourceId: finalResourceId,
        snapshot,
        createdAt: finalCreatedAt,
        updatedAt: updatedAt ?? new Date(),
      });
      const batch = writeBatch(this.client, check);
      // A canonical key can hold a *different* run's legacy record: run IDs are free-form, so run
      // `r` with resource `x` and run `r:resourceId:x` share one key. Writing this run there would
      // destroy the other run's snapshot, so move that occupant to its own canonical key in the
      // same batch first. Only a run ID that can carry a legacy key suffix is checked, so ordinary
      // persists pay nothing; a collision that cannot be resolved throws without mutating.
      if (runId.includes(':resourceId:')) {
        await this.displaceForeignOccupant(batch, namespace, workflowName, runId, key);
      }
      batch.set(key, JSON.stringify(processedRecord));
      await batch.exec();
    } catch (error) {
      if (isRunFenceConflictError(error)) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('VALKEY', 'PERSIST_WORKFLOW_SNAPSHOT', 'FAILED'),
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
          id: createStorageErrorId('VALKEY', 'LOAD_WORKFLOW_SNAPSHOT', 'FAILED'),
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
          id: createStorageErrorId('VALKEY', 'GET_WORKFLOW_RUN_BY_ID', 'FAILED'),
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

  public async deleteWorkflowRunById({
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
      const canonicalKey = snapshotKey('workflows', workflowName, runId);
      const legacyKeys = await this.db.scanKeys(legacySnapshotKeyPattern('workflows', workflowName, runId));
      // Neither key is this run's by shape: the canonical key can hold a colliding shorter run's
      // legacy record, and a scanned candidate can hold a longer run's canonical record. Only the
      // record body says whose snapshot sits behind a key, so it decides what may be deleted.
      const candidateKeys = [canonicalKey, ...legacyKeys];
      const storedRecords = await this.client.mGet(candidateKeys);
      const batch = writeBatch(this.client, check);
      candidateKeys.forEach((key, index) => {
        const data = storedRecords[index];
        if (!data) return;
        const record = JSON.parse(data) as SnapshotRecord;
        if (recordMatchesRun(record, 'workflows', workflowName, runId)) batch.del(key);
      });
      await batch.exec();
    } catch (error) {
      if (isRunFenceConflictError(error)) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('VALKEY', 'DELETE_WORKFLOW_RUN_BY_ID', 'FAILED'),
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
   * parent run; the full snapshots are still read from Valkey.
   */
  public async listWorkflowRuns({
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
            id: createStorageErrorId('VALKEY', 'LIST_WORKFLOW_RUNS', 'INVALID_PAGE'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { page },
          },
          new Error('page must be >= 0'),
        );
      }

      const normalizedFrom = fromDate ? ensureDate(fromDate) : undefined;
      const normalizedTo = toDate ? ensureDate(toDate) : undefined;

      // The canonical key carries no `resourceId`, so a resource-scoped call scans the workflow's
      // keys and filters `resourceId` off the record below; a narrower scan needs a per-resource
      // index, as no legacy or canonical key shape can be trusted to hold exactly one resource
      // (a run ID containing `:` makes the shapes collide).
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

      // Every snapshot is fetched whole, so summary mode only trims the result, after the status filter.
      return { runs: summary ? runs.map(summarizeWorkflowRun) : runs, total };
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('VALKEY', 'LIST_WORKFLOW_RUNS', 'FAILED'),
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
