import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  WorkflowsStorage,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_SCHEMAS,
  normalizePerPage,
} from '@mastra/core/storage';
import type {
  StorageListWorkflowRunsInput,
  WorkflowRun,
  WorkflowRuns,
  UpdateWorkflowStateOptions,
  CreateIndexOptions,
} from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import sql from 'mssql';
import { MssqlDB, resolveMssqlConfig } from '../../db';
import type { MssqlDomainConfig } from '../../db';
import { getSchemaName, getTableName } from '../utils';

export class WorkflowsMSSQL extends WorkflowsStorage {
  public pool: sql.ConnectionPool;
  private db: MssqlDB;
  private schema?: string;
  private needsConnect: boolean;
  private skipDefaultIndexes?: boolean;
  private indexes?: CreateIndexOptions[];

  /** Tables managed by this domain */
  static readonly MANAGED_TABLES = [TABLE_WORKFLOW_SNAPSHOT] as const;

  constructor(config: MssqlDomainConfig) {
    super();
    const { pool, schemaName, skipDefaultIndexes, indexes, needsConnect } = resolveMssqlConfig(config);
    this.pool = pool;
    this.schema = schemaName;
    this.db = new MssqlDB({ pool, schemaName, skipDefaultIndexes });
    this.needsConnect = needsConnect;
    this.skipDefaultIndexes = skipDefaultIndexes;
    // Filter indexes to only those for tables managed by this domain
    this.indexes = indexes?.filter(idx => (WorkflowsMSSQL.MANAGED_TABLES as readonly string[]).includes(idx.table));
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
    if (this.skipDefaultIndexes) {
      return;
    }
    // No default indexes for workflows domain
  }

  async init(): Promise<void> {
    if (this.needsConnect) {
      await this.pool.connect();
      this.needsConnect = false;
    }
    await this.db.createTable({ tableName: TABLE_WORKFLOW_SNAPSHOT, schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT] });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  /**
   * Creates custom user-defined indexes for this domain's tables.
   */
  async createCustomIndexes(): Promise<void> {
    if (!this.indexes || this.indexes.length === 0) {
      return;
    }

    for (const indexDef of this.indexes) {
      try {
        await this.db.createIndex(indexDef);
      } catch (error) {
        // Log but continue - indexes are performance optimizations
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.db.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
  }

  private parseWorkflowRun(row: any): WorkflowRun {
    let parsedSnapshot: WorkflowRunState | string = row.snapshot as string;
    if (typeof parsedSnapshot === 'string') {
      try {
        parsedSnapshot = JSON.parse(row.snapshot as string) as WorkflowRunState;
      } catch (e) {
        this.logger?.warn?.(`Failed to parse snapshot for workflow ${row.workflow_name}:`, e);
      }
    }
    return {
      workflowName: row.workflow_name,
      runId: row.run_id,
      snapshot: parsedSnapshot,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      resourceId: row.resourceId,
    };
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
    const table = getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.schema) });
    const transaction = this.pool.transaction();

    try {
      await transaction.begin();

      // Load existing snapshot within transaction with exclusive lock to prevent race conditions
      const selectRequest = new sql.Request(transaction);
      selectRequest.input('workflow_name', workflowName);
      selectRequest.input('run_id', runId);

      const existingSnapshotResult = await selectRequest.query(
        `SELECT snapshot FROM ${table} WITH (UPDLOCK, HOLDLOCK) WHERE workflow_name = @workflow_name AND run_id = @run_id`,
      );

      let snapshot: WorkflowRunState;
      if (!existingSnapshotResult.recordset || existingSnapshotResult.recordset.length === 0) {
        // Create new snapshot if none exists
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
          runId: runId,
          requestContext: {},
        } as WorkflowRunState;
      } else {
        // Parse existing snapshot
        const existingSnapshot = existingSnapshotResult.recordset[0].snapshot;
        snapshot = typeof existingSnapshot === 'string' ? JSON.parse(existingSnapshot) : existingSnapshot;
      }

      // Merge the new step result and request context
      snapshot.context[stepId] = result;
      snapshot.requestContext = { ...snapshot.requestContext, ...requestContext };

      // Upsert within the same transaction to handle both insert and update
      const upsertReq = new sql.Request(transaction);
      upsertReq.input('workflow_name', workflowName);
      upsertReq.input('run_id', runId);
      upsertReq.input('snapshot', JSON.stringify(snapshot));
      upsertReq.input('createdAt', sql.DateTime2, new Date());
      upsertReq.input('updatedAt', sql.DateTime2, new Date());

