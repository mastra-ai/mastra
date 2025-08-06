import type { WorkflowRun, WorkflowRuns, WorkflowRunState } from '@mastra/core';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { WorkflowsStorage, TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import type { IDatabase } from 'pg-promise';
import type { StoreOperationsPG } from '../operations';
import { getTableName } from '../utils';

function parseWorkflowRun(row: Record<string, any>): WorkflowRun {
  let parsedSnapshot: WorkflowRunState | string = row.snapshot as string;
  if (typeof parsedSnapshot === 'string') {
    try {
      parsedSnapshot = JSON.parse(row.snapshot as string) as WorkflowRunState;
    } catch (e) {
      // If parsing fails, return the raw snapshot string
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

export class WorkflowsPG extends WorkflowsStorage {
  public client: IDatabase<{}>;
  private operations: StoreOperationsPG;
  private schema: string;

  constructor({
    client,
    operations,
    schema,
  }: {
    client: IDatabase<{}>;
    operations: StoreOperationsPG;
    schema: string;
  }) {
    super();
    this.client = client;
    this.operations = operations;
    this.schema = schema;
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
    try {
      const now = new Date().toISOString();
      await this.client.none(
        `INSERT INTO ${getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: this.schema })} (workflow_name, run_id, snapshot, "createdAt", "updatedAt")
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (workflow_name, run_id) DO UPDATE
                 SET snapshot = $3, "updatedAt" = $5`,
        [workflowName, runId, JSON.stringify(snapshot), now, now],
      );
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_PERSIST_WORKFLOW_SNAPSHOT_FAILED',
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
      const result = await this.operations.load<{ snapshot: WorkflowRunState }>({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        keys: { workflow_name: workflowName, run_id: runId },
      });

      return result ? result.snapshot : null;
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_LOAD_WORKFLOW_SNAPSHOT_FAILED',
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

      // Get results
      const query = `
          SELECT * FROM ${getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: this.schema })}
          ${whereClause}
        `;

      const queryValues = values;

      const result = await this.client.oneOrNone(query, queryValues);

      if (!result) {
        return null;
      }

      return parseWorkflowRun(result);
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_GET_WORKFLOW_RUN_BY_ID_FAILED',
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
      const values: any[] = [];
      let paramIndex = 1;

      if (workflowName) {
        conditions.push(`workflow_name = $${paramIndex}`);
        values.push(workflowName);
        paramIndex++;
      }

      if (resourceId) {
        const hasResourceId = await this.operations.hasColumn(TABLE_WORKFLOW_SNAPSHOT, 'resourceId');
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
        values.push(fromDate);
        paramIndex++;
      }

      if (toDate) {
        conditions.push(`"createdAt" <= $${paramIndex}`);
        values.push(toDate);
        paramIndex++;
      }
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      let total = 0;
      // Only get total count when using pagination
      if (limit !== undefined && offset !== undefined) {
        const countResult = await this.client.one(
          `SELECT COUNT(*) as count FROM ${getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: this.schema })} ${whereClause}`,
          values,
        );
        total = Number(countResult.count);
      }

      // Get results
      const query = `
          SELECT * FROM ${getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: this.schema })}
          ${whereClause}
          ORDER BY "createdAt" DESC
          ${limit !== undefined && offset !== undefined ? ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}` : ''}
        `;

      const queryValues = limit !== undefined && offset !== undefined ? [...values, limit, offset] : values;

      const result = await this.client.manyOrNone(query, queryValues);

      const runs = (result || []).map(row => {
        return parseWorkflowRun(row);
      });

      // Use runs.length as total when not paginating
      return { runs, total: total || runs.length };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_GET_WORKFLOW_RUNS_FAILED',
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
