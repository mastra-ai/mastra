import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type {
  ClaimRunOwnershipInput,
  ClaimRunOwnershipResult,
  RenewRunOwnershipInput,
  RenewRunOwnershipResult,
  RunFence,
  RunOwnershipRecord,
  WorkflowRun,
  WorkflowRuns,
  StorageListWorkflowRunsInput,
  TABLE_NAMES,
  UpdateWorkflowStateOptions,
} from '@mastra/core/storage';
import {
  createStorageErrorId,
  ensureDate,
  isRunFenceConflictError,
  resolveRunFence,
  RUN_FENCING_TABLE_SCHEMAS,
  TABLE_WORKFLOW_RUN_OWNERS,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_SCHEMAS,
  WorkflowsStorage,
} from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import { D1DB, resolveD1Config } from '../../db';
import type { D1DomainConfig } from '../../db';
import { DB_NOW_MS, executeFenced, runFenceGuard } from '../../db/run-fencing';
import type { RunFenceCheck } from '../../db/run-fencing';
import { createSqlBuilder } from '../../sql-builder';
import type { SqlParam } from '../../sql-builder';
import { isArrayOfRecords } from '../utils';

const RUN_OWNER_COLUMNS = `generation, ownerId, leaseExpiresAt, ${DB_NOW_MS} AS nowMs`;

function toRunOwnershipRecord(runId: string, row: Record<string, unknown>): RunOwnershipRecord {
  const leaseExpiresAt = row.leaseExpiresAt === null ? null : Number(row.leaseExpiresAt);
  return {
    runId,
    generation: Number(row.generation),
    ownerId: String(row.ownerId),
    leaseExpiresAt: leaseExpiresAt === null ? null : new Date(leaseExpiresAt),
    live: leaseExpiresAt !== null && leaseExpiresAt > Number(row.nowMs),
  };
}

export class WorkflowsStorageD1 extends WorkflowsStorage {
  #db: D1DB;

  constructor(config: D1DomainConfig) {
    super();
    this.#db = new D1DB(resolveD1Config(config));
  }

