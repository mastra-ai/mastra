import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  normalizePerPage,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_WORKFLOW_RUN_OWNERS,
  TABLE_SCHEMAS,
  RUN_FENCING_TABLE_SCHEMAS,
  matchesExpectedWorkflowStatus,
  WorkflowsStorage,
  createStorageErrorId,
  isRunFenceConflictError,
  resolveRunFence,
} from '@mastra/core/storage';
import type {
  ClaimRunOwnershipInput,
  ClaimRunOwnershipResult,
  RenewRunOwnershipInput,
  RenewRunOwnershipResult,
  RunFence,
  RunOwnershipRecord,
  StorageListWorkflowRunsInput,
  UpdateWorkflowStateOptions,
  WorkflowRun,
  WorkflowRuns,
  CreateIndexOptions,
  TABLE_NAMES,
} from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import { withRetry } from '../../../shared/retry';
import { DsqlDB, resolveDsqlConfig } from '../../db';
import type { DsqlDomainConfig } from '../../db';
import { assertRunFence, DB_NOW_MS, isRetriableRunFenceWrite, withRunFence } from '../../db/run-fencing';
import type { Queryable } from '../../db/run-fencing';
import { getTableName, getSchemaName } from '../utils';

interface RunOwnerRow {
  generation: number;
  ownerId: string;
  /** BIGINT columns come back as strings. */
  leaseExpiresAt: string | number | null;
  nowMs: string | number;
}

const RUN_OWNER_COLUMNS = `generation, "ownerId", "leaseExpiresAt", ${DB_NOW_MS} AS "nowMs"`;

function toRunOwnershipRecord(runId: string, row: RunOwnerRow): RunOwnershipRecord {
  const leaseExpiresAt = row.leaseExpiresAt === null ? null : Number(row.leaseExpiresAt);
  return {
    runId,
    generation: row.generation,
    ownerId: row.ownerId,
    leaseExpiresAt: leaseExpiresAt === null ? null : new Date(leaseExpiresAt),
    live: leaseExpiresAt !== null && leaseExpiresAt > Number(row.nowMs),
  };
}

function parseWorkflowRun(row: Record<string, any>): WorkflowRun {
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
    resourceId: row.resourceId as string,
    createdAt: new Date(row.createdAtZ || (row.createdAt as string)),
    updatedAt: new Date(row.updatedAtZ || (row.updatedAt as string)),
  };
}

export class WorkflowsDSQL extends WorkflowsStorage {
  #db: DsqlDB;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  /** Tables managed by this domain */
  static readonly MANAGED_TABLES = [TABLE_WORKFLOW_SNAPSHOT] as const;

  constructor(config: DsqlDomainConfig) {
    super();
    const { client, schemaName, skipDefaultIndexes, indexes } = resolveDsqlConfig(config);
    this.#db = new DsqlDB({ client, schemaName });
    this.#schema = schemaName || 'public';
    this.#skipDefaultIndexes = skipDefaultIndexes;
    // Filter indexes to only those for tables managed by this domain
    this.#indexes = indexes?.filter(idx => (WorkflowsDSQL.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  supportsConcurrentUpdates(): boolean {
    return true;
  }

