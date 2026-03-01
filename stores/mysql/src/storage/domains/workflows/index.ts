import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { TABLE_WORKFLOW_SNAPSHOT, TABLE_SCHEMAS, WorkflowsStorage, normalizePerPage } from '@mastra/core/storage';
import type { StorageListWorkflowRunsInput, UpdateWorkflowStateOptions, WorkflowRun, WorkflowRuns } from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { StoreOperationsMySQL } from '../operations';
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

  constructor({ operations, pool }: { operations: StoreOperationsMySQL; pool: Pool }) {
    super();
    this.operations = operations;
    this.pool = pool;
  }

  supportsConcurrentUpdates(): boolean {
    return true;
  }

  async init(): Promise<void> {
    const schema = TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT];
    await this.operations.createTable({ tableName: TABLE_WORKFLOW_SNAPSHOT, schema });
    await this.operations.alterTable({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      schema,
      ifNotExists: ['resourceId'],
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.pool.execute(`DELETE FROM ${formatTableName(TABLE_WORKFLOW_SNAPSHOT)}`);
  }

  async deleteWorkflowRunById({ runId, workflowName }: { runId: string; workflowName: string }): Promise<void> {
    try {
      await this.pool.execute(
        `DELETE FROM ${formatTableName(TABLE_WORKFLOW_SNAPSHOT)} WHERE ${quoteIdentifier('workflow_name', 'column name')} = ? AND ${quoteIdentifier('run_id', 'column name')} = ?`,
        [workflowName, runId],
      );
    } catch (error) {
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
  }: {
    workflowName: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    requestContext?: Record<string, any>;
  }): Promise<Record<string, StepResult<any, any, any, any>>> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
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
  }: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
  }): Promise<WorkflowRunState | undefined> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT snapshot FROM ${formatTableName(TABLE_WORKFLOW_SNAPSHOT)} WHERE ${quoteIdentifier('workflow_name', 'column name')} = ? AND ${quoteIdentifier('run_id', 'column name')} = ? FOR UPDATE`,
        [workflowName, runId],
      );
      if (!Array.isArray(rows) || rows.length === 0) {
        await connection.rollback();
        return undefined;
      }

      const existing = parseSnapshot(rows[0]!.snapshot) as WorkflowRunState;

      // Merge opts into the snapshot
      const updatedSnapshot = { ...existing, ...opts };

      await connection.execute(
        `UPDATE ${formatTableName(TABLE_WORKFLOW_SNAPSHOT)} SET ${quoteIdentifier('snapshot', 'column name')} = ?, ${quoteIdentifier('updatedAt', 'column name')} = ? WHERE ${quoteIdentifier('workflow_name', 'column name')} = ? AND ${quoteIdentifier('run_id', 'column name')} = ?`,
        [JSON.stringify(updatedSnapshot), transformToSqlValue(new Date()), workflowName, runId],
      );
      await connection.commit();

      return updatedSnapshot;
    } catch (error) {
      await connection.rollback();
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
  }: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
    createdAt?: Date;
    updatedAt?: Date;
  }): Promise<void> {
    const now = new Date();
    const createdAtValue = createdAt ?? now;
    const updatedAtValue = updatedAt ?? now;
    try {
      const tableName = formatTableName(TABLE_WORKFLOW_SNAPSHOT);
      await this.pool.execute(
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
    } catch (error) {
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
      conditions.push(`${quoteIdentifier('snapshot', 'column name')} LIKE ?`);
      params.push(`%"status":"${status}"%`);
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
          sql: workflowName
            ? ' WHERE workflow_name = ? AND run_id = ?'
            : ' WHERE run_id = ?',
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
