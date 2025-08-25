import type { StepResult, WorkflowRun, WorkflowRuns, WorkflowRunState } from '@mastra/core';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { WorkflowsStorage, TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import sql from 'mssql';
import type { StoreOperationsMSSQL } from '../operations';
import { getSchemaName, getTableName } from '../utils';

function parseWorkflowRun(row: any): WorkflowRun {
  let parsedSnapshot: WorkflowRunState | string = row.snapshot as string;
  if (typeof parsedSnapshot === 'string') {
    try {
      parsedSnapshot = JSON.parse(row.snapshot as string) as WorkflowRunState;
    } catch (e) {
      console.warn(`Failed to parse snapshot for workflow ${row.workflow_name}: ${e}`);
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

export class WorkflowsMSSQL extends WorkflowsStorage {
  public pool: sql.ConnectionPool;
  private operations: StoreOperationsMSSQL;
  private schema: string;

  constructor({
    pool,
    operations,
    schema,
  }: {
    pool: sql.ConnectionPool;
    operations: StoreOperationsMSSQL;
    schema: string;
  }) {
    super();
    this.pool = pool;
    this.operations = operations;
    this.schema = schema;
  }

  updateWorkflowResults(
    {
      // workflowName,
      // runId,
      // stepId,
      // result,
      // runtimeContext,
    }: {
      workflowName: string;
      runId: string;
      stepId: string;
      result: StepResult<any, any, any, any>;
      runtimeContext: Record<string, any>;
    },
  ): Promise<Record<string, StepResult<any, any, any, any>>> {
    throw new Error('Method not implemented.');
  }
  updateWorkflowState(
    {
      // workflowName,
      // runId,
      // opts,
    }: {
      workflowName: string;
      runId: string;
      opts: {
        status: string;
        result?: StepResult<any, any, any, any>;
        error?: string;
        suspendedPaths?: Record<string, number[]>;
        waitingPaths?: Record<string, number[]>;
      };
    },
  ): Promise<WorkflowRunState | undefined> {
    throw new Error('Method not implemented.');
  }

  async persistWorkflowSnapshot({
    workflowName,
    runId,
    snapshot,
  }: {
    workflowName: string;
    runId: string;
    snapshot: WorkflowRunState;
  }): Promise<void> {
    const table = getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.schema) });
    const now = new Date().toISOString();
    try {
      const request = this.pool.request();
      request.input('workflow_name', workflowName);
      request.input('run_id', runId);
      request.input('snapshot', JSON.stringify(snapshot));
      request.input('createdAt', sql.DateTime2, new Date(now));
      request.input('updatedAt', sql.DateTime2, new Date(now));
      const mergeSql = `MERGE INTO ${table} AS target
        USING (SELECT @workflow_name AS workflow_name, @run_id AS run_id) AS src
        ON target.workflow_name = src.workflow_name AND target.run_id = src.run_id
        WHEN MATCHED THEN UPDATE SET
          snapshot = @snapshot,
          [updatedAt] = @updatedAt
        WHEN NOT MATCHED THEN INSERT (workflow_name, run_id, snapshot, [createdAt], [updatedAt])
          VALUES (@workflow_name, @run_id, @snapshot, @createdAt, @updatedAt);`;
      await request.query(mergeSql);
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_PERSIST_WORKFLOW_SNAPSHOT_FAILED',
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
      const result = await this.operations.load({
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
          id: 'MASTRA_STORAGE_MSSQL_STORE_LOAD_WORKFLOW_SNAPSHOT_FAILED',
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

      return parseWorkflowRun(result.recordset[0]);
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_GET_WORKFLOW_RUN_BY_ID_FAILED',
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

  async getWorkflowRuns({
    workflowName,
    fromDate,
    toDate,
    limit,
    offset,
    resourceId,
  }: {
    workflowName?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
    resourceId?: string;
  } = {}): Promise<WorkflowRuns> {
    try {
      const conditions: string[] = [];
      const paramMap: Record<string, any> = {};

      if (workflowName) {
        conditions.push(`[workflow_name] = @workflowName`);
        paramMap['workflowName'] = workflowName;
      }

      if (resourceId) {
        const hasResourceId = await this.operations.hasColumn(TABLE_WORKFLOW_SNAPSHOT, 'resourceId');
        if (hasResourceId) {
          conditions.push(`[resourceId] = @resourceId`);
          paramMap['resourceId'] = resourceId;
        } else {
          console.warn(`[${TABLE_WORKFLOW_SNAPSHOT}] resourceId column not found. Skipping resourceId filter.`);
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

      if (limit !== undefined && offset !== undefined) {
        const countQuery = `SELECT COUNT(*) as count FROM ${tableName} ${whereClause}`;
        const countResult = await request.query(countQuery);
        total = Number(countResult.recordset[0]?.count || 0);
      }

      let query = `SELECT * FROM ${tableName} ${whereClause} ORDER BY [seq_id] DESC`;
      if (limit !== undefined && offset !== undefined) {
        query += ` OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;
        request.input('limit', limit);
        request.input('offset', offset);
      }
      const result = await request.query(query);
      const runs = (result.recordset || []).map(row => parseWorkflowRun(row));
      return { runs, total: total || runs.length };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_GET_WORKFLOW_RUNS_FAILED',
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