  /**
   * Returns default index definitions for the workflows domain tables.
   * Currently no default indexes are defined for workflows.
   */
  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [];
  }

  /**
   * Creates default indexes for optimal query performance.
   * Currently no default indexes are defined for workflows.
   */
  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) {
      return;
    }
    // No default indexes for workflows domain
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_WORKFLOW_SNAPSHOT, schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT] });
    await this.#db.alterTable({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT],
      ifNotExists: ['resourceId'],
    });
    await this.#db.createTable({
      tableName: TABLE_WORKFLOW_RUN_OWNERS as TABLE_NAMES,
      schema: RUN_FENCING_TABLE_SCHEMAS[TABLE_WORKFLOW_RUN_OWNERS],
    });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  /**
   * Creates custom user-defined indexes for this domain's tables.
   */
  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) {
      return;
    }

    for (const indexDef of this.#indexes) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        // Log but continue - indexes are performance optimizations
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
    await this.#db.clearTable({ tableName: TABLE_WORKFLOW_RUN_OWNERS as TABLE_NAMES });
  }

  // Aurora DSQL resolves contention at commit rather than with lock waits: a
  // claim, renewal, or fenced write that touched the owner row while another
  // committed against it fails with an OCC conflict, and the retry re-reads it.

  supportsRunFencing(): boolean {
    return true;
  }

  #runOwnersTable(): string {
    return getTableName({ indexName: TABLE_WORKFLOW_RUN_OWNERS, schemaName: getSchemaName(this.#schema) });
  }

  async #readRunOwner(q: Queryable, runId: string): Promise<RunOwnershipRecord | null> {
    const row = await q.oneOrNone<RunOwnerRow>(
      `SELECT ${RUN_OWNER_COLUMNS} FROM ${this.#runOwnersTable()} WHERE "runId" = $1`,
      [runId],
    );
    return row ? toRunOwnershipRecord(runId, row) : null;
  }

  #ownershipError(operation: string, runId: string, error: unknown): MastraError {
    return new MastraError(
      {
        id: createStorageErrorId('DSQL', operation, 'FAILED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        details: { runId },
      },
      error,
    );
  }

  async claimRunOwnership({
    runId,
    ownerId,
    leaseMs,
    force,
    expectedGeneration,
  }: ClaimRunOwnershipInput): Promise<ClaimRunOwnershipResult> {
    const table = this.#runOwnersTable();
    try {
      const { result } = await withRetry(
        () =>
          this.#db.client.tx(async (t): Promise<ClaimRunOwnershipResult> => {
            const existing = await t.oneOrNone(`SELECT 1 FROM ${table} WHERE "runId" = $1 FOR UPDATE`, [runId]);
            if (!existing) {
              if (expectedGeneration !== undefined && expectedGeneration !== 0) {
                return { acquired: false, record: null };
              }
              // A concurrent first claim makes this insert fail with an OCC
              // conflict or a duplicate key; the retry sees its row and takes
              // the update path below.
              const inserted = await t.one<RunOwnerRow>(
                `INSERT INTO ${table} ("runId", generation, "ownerId", "leaseExpiresAt")
                 VALUES ($1, 1, $2, ${DB_NOW_MS} + $3)
                 RETURNING ${RUN_OWNER_COLUMNS}`,
                [runId, ownerId, leaseMs],
              );
              return { acquired: true, record: toRunOwnershipRecord(runId, inserted) };
            }
            const claimed = await t.oneOrNone<RunOwnerRow>(
              `UPDATE ${table}
               SET generation = generation + 1, "ownerId" = $2, "leaseExpiresAt" = ${DB_NOW_MS} + $3
               WHERE "runId" = $1
                 AND ($4::integer IS NULL OR generation = $4)
                 AND ($5::boolean OR "leaseExpiresAt" IS NULL OR "leaseExpiresAt" <= ${DB_NOW_MS})
               RETURNING ${RUN_OWNER_COLUMNS}`,
              [runId, ownerId, leaseMs, expectedGeneration ?? null, force === true],
            );
            if (claimed) return { acquired: true, record: toRunOwnershipRecord(runId, claimed) };
            return { acquired: false, record: await this.#readRunOwner(t, runId) };
          }),
        { isRetriable: isRetriableRunFenceWrite },
      );
      return result;
    } catch (error) {
      throw this.#ownershipError('CLAIM_RUN_OWNERSHIP', runId, error);
    }
  }

  async renewRunOwnership({ leaseMs, ...fence }: RenewRunOwnershipInput): Promise<RenewRunOwnershipResult> {
    try {
      const { result } = await withRetry(async (): Promise<RenewRunOwnershipResult> => {
        const renewed = await this.#db.client.oneOrNone<RunOwnerRow>(
          `UPDATE ${this.#runOwnersTable()}
           SET "leaseExpiresAt" = ${DB_NOW_MS} + $4
           WHERE "runId" = $1 AND generation = $2 AND "ownerId" = $3 AND "leaseExpiresAt" IS NOT NULL
           RETURNING ${RUN_OWNER_COLUMNS}`,
          [fence.runId, fence.generation, fence.ownerId, leaseMs],
        );
        if (renewed) return { renewed: true, record: toRunOwnershipRecord(fence.runId, renewed) };
        return { renewed: false, record: await this.#readRunOwner(this.#db.client, fence.runId) };
      });
      return result;
    } catch (error) {
      throw this.#ownershipError('RENEW_RUN_OWNERSHIP', fence.runId, error);
    }
  }

  async releaseRunOwnership(fence: RunFence): Promise<boolean> {
    try {
      const { result } = await withRetry(() =>
        this.#db.client.oneOrNone(
          `UPDATE ${this.#runOwnersTable()}
           SET "leaseExpiresAt" = NULL
           WHERE "runId" = $1 AND generation = $2 AND "ownerId" = $3
           RETURNING "runId"`,
          [fence.runId, fence.generation, fence.ownerId],
        ),
      );
      return result !== null;
    } catch (error) {
      throw this.#ownershipError('RELEASE_RUN_OWNERSHIP', fence.runId, error);
    }
  }

  async getRunOwnership({ runId }: { runId: string }): Promise<RunOwnershipRecord | null> {
    try {
      return await this.#readRunOwner(this.#db.client, runId);
    } catch (error) {
      throw this.#ownershipError('GET_RUN_OWNERSHIP', runId, error);
    }
  }

  async updateWorkflowResults({
    workflowName,
    runId,
    stepId,
    result,
    requestContext,
    fence: explicitFence,
  }: {
    workflowName: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    requestContext: Record<string, any>;
    fence?: RunFence;
  }): Promise<Record<string, StepResult<any, any, any, any>>> {
    const fence = resolveRunFence(this, explicitFence, runId);
    try {
      const { result: context } = await withRetry(
        async () => {
          return this.#db.client.tx(async t => {
            if (fence) await assertRunFence(t, this.#runOwnersTable(), fence, 'updateWorkflowResults');
            const tableName = getTableName({
              indexName: TABLE_WORKFLOW_SNAPSHOT,
              schemaName: getSchemaName(this.#schema),
            });

            const existingSnapshotResult = await t.oneOrNone<{ snapshot: WorkflowRunState | string }>(
              `SELECT snapshot FROM ${tableName} WHERE workflow_name = $1 AND run_id = $2`,
              [workflowName, runId],
            );

            let snapshot: WorkflowRunState;
            if (!existingSnapshotResult) {
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
            } else {
              const existingSnapshot = existingSnapshotResult.snapshot;
              snapshot = typeof existingSnapshot === 'string' ? JSON.parse(existingSnapshot) : existingSnapshot;
            }

            snapshot.context[stepId] = result;
            snapshot.requestContext = { ...snapshot.requestContext, ...requestContext };

            const now = new Date();
            await t.none(
              `INSERT INTO ${tableName} (workflow_name, run_id, snapshot, "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (workflow_name, run_id) DO UPDATE
               SET snapshot = $3, "updatedAt" = $5`,
              [workflowName, runId, JSON.stringify(snapshot), now, now],
            );

            return snapshot.context;
          });
        },
        {
          onRetry: (error, attempt, delay) => {
            this.logger?.warn?.(
              `updateWorkflowResults retry ${attempt} for workflow ${workflowName}/${runId} after ${delay}ms: ${error.message}`,
            );
          },
        },
      );

      return context;
    } catch (error) {
      if (isRunFenceConflictError(error)) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('DSQL', 'UPDATE_WORKFLOW_RESULTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            workflowName,
            runId,
            stepId,
          },
        },
        error,
      );
    }
  }

  async updateWorkflowState({
    workflowName,
    runId,
    opts,
    fence: explicitFence,
  }: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
    fence?: RunFence;
  }): Promise<WorkflowRunState | undefined> {
    const fence = resolveRunFence(this, explicitFence, runId);
    try {
      const { result } = await withRetry(
        async () => {
          return this.#db.client.tx(async t => {
            if (fence) await assertRunFence(t, this.#runOwnersTable(), fence, 'updateWorkflowState');
            const tableName = getTableName({
              indexName: TABLE_WORKFLOW_SNAPSHOT,
              schemaName: getSchemaName(this.#schema),
            });

            const existingSnapshotResult = await t.oneOrNone<{ snapshot: WorkflowRunState | string }>(
              `SELECT snapshot FROM ${tableName} WHERE workflow_name = $1 AND run_id = $2`,
              [workflowName, runId],
            );

            if (!existingSnapshotResult) {
              return undefined;
            }

            const existingSnapshot = existingSnapshotResult.snapshot;
            const snapshot = typeof existingSnapshot === 'string' ? JSON.parse(existingSnapshot) : existingSnapshot;

            if (!snapshot || !snapshot?.context) {
              throw new Error(`Snapshot not found for runId ${runId}`);
            }

            const { expectedStatus, ...state } = opts;
            if (!matchesExpectedWorkflowStatus(snapshot.status, expectedStatus)) {
              return undefined;
            }

            const updatedSnapshot = { ...snapshot, ...state };

            await t.none(
              `UPDATE ${tableName} SET snapshot = $1, "updatedAt" = $2 WHERE workflow_name = $3 AND run_id = $4`,
              [JSON.stringify(updatedSnapshot), new Date(), workflowName, runId],
            );

            return updatedSnapshot;
          });
        },
        {
          onRetry: (error, attempt, delay) => {
            this.logger?.warn?.(
              `updateWorkflowState retry ${attempt} for workflow ${workflowName}/${runId} after ${delay}ms: ${error.message}`,
            );
          },
        },
      );

      return result;
    } catch (error) {
      if (isRunFenceConflictError(error)) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('DSQL', 'UPDATE_WORKFLOW_STATE', 'FAILED'),
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

  async persistWorkflowSnapshot({
    workflowName,
    runId,
    resourceId,
    snapshot,
    createdAt,
    updatedAt,
    fence,
  }: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
    createdAt?: Date;
    updatedAt?: Date;
    fence?: RunFence;
  }): Promise<void> {
    try {
      const now = new Date();
      const createdAtValue = createdAt ? createdAt : now;
      const updatedAtValue = updatedAt ? updatedAt : now;
      const resolvedFence = resolveRunFence(this, fence, runId);
      await withRetry(() =>
        withRunFence(this.#db.client, this.#runOwnersTable(), resolvedFence, 'persistWorkflowSnapshot', q =>
          q.none(
            `INSERT INTO ${getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.#schema) })} (workflow_name, run_id, "resourceId", snapshot, "createdAt", "updatedAt")
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (workflow_name, run_id) DO UPDATE
                 SET "resourceId" = $3, snapshot = $4, "updatedAt" = $6`,
            [
              workflowName,
              runId,
              resourceId,
              JSON.stringify(snapshot),
              createdAtValue.toISOString(),
              updatedAtValue.toISOString(),
            ],
          ),
        ),
      );
    } catch (error) {
      if (isRunFenceConflictError(error)) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('DSQL', 'PERSIST_WORKFLOW_SNAPSHOT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async loadWorkflowSnapshot({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    try {
      const result = await this.#db.load<{ snapshot: WorkflowRunState }>({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        keys: { workflow_name: workflowName, run_id: runId },
      });

      return result ? result.snapshot : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('DSQL', 'LOAD_WORKFLOW_SNAPSHOT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
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
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (runId) {
        conditions.push(`run_id = $${paramIndex}`);
        values.push(runId);
        paramIndex++;
      }

      if (workflowName) {
        conditions.push(`workflow_name = $${paramIndex}`);
        values.push(workflowName);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const query = `
          SELECT * FROM ${getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.#schema) })}
          ${whereClause}
          ORDER BY "createdAt" DESC LIMIT 1
        `;

      const queryValues = values;

      const result = await this.#db.client.oneOrNone(query, queryValues);

      if (!result) {
        return null;
      }

      return parseWorkflowRun(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('DSQL', 'GET_WORKFLOW_RUN_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
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
    try {
      const resolvedFence = resolveRunFence(this, fence, runId);
      await withRetry(() =>
        withRunFence(this.#db.client, this.#runOwnersTable(), resolvedFence, 'deleteWorkflowRunById', q =>
          q.none(
            `DELETE FROM ${getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.#schema) })} WHERE run_id = $1 AND workflow_name = $2`,
            [runId, workflowName],
          ),
        ),
      );
    } catch (error) {
      if (isRunFenceConflictError(error)) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('DSQL', 'DELETE_WORKFLOW_RUN_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
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
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (workflowName) {
        conditions.push(`workflow_name = $${paramIndex}`);
        values.push(workflowName);
        paramIndex++;
      }

      if (status) {
        conditions.push(`snapshot::jsonb ->> 'status' = $${paramIndex}`);
        values.push(status);
        paramIndex++;
      }

      if (resourceId) {
        const hasResourceId = await this.#db.hasColumn(TABLE_WORKFLOW_SNAPSHOT, 'resourceId');
        if (hasResourceId) {
          conditions.push(`"resourceId" = $${paramIndex}`);
          values.push(resourceId);
          paramIndex++;
        } else {
          console.warn(`[${TABLE_WORKFLOW_SNAPSHOT}] resourceId column not found. Skipping resourceId filter.`);
        }
      }

      if (fromDate) {
        conditions.push(`"createdAt" >= $${paramIndex}`);
        values.push(fromDate instanceof Date ? fromDate.toISOString() : fromDate);
        paramIndex++;
      }

      if (toDate) {
        conditions.push(`"createdAt" <= $${paramIndex}`);
        values.push(toDate instanceof Date ? toDate.toISOString() : toDate);
        paramIndex++;
      }
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      let total = 0;
      const usePagination = typeof perPage === 'number' && typeof page === 'number';
      if (usePagination) {
        const countResult = await this.#db.client.one(
          `SELECT COUNT(*) as count FROM ${getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.#schema) })} ${whereClause}`,
          values,
        );
        total = Number(countResult.count);
      }

      const normalizedPerPage = usePagination ? normalizePerPage(perPage, Number.MAX_SAFE_INTEGER) : 0;
      const offset = usePagination ? page! * normalizedPerPage : undefined;

      const query = `
          SELECT * FROM ${getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.#schema) })}
          ${whereClause}
          ORDER BY "createdAt" DESC
          ${usePagination ? ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}` : ''}
        `;

      const queryValues = usePagination ? [...values, normalizedPerPage, offset] : values;

      const result = await this.#db.client.manyOrNone(query, queryValues);

      const runs = (result || []).map(row => {
        return parseWorkflowRun(row);
      });

      return { runs, total: total || runs.length };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('DSQL', 'LIST_WORKFLOW_RUNS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            workflowName: workflowName || 'all',
          },
        },
        error,
      );
    }
  }
}
