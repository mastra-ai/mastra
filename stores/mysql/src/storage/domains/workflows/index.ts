import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_SCHEMAS,
  TABLE_WORKFLOW_RUN_OWNERS,
  RUN_FENCING_TABLE_SCHEMAS,
  WorkflowsStorage,
  createStorageErrorId,
  normalizePerPage,
  matchesExpectedWorkflowStatus,
  matchesRunFence,
  isRunFenceConflictError,
  resolveRunFence,
} from '@mastra/core/storage';
import type {
  ClaimRunOwnershipInput,
  ClaimRunOwnershipResult,
  CreateIndexOptions,
  RenewRunOwnershipInput,
  RenewRunOwnershipResult,
  RunFence,
  RunOwnershipRecord,
  StorageListWorkflowRunsInput,
  TABLE_NAMES,
  UpdateWorkflowStateOptions,
  WorkflowRun,
  WorkflowRuns,
} from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { assertRunFence, claimTransaction, DB_NOW_MS, inTransaction, withRunFence } from '../../db/run-fencing';
import type { Queryable } from '../../db/run-fencing';
import type { StoreOperationsMySQL } from '../operations';
import { generateTableSQL } from '../operations';
import { formatTableName, parseDateTime, quoteIdentifier, transformToSqlValue } from '../utils';

interface WorkflowRow {
  workflow_name: string;
  run_id: string;
  resourceId: string | null;
  snapshot: string | WorkflowRunState;
  createdAt: Date | string;
  updatedAt: Date | string;
}

function parseSnapshot(snapshot: string | WorkflowRunState): WorkflowRunState | string {
  if (typeof snapshot === 'string') {
    try {
      return JSON.parse(snapshot) as WorkflowRunState;
    } catch {
      return snapshot;
    }
  }
  return snapshot;
}

const RUN_OWNERS_TABLE = formatTableName(TABLE_WORKFLOW_RUN_OWNERS as TABLE_NAMES);
const RUN_ID = quoteIdentifier('runId', 'column name');
const OWNER_ID = quoteIdentifier('ownerId', 'column name');
const LEASE_EXPIRES_AT = quoteIdentifier('leaseExpiresAt', 'column name');
const RUN_OWNER_COLUMNS = `generation, ${OWNER_ID} AS ownerId, ${LEASE_EXPIRES_AT} AS leaseExpiresAt, ${DB_NOW_MS} AS nowMs`;

function toRunOwnershipRecord(runId: string, row: RowDataPacket): RunOwnershipRecord {
  const leaseExpiresAt = row.leaseExpiresAt === null ? null : Number(row.leaseExpiresAt);
  return {
    runId,
    generation: Number(row.generation),
    ownerId: String(row.ownerId),
    leaseExpiresAt: leaseExpiresAt === null ? null : new Date(leaseExpiresAt),
    live: leaseExpiresAt !== null && leaseExpiresAt > Number(row.nowMs),
  };
}

async function readRunOwner(q: Queryable, runId: string): Promise<RunOwnershipRecord | null> {
  const [rows] = await q.execute<RowDataPacket[]>(
    `SELECT ${RUN_OWNER_COLUMNS} FROM ${RUN_OWNERS_TABLE} WHERE ${RUN_ID} = ?`,
    [runId],
  );
  return rows[0] ? toRunOwnershipRecord(runId, rows[0]) : null;
}

function mapWorkflowRow(row: WorkflowRow): WorkflowRun {
  return {
    workflowName: row.workflow_name,
    runId: row.run_id,
    resourceId: row.resourceId ?? undefined,
    snapshot: parseSnapshot(row.snapshot),
    createdAt: parseDateTime(row.createdAt) ?? new Date(),
    updatedAt: parseDateTime(row.updatedAt) ?? new Date(),
  };
}

export class WorkflowsMySQL extends WorkflowsStorage {
  private operations: StoreOperationsMySQL;
  private pool: Pool;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  /** Tables managed by this domain */
  static readonly MANAGED_TABLES = [TABLE_WORKFLOW_SNAPSHOT] as const;

  /**
   * Returns default index definitions for the workflows domain tables.
   * Currently no default indexes are defined for workflows.
   */
  static getDefaultIndexDefs(_prefix: string = ''): CreateIndexOptions[] {
    return [];
  }

