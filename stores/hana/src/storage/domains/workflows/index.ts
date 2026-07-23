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

import { HANAClient, resolveHanaConfig } from '../../db';
import type { HANADomainConfig } from '../../db';
import { getSchemaName, getTableName } from '../utils';

export class WorkflowsHANA extends WorkflowsStorage {
  private db: HANAClient;
  private schema?: string;
  private needsInit: boolean;
  private skipDefaultIndexes?: boolean;
  private indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_WORKFLOW_SNAPSHOT] as const;

  constructor(config: HANADomainConfig) {
    super();
    const { pool, schemaName, skipDefaultIndexes, indexes, needsInit } = resolveHanaConfig(config);
    this.schema = schemaName;
    this.db = new HANAClient({ pool, schemaName, skipDefaultIndexes });
    this.needsInit = needsInit;
    this.skipDefaultIndexes = skipDefaultIndexes;
    this.indexes = indexes?.filter(idx => (WorkflowsHANA.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  supportsConcurrentUpdates(): boolean {
    return true;
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [];
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.skipDefaultIndexes) return;
    // No default indexes for workflows domain
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.indexes || this.indexes.length === 0) return;
    for (const indexDef of this.indexes) {
      try {
        await this.db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  async init(): Promise<void> {
    if (this.needsInit) {
      await this.db.pool.initialize();
      this.needsInit = false;
    }
    await this.db.createTable({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT],
    });
    this.schema = this.db.schemaName;
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.db.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
  }

  private tableName(): string {
    return getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.schema) });
  }

  private parseWorkflowRun(row: Record<string, unknown>): WorkflowRun {
    let parsedSnapshot: WorkflowRunState | string = row['snapshot'] as string;
    if (typeof parsedSnapshot === 'string') {
      try {
        parsedSnapshot = JSON.parse(row['snapshot'] as string) as WorkflowRunState;
      } catch (e) {
        this.logger?.warn?.(`Failed to parse snapshot for workflow ${row['workflow_name']}:`, e);
      }
    }
    return {
      workflowName: row['workflow_name'] as string,
      runId: row['run_id'] as string,
      snapshot: parsedSnapshot,
      createdAt: row['createdAt'] instanceof Date ? row['createdAt'] : new Date(row['createdAt'] as string),
      updatedAt: row['updatedAt'] instanceof Date ? row['updatedAt'] : new Date(row['updatedAt'] as string),
      resourceId: (row['resourceId'] as string | null | undefined) ?? undefined,
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
    const table = this.tableName();

    try {
      return await this.db.pool.withTransaction(async conn => {
        // Load existing snapshot with exclusive lock
        const rows = (await conn.execPromise(
          `SELECT "snapshot" FROM ${table} WHERE "workflow_name" = ? AND "run_id" = ? FOR UPDATE`,
          [workflowName, runId],
        )) as Array<Record<string, unknown>>;

        let snapshot: WorkflowRunState;
        if (!rows || rows.length === 0) {
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
          const existingSnapshot = rows[0]!['snapshot'];
          snapshot =
            typeof existingSnapshot === 'string'
              ? JSON.parse(existingSnapshot)
              : (existingSnapshot as WorkflowRunState);
        }

        snapshot.context[stepId] = result;
        snapshot.requestContext = { ...snapshot.requestContext, ...requestContext };

        const now = new Date().toISOString();
        await conn.execPromise(
          `MERGE INTO ${table} AS target
           USING (SELECT ? AS workflow_name, ? AS run_id FROM DUMMY) AS src
           ON target."workflow_name" = src.workflow_name AND target."run_id" = src.run_id
           WHEN MATCHED THEN UPDATE SET "snapshot" = ?, "updatedAt" = ?
           WHEN NOT MATCHED THEN INSERT ("workflow_name", "run_id", "snapshot", "createdAt", "updatedAt")
             VALUES (?, ?, ?, ?, ?)`,
          [workflowName, runId, JSON.stringify(snapshot), now, workflowName, runId, JSON.stringify(snapshot), now, now],
        );

        return snapshot.context;
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'UPDATE_WORKFLOW_RESULTS', 'FAILED'),
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
    const table = this.tableName();

    try {
      return await this.db.pool.withTransaction(async conn => {
        const rows = (await conn.execPromise(
          `SELECT "snapshot" FROM ${table} WHERE "workflow_name" = ? AND "run_id" = ? FOR UPDATE`,
          [workflowName, runId],
        )) as Array<Record<string, unknown>>;

        if (!rows || rows.length === 0) {
          return undefined;
        }

        const existingSnapshot = rows[0]!['snapshot'];
        const snapshot: WorkflowRunState =
          typeof existingSnapshot === 'string' ? JSON.parse(existingSnapshot) : (existingSnapshot as WorkflowRunState);

        if (!snapshot || !snapshot?.context) {
          throw new MastraError(
            {
              id: createStorageErrorId('HANA', 'UPDATE_WORKFLOW_STATE', 'SNAPSHOT_NOT_FOUND'),
              domain: ErrorDomain.STORAGE,
              category: ErrorCategory.SYSTEM,
              details: { workflowName, runId },
            },
            new Error(`Snapshot not found for runId ${runId}`),
          );
        }

        const updatedSnapshot = { ...snapshot, ...opts };

        await conn.execPromise(
          `UPDATE ${table} SET "snapshot" = ?, "updatedAt" = ? WHERE "workflow_name" = ? AND "run_id" = ?`,
          [JSON.stringify(updatedSnapshot), new Date().toISOString(), workflowName, runId],
        );

        return updatedSnapshot;
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'UPDATE_WORKFLOW_STATE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName, runId },
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
  }: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
    createdAt?: Date;
    updatedAt?: Date;
  }): Promise<void> {
    const table = this.tableName();
    const now = new Date().toISOString();
    const createdAtVal = createdAt instanceof Date ? createdAt.toISOString() : now;
    const updatedAtVal = updatedAt instanceof Date ? updatedAt.toISOString() : now;

    try {
      await this.db.pool.withConnection(conn =>
        conn.execPromise(
          `MERGE INTO ${table} AS target
           USING (SELECT ? AS workflow_name, ? AS run_id FROM DUMMY) AS src
           ON target."workflow_name" = src.workflow_name AND target."run_id" = src.run_id
           WHEN MATCHED THEN UPDATE SET
             "resourceId" = ?,
             "snapshot" = ?,
             "updatedAt" = ?
           WHEN NOT MATCHED THEN INSERT ("workflow_name", "run_id", "resourceId", "snapshot", "createdAt", "updatedAt")
             VALUES (?, ?, ?, ?, ?, ?)`,
          [
            workflowName,
            runId,
            resourceId ?? null,
            JSON.stringify(snapshot),
            updatedAtVal,
            workflowName,
            runId,
            resourceId ?? null,
            JSON.stringify(snapshot),
            createdAtVal,
            updatedAtVal,
          ],
        ),
      );
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'PERSIST_WORKFLOW_SNAPSHOT', 'FAILED'),
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
      const result = await this.db.load({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        keys: {
          workflow_name: workflowName,
          run_id: runId,
        },
      });
      if (!result) return null;
      return (result as any).snapshot;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'LOAD_WORKFLOW_SNAPSHOT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName, runId },
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
      const params: unknown[] = [];

      if (runId) {
        conditions.push(`"run_id" = ?`);
        params.push(runId);
      }
      if (workflowName) {
        conditions.push(`"workflow_name" = ?`);
        params.push(workflowName);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const rows = (await this.db.pool.withConnection(conn =>
        conn.execPromise(`SELECT * FROM ${this.tableName()} ${whereClause}`, params),
      )) as Array<Record<string, unknown>>;

      if (!rows || rows.length === 0) return null;
      return this.parseWorkflowRun(rows[0]!);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'GET_WORKFLOW_RUN_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { runId, workflowName: workflowName || '' },
        },
        error,
      );
    }
  }

  async deleteWorkflowRunById({ runId, workflowName }: { runId: string; workflowName: string }): Promise<void> {
    try {
      await this.db.pool.withTransaction(conn =>
        conn.execPromise(`DELETE FROM ${this.tableName()} WHERE "workflow_name" = ? AND "run_id" = ?`, [
          workflowName,
          runId,
        ]),
      );
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'DELETE_WORKFLOW_RUN_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { runId, workflowName },
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
      const params: unknown[] = [];

      if (workflowName) {
        conditions.push(`"workflow_name" = ?`);
        params.push(workflowName);
      }

      if (status) {
        conditions.push(`JSON_VALUE("snapshot", '$.status') = ?`);
        params.push(status);
      }

      if (resourceId) {
        const hasResourceId = await this.db.hasColumn(TABLE_WORKFLOW_SNAPSHOT, 'resourceId');
        if (hasResourceId) {
          conditions.push(`"resourceId" = ?`);
          params.push(resourceId);
        } else {
          this.logger?.warn?.(`[${TABLE_WORKFLOW_SNAPSHOT}] resourceId column not found. Skipping resourceId filter.`);
        }
      }

      if (fromDate instanceof Date && !isNaN(fromDate.getTime())) {
        conditions.push(`"createdAt" >= ?`);
        params.push(fromDate.toISOString());
      }

      if (toDate instanceof Date && !isNaN(toDate.getTime())) {
        conditions.push(`"createdAt" <= ?`);
        params.push(toDate.toISOString());
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const tableName = this.tableName();
      const usePagination = typeof perPage === 'number' && typeof page === 'number';

      let total = 0;
      if (usePagination) {
        const countRows = (await this.db.pool.withConnection(conn =>
          conn.execPromise(`SELECT COUNT(*) AS CNT FROM ${tableName} ${whereClause}`, [...params]),
        )) as Array<{ CNT: number }>;
        total = Number(countRows[0]?.CNT ?? 0);
      }

      let sql = `SELECT * FROM ${tableName} ${whereClause} ORDER BY "seq_id" DESC`;
      const listParams = [...params];

      if (usePagination) {
        const normalizedPerPage = normalizePerPage(perPage, Number.MAX_SAFE_INTEGER);
        const offset = page! * normalizedPerPage;
        sql += ` LIMIT ? OFFSET ?`;
        listParams.push(normalizedPerPage, offset);
      }

      const rows = (await this.db.pool.withConnection(conn => conn.execPromise(sql, listParams))) as Array<
        Record<string, unknown>
      >;

      const runs = (rows || []).map(row => this.parseWorkflowRun(row));
      return { runs, total: total || runs.length };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'LIST_WORKFLOW_RUNS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName: workflowName || 'all' },
        },
        error,
      );
    }
  }
}
