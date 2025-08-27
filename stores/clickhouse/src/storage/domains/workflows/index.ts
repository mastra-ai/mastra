import type { ClickHouseClient } from '@clickhouse/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { TABLE_WORKFLOW_SNAPSHOT, WorkflowsStorage } from '@mastra/core/storage';
import type { WorkflowRun, WorkflowRuns } from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import type { StoreOperationsClickhouse } from '../operations';
import { TABLE_ENGINES } from '../utils';

export class WorkflowsStorageClickhouse extends WorkflowsStorage {
  protected client: ClickHouseClient;
  protected operations: StoreOperationsClickhouse;
  constructor({ client, operations }: { client: ClickHouseClient; operations: StoreOperationsClickhouse }) {
    super();
    this.operations = operations;
    this.client = client;
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
    try {
      const currentSnapshot = await this.operations.load({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        keys: { workflow_name: workflowName, run_id: runId },
      });

      const now = new Date();
      const persisting = currentSnapshot
        ? {
            ...currentSnapshot,
            snapshot: JSON.stringify(snapshot),
            updatedAt: now.toISOString(),
          }
        : {
            workflow_name: workflowName,
            run_id: runId,
            snapshot: JSON.stringify(snapshot),
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          };

      await this.client.insert({
        table: TABLE_WORKFLOW_SNAPSHOT,
        format: 'JSONEachRow',
        values: [persisting],
        clickhouse_settings: {
          // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
          date_time_input_format: 'best_effort',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_PERSIST_WORKFLOW_SNAPSHOT_FAILED',
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
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_LOAD_WORKFLOW_SNAPSHOT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
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
        console.warn(`Failed to parse snapshot for workflow ${row.workflow_name}: ${e}`);
      }
    }

    return {
      workflowName: row.workflow_name,
      runId: row.run_id,
      snapshot: parsedSnapshot,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      resourceId: row.resourceId,
    };
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
      const values: Record<string, any> = {};

      if (workflowName) {
        conditions.push(`workflow_name = {var_workflow_name:String}`);
        values.var_workflow_name = workflowName;
      }

      if (resourceId) {
        const hasResourceId = await this.operations.hasColumn(TABLE_WORKFLOW_SNAPSHOT, 'resourceId');
        if (hasResourceId) {
          conditions.push(`resourceId = {var_resourceId:String}`);
          values.var_resourceId = resourceId;
        } else {
          console.warn(`[${TABLE_WORKFLOW_SNAPSHOT}] resourceId column not found. Skipping resourceId filter.`);
        }
      }

      if (fromDate) {
        conditions.push(`createdAt >= {var_from_date:DateTime64(3)}`);
        values.var_from_date = fromDate.getTime() / 1000; // Convert to Unix timestamp
      }

      if (toDate) {
        conditions.push(`createdAt <= {var_to_date:DateTime64(3)}`);
        values.var_to_date = toDate.getTime() / 1000; // Convert to Unix timestamp
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limitClause = limit !== undefined ? `LIMIT ${limit}` : '';
      const offsetClause = offset !== undefined ? `OFFSET ${offset}` : '';

      let total = 0;
      // Only get total count when using pagination
      if (limit !== undefined && offset !== undefined) {
        const countResult = await this.client.query({
          query: `SELECT COUNT(*) as count FROM ${TABLE_WORKFLOW_SNAPSHOT} ${TABLE_ENGINES[TABLE_WORKFLOW_SNAPSHOT].startsWith('ReplacingMergeTree') ? 'FINAL' : ''} ${whereClause}`,
          query_params: values,
          format: 'JSONEachRow',
        });
        const countRows = await countResult.json();
        total = Number((countRows as Array<{ count: string | number }>)[0]?.count ?? 0);
      }

      // Get results
      const result = await this.client.query({
        query: `
              SELECT 
                workflow_name,
                run_id,
                snapshot,
                toDateTime64(createdAt, 3) as createdAt,
                toDateTime64(updatedAt, 3) as updatedAt,
                resourceId
              FROM ${TABLE_WORKFLOW_SNAPSHOT} ${TABLE_ENGINES[TABLE_WORKFLOW_SNAPSHOT].startsWith('ReplacingMergeTree') ? 'FINAL' : ''}
              ${whereClause}
              ORDER BY createdAt DESC
              ${limitClause}
              ${offsetClause}
            `,
        query_params: values,
        format: 'JSONEachRow',
      });

      const resultJson = await result.json();
      const rows = resultJson as any[];
      const runs = rows.map(row => {
        return this.parseWorkflowRun(row);
      });

      // Use runs.length as total when not paginating
      return { runs, total: total || runs.length };
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_GET_WORKFLOW_RUNS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName: workflowName ?? '', resourceId: resourceId ?? '' },
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
      const values: Record<string, any> = {};

      if (runId) {
        conditions.push(`run_id = {var_runId:String}`);
        values.var_runId = runId;
      }

      if (workflowName) {
        conditions.push(`workflow_name = {var_workflow_name:String}`);
        values.var_workflow_name = workflowName;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get results
      const result = await this.client.query({
        query: `
              SELECT 
                workflow_name,
                run_id,
                snapshot,
                toDateTime64(createdAt, 3) as createdAt,
                toDateTime64(updatedAt, 3) as updatedAt,
                resourceId
              FROM ${TABLE_WORKFLOW_SNAPSHOT} ${TABLE_ENGINES[TABLE_WORKFLOW_SNAPSHOT].startsWith('ReplacingMergeTree') ? 'FINAL' : ''}
              ${whereClause}
              ORDER BY createdAt DESC LIMIT 1
            `,
        query_params: values,
        format: 'JSONEachRow',
      });

      const resultJson = await result.json();
      if (!Array.isArray(resultJson) || resultJson.length === 0) {
        return null;
      }
      return this.parseWorkflowRun(resultJson[0]);
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_GET_WORKFLOW_RUN_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { runId: runId ?? '', workflowName: workflowName ?? '' },
        },
        error,
      );
    }
  }
}