  /**
   * Exports DDL statements for all managed tables.
   */
  static getExportDDL(): string[] {
    return [
      generateTableSQL({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT],
        compositePrimaryKey: ['workflow_name', 'run_id'],
      }),
      generateTableSQL({
        tableName: TABLE_WORKFLOW_RUN_OWNERS as TABLE_NAMES,
        schema: RUN_FENCING_TABLE_SCHEMAS[TABLE_WORKFLOW_RUN_OWNERS],
      }),
    ];
  }

  constructor({
    operations,
    pool,
    skipDefaultIndexes,
    indexes,
  }: {
    operations: StoreOperationsMySQL;
    pool: Pool;
    skipDefaultIndexes?: boolean;
    indexes?: CreateIndexOptions[];
  }) {
    super();
    this.operations = operations;
    this.pool = pool;
    this.#skipDefaultIndexes = skipDefaultIndexes;
    this.#indexes = indexes?.filter(idx => (WorkflowsMySQL.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  supportsConcurrentUpdates(): boolean {
    return true;
  }

  /**
   * Returns default index definitions for the workflows domain tables.
   */
  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return WorkflowsMySQL.getDefaultIndexDefs('');
  }

  /**
   * Creates default indexes for optimal query performance.
   * Currently no default indexes are defined for workflows.
   */
  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) return;
    // No default indexes for workflows domain
  }

  /**
   * Creates custom user-defined indexes for this domain's tables.
   */
  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) return;
    for (const indexDef of this.#indexes) {
      await this.operations.createIndex(indexDef);
    }
  }

  async init(): Promise<void> {
    const schema = TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT];
    await this.operations.createTable({ tableName: TABLE_WORKFLOW_SNAPSHOT, schema });
    await this.operations.alterTable({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      schema,
      ifNotExists: ['resourceId'],
    });
    await this.operations.createTable({
      tableName: TABLE_WORKFLOW_RUN_OWNERS as TABLE_NAMES,
      schema: RUN_FENCING_TABLE_SCHEMAS[TABLE_WORKFLOW_RUN_OWNERS],
    });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.pool.execute(`DELETE FROM ${formatTableName(TABLE_WORKFLOW_SNAPSHOT)}`);
    await this.pool.execute(`DELETE FROM ${RUN_OWNERS_TABLE}`);
  }

  supportsRunFencing(): boolean {
    return true;
  }

  #ownershipError(operation: string, runId: string, error: unknown): MastraError {
    return new MastraError(
      {
        id: createStorageErrorId('MYSQL', operation, 'FAILED'),
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
    try {
      return await claimTransaction(this.pool, async connection => {
        const [existing] = await connection.execute<RowDataPacket[]>(
          `SELECT generation FROM ${RUN_OWNERS_TABLE} WHERE ${RUN_ID} = ? FOR UPDATE`,
          [runId],
        );
        if (existing.length === 0) {
          if (expectedGeneration !== undefined && expectedGeneration !== 0) {
            return { acquired: false, record: null };
          }
          await connection.execute(
            `INSERT INTO ${RUN_OWNERS_TABLE} (${RUN_ID}, generation, ${OWNER_ID}, ${LEASE_EXPIRES_AT})
             VALUES (?, 1, ?, ${DB_NOW_MS} + ?)`,
            [runId, ownerId, leaseMs],
          );
          return { acquired: true, record: (await readRunOwner(connection, runId))! };
        }
        // The row lock is held from the statement above, so the lease check in
        // this statement reads the database clock after any wait for it.
        await connection.execute(
          `UPDATE ${RUN_OWNERS_TABLE}
           SET generation = generation + 1, ${OWNER_ID} = ?, ${LEASE_EXPIRES_AT} = ${DB_NOW_MS} + ?
           WHERE ${RUN_ID} = ?
             AND (? IS NULL OR generation = ?)
             AND (? OR ${LEASE_EXPIRES_AT} IS NULL OR ${LEASE_EXPIRES_AT} <= ${DB_NOW_MS})`,
          [ownerId, leaseMs, runId, expectedGeneration ?? null, expectedGeneration ?? null, force === true],
        );
        const record = await readRunOwner(connection, runId);
        // Comparing generations under the held row lock, rather than counting
        // affected rows, keeps the answer independent of the FOUND_ROWS flag.
        return record && record.generation === Number(existing[0]!.generation) + 1
          ? { acquired: true, record }
          : { acquired: false, record };
      });
    } catch (error) {
      throw this.#ownershipError('CLAIM_RUN_OWNERSHIP', runId, error);
    }
  }

  async renewRunOwnership({ leaseMs, ...fence }: RenewRunOwnershipInput): Promise<RenewRunOwnershipResult> {
    try {
      return await inTransaction(this.pool, async connection => {
        await connection.execute(
          `UPDATE ${RUN_OWNERS_TABLE}
           SET ${LEASE_EXPIRES_AT} = ${DB_NOW_MS} + ?
           WHERE ${RUN_ID} = ? AND generation = ? AND ${OWNER_ID} = ? AND ${LEASE_EXPIRES_AT} IS NOT NULL`,
          [leaseMs, fence.runId, fence.generation, fence.ownerId],
        );
        const record = await readRunOwner(connection, fence.runId);
        return record && matchesRunFence(record, fence) && record.leaseExpiresAt !== null
          ? { renewed: true, record }
          : { renewed: false, record };
      });
    } catch (error) {
      throw this.#ownershipError('RENEW_RUN_OWNERSHIP', fence.runId, error);
    }
  }

  async releaseRunOwnership(fence: RunFence): Promise<boolean> {
    try {
      return await inTransaction(this.pool, async connection => {
        await connection.execute(
          `UPDATE ${RUN_OWNERS_TABLE} SET ${LEASE_EXPIRES_AT} = NULL
           WHERE ${RUN_ID} = ? AND generation = ? AND ${OWNER_ID} = ?`,
          [fence.runId, fence.generation, fence.ownerId],
        );
        return matchesRunFence(await readRunOwner(connection, fence.runId), fence);
      });
    } catch (error) {
      throw this.#ownershipError('RELEASE_RUN_OWNERSHIP', fence.runId, error);
    }
  }

  async getRunOwnership({ runId }: { runId: string }): Promise<RunOwnershipRecord | null> {
    try {
      return await readRunOwner(this.pool, runId);
    } catch (error) {
      throw this.#ownershipError('GET_RUN_OWNERSHIP', runId, error);
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
      await withRunFence(this.pool, RUN_OWNERS_TABLE, resolveRunFence(this, fence, runId), 'deleteWorkflowRunById', q =>
        q.execute(
          `DELETE FROM ${formatTableName(TABLE_WORKFLOW_SNAPSHOT)} WHERE ${quoteIdentifier('workflow_name', 'column name')} = ? AND ${quoteIdentifier('run_id', 'column name')} = ?`,
          [workflowName, runId],
        ),
      );
    } catch (error) {
      if (isRunFenceConflictError(error)) throw error;
      throw new MastraError(
        {
          id: 'MYSQL_WORKFLOWS_DELETE_RUN_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { runId, workflowName },
        },
        error,
      );
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
    requestContext?: Record<string, any>;
    fence?: RunFence;
  }): Promise<Record<string, StepResult<any, any, any, any>>> {
    const fence = resolveRunFence(this, explicitFence, runId);
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      if (fence) await assertRunFence(connection, RUN_OWNERS_TABLE, fence, 'updateWorkflowResults');
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT snapshot FROM ${formatTableName(TABLE_WORKFLOW_SNAPSHOT)} WHERE ${quoteIdentifier('workflow_name', 'column name')} = ? AND ${quoteIdentifier('run_id', 'column name')} = ? FOR UPDATE`,
        [workflowName, runId],
      );
      if (!Array.isArray(rows) || rows.length === 0) {
        await connection.rollback();
        throw new MastraError({
          id: 'MYSQL_WORKFLOWS_UPDATE_RESULTS_NOT_FOUND',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { workflowName, runId },
        });
      }

      const currentSnapshot = parseSnapshot(rows[0]!.snapshot) as WorkflowRunState;
      const context = { ...(currentSnapshot.context ?? {}) };

      context[stepId] = result;

      const updatedSnapshot: WorkflowRunState = {
        ...currentSnapshot,
        context,
        requestContext: { ...(currentSnapshot.requestContext ?? {}), ...(requestContext ?? {}) },
      };

      await connection.execute(
        `UPDATE ${formatTableName(TABLE_WORKFLOW_SNAPSHOT)} SET ${quoteIdentifier('snapshot', 'column name')} = ?, ${quoteIdentifier('updatedAt', 'column name')} = ? WHERE ${quoteIdentifier('workflow_name', 'column name')} = ? AND ${quoteIdentifier('run_id', 'column name')} = ?`,
        [JSON.stringify(updatedSnapshot), transformToSqlValue(new Date()), workflowName, runId],
      );

      await connection.commit();

      return context;
    } catch (error) {
      await connection.rollback();
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: 'MYSQL_WORKFLOWS_UPDATE_RESULTS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName, runId, stepId },
        },
        error,
      );
    } finally {
      connection.release();
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
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      if (fence) await assertRunFence(connection, RUN_OWNERS_TABLE, fence, 'updateWorkflowState');
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT snapshot FROM ${formatTableName(TABLE_WORKFLOW_SNAPSHOT)} WHERE ${quoteIdentifier('workflow_name', 'column name')} = ? AND ${quoteIdentifier('run_id', 'column name')} = ? FOR UPDATE`,
        [workflowName, runId],
      );
      if (!Array.isArray(rows) || rows.length === 0) {
        await connection.rollback();
        return undefined;
      }

      const existing = parseSnapshot(rows[0]!.snapshot) as WorkflowRunState;

      const { expectedStatus, ...state } = opts;
      if (!matchesExpectedWorkflowStatus(existing.status, expectedStatus)) {
        await connection.rollback();
        return undefined;
      }

      // Merge opts into the snapshot
      const updatedSnapshot = { ...existing, ...state };

      await connection.execute(
        `UPDATE ${formatTableName(TABLE_WORKFLOW_SNAPSHOT)} SET ${quoteIdentifier('snapshot', 'column name')} = ?, ${quoteIdentifier('updatedAt', 'column name')} = ? WHERE ${quoteIdentifier('workflow_name', 'column name')} = ? AND ${quoteIdentifier('run_id', 'column name')} = ?`,
        [JSON.stringify(updatedSnapshot), transformToSqlValue(new Date()), workflowName, runId],
      );
      await connection.commit();

      return updatedSnapshot;
    } catch (error) {
      await connection.rollback();
      if (isRunFenceConflictError(error)) throw error;
      throw new MastraError(
        {
          id: 'MYSQL_WORKFLOWS_UPDATE_STATE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName, runId },
        },
        error,
      );
    } finally {
      connection.release();
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
    const now = new Date();
    const createdAtValue = createdAt ?? now;
    const updatedAtValue = updatedAt ?? now;
    const tableName = formatTableName(TABLE_WORKFLOW_SNAPSHOT);
    try {
      await withRunFence(
        this.pool,
        RUN_OWNERS_TABLE,
        resolveRunFence(this, fence, runId),
        'persistWorkflowSnapshot',
        async q => {
          const [updateResult] = await q.execute<ResultSetHeader>(
            `UPDATE ${tableName}
           SET ${quoteIdentifier('resourceId', 'column name')} = ?,
               ${quoteIdentifier('snapshot', 'column name')} = ?,
               ${quoteIdentifier('updatedAt', 'column name')} = ?
           WHERE ${quoteIdentifier('workflow_name', 'column name')} = ? AND ${quoteIdentifier('run_id', 'column name')} = ?`,
            [resourceId ?? null, JSON.stringify(snapshot), transformToSqlValue(updatedAtValue), workflowName, runId],
          );

          if (updateResult.affectedRows > 0) {
            return;
          }

          await q.execute(
            `INSERT INTO ${tableName} (${quoteIdentifier('workflow_name', 'column name')}, ${quoteIdentifier('run_id', 'column name')}, ${quoteIdentifier('resourceId', 'column name')}, ${quoteIdentifier('snapshot', 'column name')}, ${quoteIdentifier('createdAt', 'column name')}, ${quoteIdentifier('updatedAt', 'column name')})
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE ${quoteIdentifier('resourceId', 'column name')} = VALUES(${quoteIdentifier('resourceId', 'column name')}), ${quoteIdentifier('snapshot', 'column name')} = VALUES(${quoteIdentifier('snapshot', 'column name')}), ${quoteIdentifier('updatedAt', 'column name')} = VALUES(${quoteIdentifier('updatedAt', 'column name')})`,
            [
              workflowName,
              runId,
              resourceId ?? null,
              JSON.stringify(snapshot),
              transformToSqlValue(createdAtValue),
              transformToSqlValue(updatedAtValue),
            ],
          );
        },
      );
    } catch (error) {
      if (isRunFenceConflictError(error)) throw error;
      throw new MastraError(
        {
          id: 'MYSQL_WORKFLOWS_PERSIST_SNAPSHOT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName, runId },
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
      const row = await this.operations.load<WorkflowRow>({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        keys: { workflow_name: workflowName, run_id: runId },
      });
      return row ? (parseSnapshot(row.snapshot) as WorkflowRunState) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_WORKFLOWS_LOAD_SNAPSHOT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName, runId },
        },
        error,
      );
    }
  }

  async listWorkflowRuns(args: StorageListWorkflowRunsInput = {}): Promise<WorkflowRuns> {
    const { workflowName, fromDate, toDate, perPage, page, resourceId, status } = args;

    const conditions: string[] = [];
    const params: any[] = [];

    if (workflowName) {
      conditions.push(`${quoteIdentifier('workflow_name', 'column name')} = ?`);
      params.push(workflowName);
    }
    if (resourceId) {
      conditions.push(`${quoteIdentifier('resourceId', 'column name')} = ?`);
      params.push(resourceId);
    }
    if (status) {
      conditions.push(`JSON_EXTRACT(${quoteIdentifier('snapshot', 'column name')}, '$.status') = ?`);
      params.push(status);
    }
    if (fromDate) {
      conditions.push(`${quoteIdentifier('createdAt', 'column name')} >= ?`);
      params.push(transformToSqlValue(fromDate));
    }
    if (toDate) {
      conditions.push(`${quoteIdentifier('createdAt', 'column name')} <= ?`);
      params.push(transformToSqlValue(toDate));
    }

    const whereSql = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    const tableName = formatTableName(TABLE_WORKFLOW_SNAPSHOT);

    try {
      let total = 0;
      const usePagination = typeof perPage === 'number' && typeof page === 'number';

      if (usePagination) {
        const [countRows] = await this.pool.execute<RowDataPacket[]>(
          `SELECT COUNT(*) as count FROM ${tableName}${whereSql}`,
          params,
        );
        total = Number(countRows[0]?.count ?? 0);

        if (total === 0) {
          return { runs: [], total: 0 };
        }
      }

      let paginationClause = '';

      if (usePagination) {
        const normalizedPerPage = normalizePerPage(perPage, Number.MAX_SAFE_INTEGER);
        const offset = page * normalizedPerPage;
        paginationClause = ` LIMIT ${Number(normalizedPerPage)} OFFSET ${Number(offset)}`;
      }

      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT workflow_name, run_id, resourceId, snapshot, createdAt, updatedAt FROM ${tableName}${whereSql} ORDER BY ${quoteIdentifier('createdAt', 'column name')} DESC${paginationClause}`,
        params,
      );

      const runs = (rows as unknown as WorkflowRow[]).map(mapWorkflowRow);

      return {
        runs,
        total: total || runs.length,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_WORKFLOWS_GET_RUNS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getWorkflowRuns(args: StorageListWorkflowRunsInput = {}): Promise<WorkflowRuns> {
    return this.listWorkflowRuns(args);
  }

  async getWorkflowRunById({
    runId,
    workflowName,
  }: {
    runId: string;
    workflowName?: string;
  }): Promise<WorkflowRun | null> {
    try {
      const runs = await this.operations.loadMany<WorkflowRow>({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        whereClause: {
          sql: workflowName ? ' WHERE workflow_name = ? AND run_id = ?' : ' WHERE run_id = ?',
          args: workflowName ? [workflowName, runId] : [runId],
        },
        orderBy: '`createdAt` DESC',
        limit: 1,
      });
      if (!runs.length) return null;
      return mapWorkflowRow(runs[0]!);
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_WORKFLOWS_GET_RUN_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { runId, workflowName: workflowName ?? '' },
        },
        error,
      );
    }
  }
}