      await upsertReq.query(
        `MERGE ${table} AS target
         USING (SELECT @workflow_name AS workflow_name, @run_id AS run_id) AS src
           ON target.workflow_name = src.workflow_name AND target.run_id = src.run_id
         WHEN MATCHED THEN UPDATE SET snapshot = @snapshot, [updatedAt] = @updatedAt
         WHEN NOT MATCHED THEN INSERT (workflow_name, run_id, snapshot, [createdAt], [updatedAt])
           VALUES (@workflow_name, @run_id, @snapshot, @createdAt, @updatedAt);`,
      );

      await transaction.commit();
      return snapshot.context;
    } catch (error) {
      try {
        await transaction.rollback();
      } catch {
        // Ignore rollback errors
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'UPDATE_WORKFLOW_RESULTS', 'FAILED'),
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
  }: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
  }): Promise<WorkflowRunState | undefined> {
    const table = getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.schema) });
    const transaction = this.pool.transaction();

    try {
      await transaction.begin();

      // Load existing snapshot within transaction with exclusive lock to prevent race conditions
      const selectRequest = new sql.Request(transaction);
      selectRequest.input('workflow_name', workflowName);
      selectRequest.input('run_id', runId);

      const existingSnapshotResult = await selectRequest.query(
        `SELECT snapshot FROM ${table} WITH (UPDLOCK, HOLDLOCK) WHERE workflow_name = @workflow_name AND run_id = @run_id`,
      );

      if (!existingSnapshotResult.recordset || existingSnapshotResult.recordset.length === 0) {
        await transaction.rollback();
        return undefined;
      }

      // Parse existing snapshot
      const existingSnapshot = existingSnapshotResult.recordset[0].snapshot;
      const snapshot = typeof existingSnapshot === 'string' ? JSON.parse(existingSnapshot) : existingSnapshot;

      if (!snapshot || !snapshot?.context) {
        await transaction.rollback();
        throw new MastraError(
          {
            id: createStorageErrorId('MSSQL', 'UPDATE_WORKFLOW_STATE', 'SNAPSHOT_NOT_FOUND'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.SYSTEM,
            details: {
              workflowName,
              runId,
            },
          },
          new Error(`Snapshot not found for runId ${runId}`),
        );
      }

      // Merge the new options with the existing snapshot
      const updatedSnapshot = { ...snapshot, ...opts };

      // Update the snapshot within the same transaction
      const updateRequest = new sql.Request(transaction);
      updateRequest.input('snapshot', JSON.stringify(updatedSnapshot));
      updateRequest.input('workflow_name', workflowName);
      updateRequest.input('run_id', runId);
      updateRequest.input('updatedAt', sql.DateTime2, new Date());

      await updateRequest.query(
        `UPDATE ${table} SET snapshot = @snapshot, [updatedAt] = @updatedAt WHERE workflow_name = @workflow_name AND run_id = @run_id`,
      );

      await transaction.commit();
      return updatedSnapshot;
    } catch (error) {
      try {
        await transaction.rollback();
      } catch {
        // Ignore rollback errors
      }
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'UPDATE_WORKFLOW_STATE', 'FAILED'),
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
  }: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
  }): Promise<void> {
    const table = getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.schema) });
    const now = new Date().toISOString();
    try {
      const request = this.pool.request();
      request.input('workflow_name', workflowName);
      request.input('run_id', runId);
      request.input('resourceId', resourceId);
      request.input('snapshot', JSON.stringify(snapshot));
      request.input('createdAt', sql.DateTime2, new Date(now));
      request.input('updatedAt', sql.DateTime2, new Date(now));
      const mergeSql = `MERGE INTO ${table} AS target
        USING (SELECT @workflow_name AS workflow_name, @run_id AS run_id) AS src
        ON target.workflow_name = src.workflow_name AND target.run_id = src.run_id
        WHEN MATCHED THEN UPDATE SET
          resourceId = @resourceId,
          snapshot = @snapshot,
          [updatedAt] = @updatedAt
        WHEN NOT MATCHED THEN INSERT (workflow_name, run_id, resourceId, snapshot, [createdAt], [updatedAt])
          VALUES (@workflow_name, @run_id, @resourceId, @snapshot, @createdAt, @updatedAt);`;
      await request.query(mergeSql);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'PERSIST_WORKFLOW_SNAPSHOT', 'FAILED'),
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

  async loadWorkflowSnapshot({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    try {
      const result = await this.db.load({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        keys: {
          workflow_name: workflowName,
          run_id: runId,
        },
      });
      if (!result) {
        return null;
      }
      return (result as any).snapshot;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'LOAD_WORKFLOW_SNAPSHOT', 'FAILED'),
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

  async getWorkflowRunById({
    runId,
    workflowName,
  }: {
    runId: string;
    workflowName?: string;
  }): Promise<WorkflowRun | null> {
    try {
      const conditions: string[] = [];
      const paramMap: Record<string, any> = {};

      if (runId) {
        conditions.push(`[run_id] = @runId`);
        paramMap['runId'] = runId;
      }

      if (workflowName) {
        conditions.push(`[workflow_name] = @workflowName`);
        paramMap['workflowName'] = workflowName;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const tableName = getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.schema) });
      const query = `SELECT * FROM ${tableName} ${whereClause}`;
      const request = this.pool.request();
      Object.entries(paramMap).forEach(([key, value]) => request.input(key, value));
      const result = await request.query(query);

      if (!result.recordset || result.recordset.length === 0) {
        return null;
      }

      return this.parseWorkflowRun(result.recordset[0]);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'GET_WORKFLOW_RUN_BY_ID', 'FAILED'),
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

  async deleteWorkflowRunById({ runId, workflowName }: { runId: string; workflowName: string }): Promise<void> {
    const table = getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.schema) });
    const transaction = this.pool.transaction();
    try {
      await transaction.begin();
      const deleteRequest = new sql.Request(transaction);
      deleteRequest.input('workflow_name', workflowName);
      deleteRequest.input('run_id', runId);
      await deleteRequest.query(`DELETE FROM ${table} WHERE workflow_name = @workflow_name AND run_id = @run_id`);
      await transaction.commit();
    } catch (error) {
      try {
        await transaction.rollback();
      } catch {
        // Ignore rollback errors
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'DELETE_WORKFLOW_RUN_BY_ID', 'FAILED'),
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
    page,
    perPage,
    resourceId,
    status,
  }: StorageListWorkflowRunsInput = {}): Promise<WorkflowRuns> {
    try {
      const conditions: string[] = [];
      const paramMap: Record<string, any> = {};

      if (workflowName) {
        conditions.push(`[workflow_name] = @workflowName`);
        paramMap['workflowName'] = workflowName;
      }

      if (status) {
        conditions.push(`JSON_VALUE([snapshot], '$.status') = @status`);
        paramMap['status'] = status;
      }

      if (resourceId) {
        const hasResourceId = await this.db.hasColumn(TABLE_WORKFLOW_SNAPSHOT, 'resourceId');
        if (hasResourceId) {
          conditions.push(`[resourceId] = @resourceId`);
          paramMap['resourceId'] = resourceId;
        } else {
          this.logger?.warn?.(`[${TABLE_WORKFLOW_SNAPSHOT}] resourceId column not found. Skipping resourceId filter.`);
        }
      }

      if (fromDate instanceof Date && !isNaN(fromDate.getTime())) {
        conditions.push(`[createdAt] >= @fromDate`);
        paramMap[`fromDate`] = fromDate.toISOString();
      }

      if (toDate instanceof Date && !isNaN(toDate.getTime())) {
        conditions.push(`[createdAt] <= @toDate`);
        paramMap[`toDate`] = toDate.toISOString();
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      let total = 0;
      const tableName = getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.schema) });
      const request = this.pool.request();
      Object.entries(paramMap).forEach(([key, value]) => {
        if (value instanceof Date) {
          request.input(key, sql.DateTime, value);
        } else {
          request.input(key, value);
        }
      });

      const usePagination = typeof perPage === 'number' && typeof page === 'number';
      if (usePagination) {
        const countQuery = `SELECT COUNT(*) as count FROM ${tableName} ${whereClause}`;
        const countResult = await request.query(countQuery);
        total = Number(countResult.recordset[0]?.count || 0);
      }

      let query = `SELECT * FROM ${tableName} ${whereClause} ORDER BY [seq_id] DESC`;
      if (usePagination) {
        const normalizedPerPage = normalizePerPage(perPage, Number.MAX_SAFE_INTEGER);
        const offset = page! * normalizedPerPage;
        query += ` OFFSET @offset ROWS FETCH NEXT @perPage ROWS ONLY`;
        request.input('perPage', normalizedPerPage);
        request.input('offset', offset);
      }
      const result = await request.query(query);
      const runs = (result.recordset || []).map(row => this.parseWorkflowRun(row));
      return { runs, total: total || runs.length };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'LIST_WORKFLOW_RUNS', 'FAILED'),
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