  supportsConcurrentUpdates(): boolean {
    // D1 doesn't support atomic read-modify-write operations needed for concurrent updates
    // batch() executes all statements atomically but requires all statements upfront,
    // so we can't use SELECT result to construct UPDATE in the same transaction
    return false;
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_WORKFLOW_SNAPSHOT, schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT] });
    await this.#db.createTable({
      tableName: TABLE_WORKFLOW_RUN_OWNERS as TABLE_NAMES,
      schema: RUN_FENCING_TABLE_SCHEMAS[TABLE_WORKFLOW_RUN_OWNERS],
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
    await this.#db.clearTable({ tableName: TABLE_WORKFLOW_RUN_OWNERS as TABLE_NAMES });
  }

  supportsRunFencing(): boolean {
    return true;
  }

  get #ownersTable(): string {
    return this.#db.getTableName(TABLE_WORKFLOW_RUN_OWNERS as TABLE_NAMES);
  }

  #runFenceCheck(fence: RunFence | undefined, runId: string, operation: string): RunFenceCheck | undefined {
    const resolved = resolveRunFence(this, fence, runId);
    return resolved && { claimsTable: this.#ownersTable, fence: resolved, operation };
  }

  async #readRunOwner(runId: string): Promise<RunOwnershipRecord | null> {
    const row = (await this.#db.executeQuery({
      sql: `SELECT ${RUN_OWNER_COLUMNS} FROM ${this.#ownersTable} WHERE runId = ?`,
      params: [runId],
      first: true,
    })) as Record<string, unknown> | null;
    return row ? toRunOwnershipRecord(runId, row) : null;
  }

  #ownershipError(operation: string, runId: string, error: unknown): MastraError {
    return new MastraError(
      {
        id: createStorageErrorId('CLOUDFLARE_D1', operation, 'FAILED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        details: { runId },
      },
      error,
    );
  }

  // D1 has no interactive transactions, so each claim, renewal and release is
  // a single statement that judges the current claim and replaces it at once.
  // Racing claimers resolve one at a time; a statement that writes no row
  // lost, and the follow-up read reports the claim that beat it.

  async claimRunOwnership({
    runId,
    ownerId,
    leaseMs,
    force,
    expectedGeneration,
  }: ClaimRunOwnershipInput): Promise<ClaimRunOwnershipResult> {
    const notLive = `(leaseExpiresAt IS NULL OR leaseExpiresAt <= ${DB_NOW_MS})`;
    let statement: { sql: string; params: SqlParam[] };
    if (expectedGeneration === undefined) {
      statement = {
        sql: `INSERT INTO ${this.#ownersTable} (runId, generation, ownerId, leaseExpiresAt)
          VALUES (?, 1, ?, ${DB_NOW_MS} + ?)
          ON CONFLICT(runId) DO UPDATE SET
            generation = generation + 1,
            ownerId = excluded.ownerId,
            leaseExpiresAt = excluded.leaseExpiresAt
          ${force ? '' : `WHERE ${notLive}`}`,
        params: [runId, ownerId, leaseMs],
      };
    } else if (expectedGeneration === 0) {
      // Generation 0 means the run was never claimed: only a first claim matches.
      statement = {
        sql: `INSERT INTO ${this.#ownersTable} (runId, generation, ownerId, leaseExpiresAt)
          VALUES (?, 1, ?, ${DB_NOW_MS} + ?)
          ON CONFLICT(runId) DO NOTHING`,
        params: [runId, ownerId, leaseMs],
      };
    } else {
      statement = {
        sql: `UPDATE ${this.#ownersTable}
          SET generation = generation + 1, ownerId = ?, leaseExpiresAt = ${DB_NOW_MS} + ?
          WHERE runId = ? AND generation = ?${force ? '' : ` AND ${notLive}`}`,
        params: [ownerId, leaseMs, runId, expectedGeneration],
      };
    }

    try {
      const rows = (await this.#db.executeQuery({
        sql: `${statement.sql} RETURNING ${RUN_OWNER_COLUMNS}`,
        params: statement.params,
      })) as Record<string, unknown>[];
      const claimed = rows[0];
      if (claimed) return { acquired: true, record: toRunOwnershipRecord(runId, claimed) };
      return { acquired: false, record: await this.#readRunOwner(runId) };
    } catch (error) {
      throw this.#ownershipError('CLAIM_RUN_OWNERSHIP', runId, error);
    }
  }

  async renewRunOwnership({ leaseMs, ...fence }: RenewRunOwnershipInput): Promise<RenewRunOwnershipResult> {
    try {
      const rows = (await this.#db.executeQuery({
        sql: `UPDATE ${this.#ownersTable} SET leaseExpiresAt = ${DB_NOW_MS} + ?
          WHERE runId = ? AND generation = ? AND ownerId = ? AND leaseExpiresAt IS NOT NULL
          RETURNING ${RUN_OWNER_COLUMNS}`,
        params: [leaseMs, fence.runId, fence.generation, fence.ownerId],
      })) as Record<string, unknown>[];
      const renewed = rows[0];
      if (renewed) return { renewed: true, record: toRunOwnershipRecord(fence.runId, renewed) };
      return { renewed: false, record: await this.#readRunOwner(fence.runId) };
    } catch (error) {
      throw this.#ownershipError('RENEW_RUN_OWNERSHIP', fence.runId, error);
    }
  }

  async releaseRunOwnership(fence: RunFence): Promise<boolean> {
    try {
      const rows = (await this.#db.executeQuery({
        sql: `UPDATE ${this.#ownersTable} SET leaseExpiresAt = NULL
          WHERE runId = ? AND generation = ? AND ownerId = ?
          RETURNING runId`,
        params: [fence.runId, fence.generation, fence.ownerId],
      })) as Record<string, unknown>[];
      return rows.length > 0;
    } catch (error) {
      throw this.#ownershipError('RELEASE_RUN_OWNERSHIP', fence.runId, error);
    }
  }

  async getRunOwnership({ runId }: { runId: string }): Promise<RunOwnershipRecord | null> {
    try {
      return await this.#readRunOwner(runId);
    } catch (error) {
      throw this.#ownershipError('GET_RUN_OWNERSHIP', runId, error);
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
      'updateWorkflowResults is not implemented for Cloudflare D1 storage. D1 does not support atomic read-modify-write operations needed for concurrent workflow updates.',
    );
  }

  async updateWorkflowState(_args: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
  }): Promise<WorkflowRunState | undefined> {
    throw new Error(
      'updateWorkflowState is not implemented for Cloudflare D1 storage. D1 does not support atomic read-modify-write operations needed for concurrent workflow updates.',
    );
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
    const fullTableName = this.#db.getTableName(TABLE_WORKFLOW_SNAPSHOT);
    const now = new Date().toISOString();
    const check = this.#runFenceCheck(fence, runId, 'persistWorkflowSnapshot');

    const currentSnapshot = await this.#db.load({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      keys: { workflow_name: workflowName, run_id: runId },
    });

    const persisting = currentSnapshot
      ? {
          ...currentSnapshot,
          resourceId,
          snapshot: JSON.stringify(snapshot),
          updatedAt: updatedAt ? updatedAt.toISOString() : now,
        }
      : {
          workflow_name: workflowName,
          run_id: runId,
          resourceId,
          snapshot: snapshot as Record<string, any>,
          createdAt: createdAt ? createdAt.toISOString() : now,
          updatedAt: updatedAt ? updatedAt.toISOString() : now,
        };

    // Process record for SQL insertion
    const processedRecord = await this.#db.processRecord(persisting);

    const columns = Object.keys(processedRecord);
    const values = Object.values(processedRecord);

    // Specify which columns to update on conflict (all except PKs)
    const updateMap: Record<string, string> = {
      snapshot: 'excluded.snapshot',
      updatedAt: 'excluded.updatedAt',
    };

    this.logger.debug('Persisting workflow snapshot', { workflowName, runId });

    // Use the new insert method with ON CONFLICT
    const query = createSqlBuilder().insert(
      fullTableName,
      columns,
      values,
      ['workflow_name', 'run_id'],
      updateMap,
      runFenceGuard(check),
    );

    try {
      await executeFenced(this.#db, check, query.build());
    } catch (error) {
      if (isRunFenceConflictError(error)) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_D1', 'PERSIST_WORKFLOW_SNAPSHOT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to persist workflow snapshot: ${error instanceof Error ? error.message : String(error)}`,
          details: { workflowName, runId },
        },
        error,
      );
    }
  }

  async loadWorkflowSnapshot(params: { workflowName: string; runId: string }): Promise<WorkflowRunState | null> {
    const { workflowName, runId } = params;

    this.logger.debug('Loading workflow snapshot', { workflowName, runId });

    try {
      const d = await this.#db.load<{ snapshot: unknown }>({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        keys: {
          workflow_name: workflowName,
          run_id: runId,
        },
      });

      return d ? (d.snapshot as WorkflowRunState) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_D1', 'LOAD_WORKFLOW_SNAPSHOT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to load workflow snapshot: ${error instanceof Error ? error.message : String(error)}`,
          details: { workflowName, runId },
        },
        error,
      );
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

  async listWorkflowRuns({
    workflowName,
    fromDate,
    toDate,
    page,
    perPage,
    resourceId,
    status,
  }: StorageListWorkflowRunsInput = {}): Promise<WorkflowRuns> {
    const fullTableName = this.#db.getTableName(TABLE_WORKFLOW_SNAPSHOT);
    try {
      const builder = createSqlBuilder().select().from(fullTableName);
      const countBuilder = createSqlBuilder().count().from(fullTableName);

      if (workflowName) builder.whereAnd('workflow_name = ?', workflowName);
      if (status) {
        builder.whereAnd("CASE WHEN json_valid(snapshot) THEN json_extract(snapshot, '$.status') END = ?", status);
        countBuilder.whereAnd("CASE WHEN json_valid(snapshot) THEN json_extract(snapshot, '$.status') END = ?", status);
      }
      if (resourceId) {
        const hasResourceId = await this.#db.hasColumn(fullTableName, 'resourceId');
        if (hasResourceId) {
          builder.whereAnd('resourceId = ?', resourceId);
          countBuilder.whereAnd('resourceId = ?', resourceId);
        } else {
          this.logger.warn(`[${fullTableName}] resourceId column not found. Skipping resourceId filter.`);
        }
      }
      if (fromDate) {
        builder.whereAnd('createdAt >= ?', fromDate instanceof Date ? fromDate.toISOString() : fromDate);
        countBuilder.whereAnd('createdAt >= ?', fromDate instanceof Date ? fromDate.toISOString() : fromDate);
      }
      if (toDate) {
        builder.whereAnd('createdAt <= ?', toDate instanceof Date ? toDate.toISOString() : toDate);
        countBuilder.whereAnd('createdAt <= ?', toDate instanceof Date ? toDate.toISOString() : toDate);
      }

      builder.orderBy('createdAt', 'DESC');
      if (typeof perPage === 'number' && typeof page === 'number') {
        const offset = page * perPage;
        builder.limit(perPage);
        builder.offset(offset);
      }

      const { sql, params } = builder.build();

      let total = 0;

      if (perPage !== undefined && page !== undefined) {
        const { sql: countSql, params: countParams } = countBuilder.build();
        const countResult = await this.#db.executeQuery({
          sql: countSql,
          params: countParams,
          first: true,
        });
        total = Number((countResult as Record<string, any>)?.count ?? 0);
      }

      const results = await this.#db.executeQuery({ sql, params });
      const runs = (isArrayOfRecords(results) ? results : []).map((row: any) => this.parseWorkflowRun(row));
      return { runs, total: total || runs.length };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_D1', 'LIST_WORKFLOW_RUNS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to retrieve workflow runs: ${error instanceof Error ? error.message : String(error)}`,
          details: {
            workflowName: workflowName ?? '',
            resourceId: resourceId ?? '',
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
    const fullTableName = this.#db.getTableName(TABLE_WORKFLOW_SNAPSHOT);
    try {
      const conditions: string[] = [];
      const params: SqlParam[] = [];
      if (runId) {
        conditions.push('run_id = ?');
        params.push(runId);
      }
      if (workflowName) {
        conditions.push('workflow_name = ?');
        params.push(workflowName);
      }
      const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
      const sql = `SELECT * FROM ${fullTableName} ${whereClause} ORDER BY createdAt DESC LIMIT 1`;
      const result = await this.#db.executeQuery({ sql, params, first: true });
      if (!result) return null;
      return this.parseWorkflowRun(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_D1', 'GET_WORKFLOW_RUN_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to retrieve workflow run by ID: ${error instanceof Error ? error.message : String(error)}`,
          details: { runId, workflowName: workflowName ?? '' },
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
    const fullTableName = this.#db.getTableName(TABLE_WORKFLOW_SNAPSHOT);
    const check = this.#runFenceCheck(fence, runId, 'deleteWorkflowRunById');
    try {
      const query = createSqlBuilder()
        .delete(fullTableName)
        .where('workflow_name = ?', workflowName)
        .andWhere('run_id = ?', runId);
      const guard = runFenceGuard(check);
      if (guard) query.andWhere(guard.sql, ...guard.params);
      await executeFenced(this.#db, check, query.build());
    } catch (error) {
      if (isRunFenceConflictError(error)) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_D1', 'DELETE_WORKFLOW_RUN_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to delete workflow run by ID: ${error instanceof Error ? error.message : String(error)}`,
          details: { runId, workflowName },
        },
        error,
      );
    }
  }
}
