import type { Database } from '@google-cloud/spanner';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  WorkflowsStorage,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_SCHEMAS,
  normalizePerPage,
  mergeWorkflowState,
  mergeWorkflowStepResult,
} from '@mastra/core/storage';
import type {
  StorageListWorkflowRunsInput,
  WorkflowRun,
  WorkflowRuns,
  UpdateWorkflowStateOptions,
  CreateIndexOptions,
} from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import { SpannerDB, resolveSpannerConfig } from '../../db';
import type { SpannerDomainConfig } from '../../db';
import { quoteIdent } from '../../db/utils';
import { transformFromSpannerRow } from '../utils';

/**
 * Spanner-backed storage for workflow run snapshots, including persistence,
 * incremental updates, and listing of historical runs.
 */
export class WorkflowsSpanner extends WorkflowsStorage {
  private database: Database;
  private db: SpannerDB;
  private readonly skipDefaultIndexes?: boolean;
  private readonly indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_WORKFLOW_SNAPSHOT] as const;

  constructor(config: SpannerDomainConfig) {
    super();
    const { database, indexes, skipDefaultIndexes, initMode } = resolveSpannerConfig(config);
    this.database = database;
    this.db = new SpannerDB({ database, skipDefaultIndexes, initMode });
    this.skipDefaultIndexes = skipDefaultIndexes;
    this.indexes = indexes?.filter(idx => (WorkflowsSpanner.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  /** Spanner serialises read-write transactions, so concurrent updates are safe. */
  supportsConcurrentUpdates(): boolean {
    return true;
  }

  /** Returns the default index set this domain creates during `init()`. */
  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    // Indexes here cover the access patterns of listWorkflowRuns and
    // getWorkflowRunById. Note: secondary indexes whose leading column is a
    // monotonically-increasing timestamp (createdAt) can hot-spot under
    // high write throughput in Spanner, operators expecting heavy churn
    // can opt out via `skipDefaultIndexes` and supply hashed alternatives.
    return [
      {
        // listWorkflowRuns({ workflowName, ... }) ORDER BY createdAt DESC
        name: 'mastra_workflow_snapshot_workflowname_createdat_idx',
        table: TABLE_WORKFLOW_SNAPSHOT,
        columns: ['workflow_name', 'createdAt DESC', 'run_id DESC'],
      },
      {
        // listWorkflowRuns() global path ORDER BY createdAt DESC, run_id DESC
        name: 'mastra_workflow_snapshot_createdat_runid_idx',
        table: TABLE_WORKFLOW_SNAPSHOT,
        columns: ['createdAt DESC', 'run_id DESC'],
      },
      {
        // getWorkflowRunById({ runId }) without workflowName  the PK leads
        // with workflow_name so a runId-only lookup needs its own path.
        name: 'mastra_workflow_snapshot_runid_idx',
        table: TABLE_WORKFLOW_SNAPSHOT,
        columns: ['run_id'],
      },
      {
        // listWorkflowRuns({ resourceId, ... }) ORDER BY createdAt DESC
        name: 'mastra_workflow_snapshot_resourceid_createdat_idx',
        table: TABLE_WORKFLOW_SNAPSHOT,
        columns: ['resourceId', 'createdAt DESC', 'run_id DESC'],
      },
      {
        // listWorkflowRuns({ status, ... })  filters on the STORED generated
        // column added by ensureStatusColumn(). If the column wasn't created
        // (legacy databases), createIndex will fail and listWorkflowRuns
        // falls back to the JSON_VALUE expression.
        name: 'mastra_workflow_snapshot_snapshotstatus_createdat_idx',
        table: TABLE_WORKFLOW_SNAPSHOT,
        columns: ['snapshotStatus', 'createdAt DESC', 'run_id DESC'],
      },
    ];
  }

  /**
   * Creates the default indexes; no-op when `skipDefaultIndexes` was set.
   * Filters out the snapshotStatus index when that generated column is absent
   * (e.g. ensureStatusColumn() failed, or `initMode: 'validate'` skipped the
   * DDL). Otherwise the createIndex call would fail on a missing column.
   */
  async createDefaultIndexes(): Promise<void> {
    if (this.skipDefaultIndexes) return;
    const hasStatus = await this.hasStatusColumn();
    const indexes = this.getDefaultIndexDefinitions().filter(
      idx => hasStatus || !idx.columns.some(c => c.startsWith('snapshotStatus')),
    );
    await this.db.createIndexes(indexes);
  }

  /** Creates the workflow snapshot table, the snapshotStatus generated column, and indexes. */
  async init(): Promise<void> {
    await this.db.createTable({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT],
    });
    // Add the snapshotStatus generated column BEFORE indexes so the index on
    // it can be created in the same init pass.
    await this.ensureStatusColumn();
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  /**
   * Spanner-specific optimization: add a STORED generated column that extracts
   * `status` from the JSON snapshot, so the listWorkflowRuns status filter can
   * use a regular secondary index instead of a full JSON_VALUE scan.
   *
   * The column is owned and maintained entirely by the Spanner adapter; the
   * shared `@mastra/core` schema doesn't reference it. The DDL is idempotent
   * (`ADD COLUMN IF NOT EXISTS`) and the schema operation is awaited; Spanner
   * backfills existing rows asynchronously after the operation returns, while
   * new rows pick up the value on every write.
   */
  private async ensureStatusColumn(): Promise<void> {
    // In validate mode the schema is owned externally, so we never issue DDL.
    // hasStatusColumn() / listWorkflowRuns will pick up whether the column is
    // present at runtime via INFORMATION_SCHEMA and route accordingly.
    if (this.db.initMode === 'validate') return;
    try {
      const ddl =
        `ALTER TABLE ${quoteIdent(TABLE_WORKFLOW_SNAPSHOT, 'table name')} ` +
        `ADD COLUMN IF NOT EXISTS ${quoteIdent('snapshotStatus', 'column name')} ` +
        `STRING(MAX) AS (JSON_VALUE(${quoteIdent('snapshot', 'column name')}, '$.status')) STORED`;
      const [operation] = await this.database.updateSchema([ddl]);
      await operation.promise();
      this.statusColumnAvailable = true;
    } catch (error) {
      this.logger?.warn?.(
        'Failed to add snapshotStatus generated column; status filtering will fall back to JSON_VALUE scan',
        error,
      );
    }
  }

  /**
   * Cached lookup for whether the `snapshotStatus` generated column exists.
   * Resolves true after `ensureStatusColumn()` succeeds, otherwise falls back
   * to an INFORMATION_SCHEMA probe (lets us still pick up the fast path on
   * databases that already had the column from a prior deploy).
   */
  private statusColumnAvailable: boolean | null = null;
  /** Returns true when the `snapshotStatus` generated column exists. */
  private async hasStatusColumn(): Promise<boolean> {
    if (this.statusColumnAvailable !== null) return this.statusColumnAvailable;
    try {
      this.statusColumnAvailable = await this.db.hasColumn(TABLE_WORKFLOW_SNAPSHOT, 'snapshotStatus');
    } catch {
      this.statusColumnAvailable = false;
    }
    return this.statusColumnAvailable;
  }

  /** Creates custom indexes routed to this domain's tables; no-op when none supplied. */
  async createCustomIndexes(): Promise<void> {
    if (!this.indexes || this.indexes.length === 0) return;
    await this.db.createIndexes(this.indexes);
  }

  /** Removes every workflow snapshot row. Intended for tests. */
  async dangerouslyClearAll(): Promise<void> {
    await this.db.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
  }

  /** Decodes a raw Spanner snapshot row into the public `WorkflowRun` shape. */
  private parseWorkflowRun(row: Record<string, any>): WorkflowRun {
    const transformed = transformFromSpannerRow<Record<string, any>>({ tableName: TABLE_WORKFLOW_SNAPSHOT, row });
    let snapshot: WorkflowRunState | string = transformed.snapshot;
    if (typeof snapshot === 'string') {
      try {
        snapshot = JSON.parse(snapshot) as WorkflowRunState;
      } catch (e) {
        this.logger?.warn?.(`Failed to parse snapshot for workflow ${transformed.workflow_name}:`, e);
      }
    }
    return {
      workflowName: transformed.workflow_name,
      runId: transformed.run_id,
      snapshot,
      createdAt: transformed.createdAt,
      updatedAt: transformed.updatedAt,
      resourceId: transformed.resourceId,
    };
  }

  /** Upserts a workflow run snapshot, preserving the original `createdAt` on update. */
  async persistWorkflowSnapshot({
    workflowName,
    runId,
    resourceId,
    snapshot,
    createdAt,
    updatedAt,
  }: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
    createdAt?: Date;
    updatedAt?: Date;
  }): Promise<void> {
    const now = new Date();
    const table = quoteIdent(TABLE_WORKFLOW_SNAPSHOT, 'table name');
    try {
      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            // Read resourceId alongside createdAt so we can preserve the
            // existing association when the caller omits resourceId on update
            // (Spanner's INSERT OR UPDATE would otherwise null it out).
            const [rows] = await tx.run({
              sql: `SELECT ${quoteIdent('createdAt', 'column name')}, ${quoteIdent('resourceId', 'column name')} FROM ${table}
                    WHERE workflow_name = @workflow_name AND run_id = @run_id`,
              params: { workflow_name: workflowName, run_id: runId },
              json: true,
            });
            const existing = (rows as Array<Record<string, any>>)[0];
            const resolvedCreatedAt = existing?.createdAt
              ? new Date(existing.createdAt instanceof Date ? existing.createdAt.getTime() : existing.createdAt)
              : (createdAt ?? now);
            const resolvedResourceId = resourceId !== undefined ? resourceId : (existing?.resourceId ?? null);
            await this.db.upsert({
              tableName: TABLE_WORKFLOW_SNAPSHOT,
              record: {
                workflow_name: workflowName,
                run_id: runId,
                resourceId: resolvedResourceId,
                snapshot,
                createdAt: resolvedCreatedAt,
                updatedAt: updatedAt ?? now,
              },
              transaction: tx,
            });
            await tx.commit();
          } catch (err) {
            await tx.rollback().catch(() => {});
            throw err;
          }
        }),
      );
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'PERSIST_WORKFLOW_SNAPSHOT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName, runId },
        },
        error,
      );
    }
  }

  /** Loads the snapshot payload for a `(workflowName, runId)` pair, or `null` when absent. */
  async loadWorkflowSnapshot({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    try {
      const result = await this.db.load<{ snapshot: WorkflowRunState | string }>({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        keys: { workflow_name: workflowName, run_id: runId },
      });
      if (!result) return null;
      return result.snapshot as WorkflowRunState;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LOAD_WORKFLOW_SNAPSHOT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName, runId },
        },
        error,
      );
    }
  }

  /** Merges a step result and request-context delta into a snapshot inside an RW transaction. */
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
    const table = quoteIdent(TABLE_WORKFLOW_SNAPSHOT, 'table name');
    try {
      let mergedContext: Record<string, StepResult<any, any, any, any>> = {};
      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            // Reading the snapshot row inside a read-write transaction takes a lock on
            // it, protecting against concurrent writers without explicit locking syntax.
            // We also fetch createdAt so the upsert can preserve it on the update path
            // (Spanner's INSERT OR UPDATE replaces every column listed).
            const [rows] = await tx.run({
              sql: `SELECT snapshot, ${quoteIdent('createdAt', 'column name')} FROM ${table}
                    WHERE workflow_name = @workflow_name AND run_id = @run_id`,
              params: { workflow_name: workflowName, run_id: runId },
              json: true,
            });
            let snapshot: WorkflowRunState;
            const existing = (rows as Array<Record<string, any>>)[0];
            if (!existing) {
              snapshot = {
                context: {},
                activePaths: [],
                activeStepsPath: {},
                timestamp: Date.now(),
                suspendedPaths: {},
                resumeLabels: {},
                serializedStepGraph: [],
                status: 'pending',
                value: {},
                waitingPaths: {},
                runId,
                requestContext: {},
              } as WorkflowRunState;
            } else {
              const raw = existing.snapshot;
              snapshot = (typeof raw === 'string' ? JSON.parse(raw) : raw) as WorkflowRunState;
            }
            const context = mergeWorkflowStepResult({ snapshot, stepId, result, requestContext });
            const now = new Date();
            const resolvedCreatedAt = existing?.createdAt
              ? new Date(existing.createdAt instanceof Date ? existing.createdAt.getTime() : existing.createdAt)
              : now;
            await this.db.upsert({
              tableName: TABLE_WORKFLOW_SNAPSHOT,
              record: {
                workflow_name: workflowName,
                run_id: runId,
                snapshot,
                createdAt: resolvedCreatedAt,
                updatedAt: now,
              },
              transaction: tx,
            });
            mergedContext = context;
            await tx.commit();
          } catch (err) {
            await tx.rollback().catch(() => {});
            throw err;
          }
        }),
      );
      return mergedContext;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'UPDATE_WORKFLOW_RESULTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName, runId, stepId },
        },
        error,
      );
    }
  }

  /** Applies a top-level snapshot patch (e.g. status, value) inside an RW transaction. */
  async updateWorkflowState({
    workflowName,
    runId,
    opts,
  }: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
  }): Promise<WorkflowRunState | undefined> {
    const table = quoteIdent(TABLE_WORKFLOW_SNAPSHOT, 'table name');
    try {
      let updated: WorkflowRunState | undefined;
      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            const [rows] = await tx.run({
              sql: `SELECT snapshot FROM ${table} WHERE workflow_name = @workflow_name AND run_id = @run_id`,
              params: { workflow_name: workflowName, run_id: runId },
              json: true,
            });
            const existing = (rows as Array<Record<string, any>>)[0];
            if (!existing) {
              await tx.commit();
              return;
            }
            const raw = existing.snapshot;
            const snapshot = (typeof raw === 'string' ? JSON.parse(raw) : raw) as WorkflowRunState;
            if (!snapshot || !snapshot.context) {
              await tx.commit();
              throw new MastraError(
                {
                  id: createStorageErrorId('SPANNER', 'UPDATE_WORKFLOW_STATE', 'SNAPSHOT_NOT_FOUND'),
                  domain: ErrorDomain.STORAGE,
                  category: ErrorCategory.SYSTEM,
                  details: { workflowName, runId },
                },
                new Error(`Snapshot not found for runId ${runId}`),
              );
            }
            updated = mergeWorkflowState({ snapshot, opts });
            await this.db.update({
              tableName: TABLE_WORKFLOW_SNAPSHOT,
              keys: { workflow_name: workflowName, run_id: runId },
              data: { snapshot: updated, updatedAt: new Date() },
              transaction: tx,
            });
            await tx.commit();
          } catch (err) {
            await tx.rollback().catch(() => {});
            throw err;
          }
        }),
      );
      return updated;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'UPDATE_WORKFLOW_STATE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName, runId },
        },
        error,
      );
    }
  }

  /** Fetches a single workflow run by `runId` (optionally narrowed by `workflowName`). */
  async getWorkflowRunById({
    runId,
    workflowName,
  }: {
    runId: string;
    workflowName?: string;
  }): Promise<WorkflowRun | null> {
    if (!runId || runId.trim() === '') {
      throw new MastraError({
        id: createStorageErrorId('SPANNER', 'GET_WORKFLOW_RUN_BY_ID', 'EMPTY_RUN_ID'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'getWorkflowRunById requires a non-empty runId',
        details: { workflowName: workflowName || '' },
      });
    }
    try {
      const conditions: string[] = [`${quoteIdent('run_id', 'column name')} = @runId`];
      const params: Record<string, any> = { runId };
      if (workflowName) {
        conditions.push(`${quoteIdent('workflow_name', 'column name')} = @workflowName`);
        params.workflowName = workflowName;
      }
      const whereSql = `WHERE ${conditions.join(' AND ')}`;
      const sql = `SELECT * FROM ${quoteIdent(TABLE_WORKFLOW_SNAPSHOT, 'table name')} ${whereSql} LIMIT 1`;
      const [rows] = await this.database.run({ sql, params, json: true });
      const row = (rows as Array<Record<string, any>>)[0];
      if (!row) return null;
      return this.parseWorkflowRun(row);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_WORKFLOW_RUN_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { runId, workflowName: workflowName || '' },
        },
        error,
      );
    }
  }

  /** Deletes the snapshot row for a `(workflowName, runId)` pair. */
  async deleteWorkflowRunById({ runId, workflowName }: { runId: string; workflowName: string }): Promise<void> {
    const table = quoteIdent(TABLE_WORKFLOW_SNAPSHOT, 'table name');
    try {
      await this.db.runDml({
        sql: `DELETE FROM ${table} WHERE workflow_name = @workflow_name AND run_id = @run_id`,
        params: { workflow_name: workflowName, run_id: runId },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'DELETE_WORKFLOW_RUN_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { runId, workflowName },
        },
        error,
      );
    }
  }

  /** Paginated listing with optional workflowName, status, resourceId, and date-range filters. */
  async listWorkflowRuns({
    workflowName,
    fromDate,
    toDate,
    page,
    perPage,
    resourceId,
    status,
  }: StorageListWorkflowRunsInput = {}): Promise<WorkflowRuns> {
    try {
      const conditions: string[] = [];
      const params: Record<string, any> = {};
      // Spanner needs an explicit `timestamp` type hint when the param is an
      // ISO string (the client otherwise infers `string`, which fails the
      // STRING -> TIMESTAMP coercion in the predicate). Mirrors the rule in
      // SpannerDB.aggregateParams / prepareWhereClause.
      const types: Record<string, any> = {};

      if (workflowName) {
        conditions.push(`${quoteIdent('workflow_name', 'column name')} = @workflowName`);
        params.workflowName = workflowName;
      }
      if (status) {
        // Status lives inside the snapshot JSON payload (the @mastra/core
        // schema has no top-level status column). To avoid a full JSON_VALUE
        // scan we maintain a STORED generated column `snapshotStatus` and an
        // index on it (see ensureStatusColumn / getDefaultIndexDefinitions).
        // Older databases that pre-date the migration fall back to the
        // expression predicate.
        if (await this.hasStatusColumn()) {
          conditions.push(`${quoteIdent('snapshotStatus', 'column name')} = @status`);
        } else {
          conditions.push(`JSON_VALUE(${quoteIdent('snapshot', 'column name')}, '$.status') = @status`);
        }
        params.status = status;
      }
      if (resourceId) {
        // resourceId is part of the current TABLE_WORKFLOW_SNAPSHOT schema,
        // so it's always present on a database initialised by this adapter.
        // No backward-compat probe needed (validate mode catches a missing
        // column at init() time before any query runs).
        conditions.push(`${quoteIdent('resourceId', 'column name')} = @resourceId`);
        params.resourceId = resourceId;
      }
      if (fromDate instanceof Date && !isNaN(fromDate.getTime())) {
        conditions.push(`${quoteIdent('createdAt', 'column name')} >= @fromDate`);
        params.fromDate = fromDate.toISOString();
        types.fromDate = 'timestamp';
      }
      if (toDate instanceof Date && !isNaN(toDate.getTime())) {
        conditions.push(`${quoteIdent('createdAt', 'column name')} <= @toDate`);
        params.toDate = toDate.toISOString();
        types.toDate = 'timestamp';
      }

      const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const tableName = quoteIdent(TABLE_WORKFLOW_SNAPSHOT, 'table name');
      const usePagination = typeof perPage === 'number' && typeof page === 'number';

      let total = 0;
      if (usePagination) {
        const [countRows] = await this.database.run({
          sql: `SELECT COUNT(*) AS count FROM ${tableName} ${whereSql}`,
          params,
          types,
          json: true,
        });
        total = Number((countRows as Array<{ count: number | string }>)[0]?.count ?? 0);
      }

      let sql = `SELECT * FROM ${tableName} ${whereSql} ORDER BY ${quoteIdent('createdAt', 'column name')} DESC, ${quoteIdent('run_id', 'column name')} DESC`;
      if (usePagination) {
        const normalized = normalizePerPage(perPage, Number.MAX_SAFE_INTEGER);
        const offset = page! * normalized;
        sql += ` LIMIT @perPage OFFSET @offset`;
        params.perPage = normalized;
        params.offset = offset;
      }
      const [rows] = await this.database.run({ sql, params, types, json: true });
      const runs = (rows as Array<Record<string, any>>).map(r => this.parseWorkflowRun(r));
      return { runs, total: total || runs.length };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LIST_WORKFLOW_RUNS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName: workflowName || 'all' },
        },
        error,
      );
    }
  }
}
