import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { normalizePerPage, TABLE_WORKFLOW_SNAPSHOT, TABLE_SCHEMAS, WorkflowsStorageBase } from '@mastra/core/storage';
import type { WorkflowRun, WorkflowRuns, StorageListWorkflowRunsInput } from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import { ClickhouseDomainBase } from '../base';
import type { ClickhouseDomainConfig } from '../base';
import { TABLE_ENGINES } from '../utils';

export class WorkflowsStorageClickhouse extends WorkflowsStorageBase {
  private domainBase: ClickhouseDomainBase;

  constructor(opts: ClickhouseDomainConfig) {
    super();
    this.domainBase = new ClickhouseDomainBase(opts);
  }

  async init(): Promise<void> {
    await this.domainBase.getOperations().createTable({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT],
    });
    await this.domainBase.getOperations().alterTable({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT],
      ifNotExists: ['resourceId'],
    });
  }

  async close(): Promise<void> {
    await this.domainBase.close();
  }

  async dropData(): Promise<void> {
    await this.domainBase.getOperations().clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
  }

  updateWorkflowResults(
    {
      // workflowId,
      // runId,
      // stepId,
      // result,
      // requestContext,
    }: {
      workflowId: string;
      runId: string;
      stepId: string;
      result: StepResult<any, any, any, any>;
      requestContext: Record<string, any>;
    },
  ): Promise<Record<string, StepResult<any, any, any, any>>> {
    throw new Error('Method not implemented.');
  }
  updateWorkflowState(
    {
      // workflowId,
      // runId,
      // opts,
    }: {
      workflowId: string;
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

  async createWorkflowSnapshot({
    workflowId,
    runId,
    resourceId,
    snapshot,
    createdAt,
    updatedAt,
  }: {
    workflowId: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
    createdAt?: Date;
    updatedAt?: Date;
  }): Promise<void> {
    try {
      const currentSnapshot = await this.domainBase.getOperations().load({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        keys: { workflow_name: workflowId, run_id: runId },
      });

      const now = new Date();
      const persisting = currentSnapshot
        ? {
            ...currentSnapshot,
            resourceId,
            snapshot: JSON.stringify(snapshot),
            updatedAt: updatedAt?.toISOString() || now.toISOString(),
          }
        : {
            workflow_name: workflowId,
            run_id: runId,
            resourceId,
            snapshot: JSON.stringify(snapshot),
            createdAt: createdAt?.toISOString() || now.toISOString(),
            updatedAt: updatedAt?.toISOString() || now.toISOString(),
          };

      await this.domainBase.getClient().insert({
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
          details: { workflowId, runId },
        },
        error,
      );
    }
  }

  async getWorkflowSnapshot({
    workflowId,
    runId,
  }: {
    workflowId: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    try {
      const result = await this.domainBase.getOperations().load({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        keys: {
          workflow_name: workflowId,
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
          details: { workflowId, runId },
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

  async listWorkflowRuns({
    workflowId,
    fromDate,
    toDate,
    page,
    perPage,
    resourceId,
    status,
  }: StorageListWorkflowRunsInput = {}): Promise<WorkflowRuns> {
    try {
      const conditions: string[] = [];
      const values: Record<string, any> = {};

      if (workflowId) {
        conditions.push(`workflow_name = {var_workflow_name:String}`);
        values.var_workflow_name = workflowId;
      }

      if (status) {
        conditions.push(`JSONExtractString(snapshot, 'status') = {var_status:String}`);
        values.var_status = status;
      }

      if (resourceId) {
        const hasResourceId = await this.domainBase.getOperations().hasColumn(TABLE_WORKFLOW_SNAPSHOT, 'resourceId');
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
      const usePagination = perPage !== undefined && page !== undefined;
      const normalizedPerPage = usePagination ? normalizePerPage(perPage, Number.MAX_SAFE_INTEGER) : 0;
      const offset = usePagination ? page * normalizedPerPage : 0;
      const limitClause = usePagination ? `LIMIT ${normalizedPerPage}` : '';
      const offsetClause = usePagination ? `OFFSET ${offset}` : '';

      let total = 0;
      // Only get total count when using pagination
      if (usePagination) {
        const countResult = await this.domainBase.getClient().query({
          query: `SELECT COUNT(*) as count FROM ${TABLE_WORKFLOW_SNAPSHOT} ${TABLE_ENGINES[TABLE_WORKFLOW_SNAPSHOT].startsWith('ReplacingMergeTree') ? 'FINAL' : ''} ${whereClause}`,
          query_params: values,
          format: 'JSONEachRow',
        });
        const countRows = await countResult.json();
        total = Number((countRows as Array<{ count: string | number }>)[0]?.count ?? 0);
      }

      // Get results
      const result = await this.domainBase.getClient().query({
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
          id: 'CLICKHOUSE_STORAGE_LIST_WORKFLOW_RUNS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowId: workflowId ?? '', resourceId: resourceId ?? '' },
        },
        error,
      );
    }
  }

  async getWorkflowRunById({ runId, workflowId }: { runId: string; workflowId?: string }): Promise<WorkflowRun | null> {
    try {
      const conditions: string[] = [];
      const values: Record<string, any> = {};

      if (runId) {
        conditions.push(`run_id = {var_runId:String}`);
        values.var_runId = runId;
      }

      if (workflowId) {
        conditions.push(`workflow_name = {var_workflow_name:String}`);
        values.var_workflow_name = workflowId;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get results
      const result = await this.domainBase.getClient().query({
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
          details: { runId: runId ?? '', workflowId: workflowId ?? '' },
        },
        error,
      );
    }
  }
}
