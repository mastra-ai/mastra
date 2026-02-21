import type { ClickHouseClient } from '@clickhouse/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  normalizePerPage,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_SCHEMAS,
  WorkflowsStorage,
} from '@mastra/core/storage';
import type {
  WorkflowRun,
  WorkflowRuns,
  StorageListWorkflowRunsInput,
  UpdateWorkflowStateOptions,
} from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import { ClickhouseDB, resolveClickhouseConfig } from '../../db';
import type { ClickhouseDomainConfig } from '../../db';
import { TABLE_ENGINES } from '../../db/utils';

export class WorkflowsStorageClickhouse extends WorkflowsStorage {
  protected client: ClickHouseClient;
  #db: ClickhouseDB;
  constructor(config: ClickhouseDomainConfig) {
    super();
    const { client, ttl } = resolveClickhouseConfig(config);
    this.client = client;
    this.#db = new ClickhouseDB({ client, ttl });
  }

  supportsConcurrentUpdates(): boolean {
    // ClickHouse is an OLAP database using ReplacingMergeTree for deduplication
    // It doesn't support atomic read-modify-write operations needed for concurrent updates
    return false;
  }

  async init(): Promise<void> {
    const schema = TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT];
    await this.#db.createTable({ tableName: TABLE_WORKFLOW_SNAPSHOT, schema });
    // Add resourceId column for backwards compatibility
    await this.#db.alterTable({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      schema,
      ifNotExists: ['resourceId'],
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
  }

  async updateWorkflowResults(_args: {
    workflowName: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    requestContext: Record<string, any>;
  }): Promise<Record<string, StepResult<any, any, any, any>>> {
    throw new Error(
      'updateWorkflowResults is not implemented for ClickHouse storage. ClickHouse is an OLAP database and does not support atomic read-modify-write operations needed for concurrent workflow updates.',
    );
  }

  async updateWorkflowState(_args: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
  }): Promise<WorkflowRunState | undefined> {
    throw new Error(
      'updateWorkflowState is not implemented for ClickHouse storage. ClickHouse is an OLAP database and does not support atomic read-modify-write operations needed for concurrent workflow updates.',
    );
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
    try {
      const currentSnapshot = await this.#db.load({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        keys: { workflow_name: workflowName, run_id: runId },
      });

      const now = new Date();
      const persisting = currentSnapshot
        ? {
            ...currentSnapshot,
            resourceId,
            snapshot: JSON.stringify(snapshot),
            updatedAt: (updatedAt ?? now).toISOString(),
          }
        : {
            workflow_name: workflowName,
            run_id: runId,
            resourceId,
            snapshot: JSON.stringify(snapshot),
            createdAt: (createdAt ?? now).toISOString(),
            updatedAt: (updatedAt ?? now).toISOString(),
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
          id: createStorageErrorId('CLICKHOUSE', 'PERSIST_WORKFLOW_SNAPSHOT', 'FAILED'),
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
      const result = await this.#db.load({
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
          id: createStorageErrorId('CLICKHOUSE', 'LOAD_WORKFLOW_SNAPSHOT', 'FAILED'),
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
        this.logger.warn(`Failed to parse snapshot for workflow ${row.workflow_name}: ${e}`);
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
      const values: Record<string, any> = {};

      if (workflowName) {
        conditions.push(`workflow_name = {var_workflow_name:String}`);
        values.var_workflow_name = workflowName;
      }

      if (status) {
        conditions.push(`JSONExtractString(snapshot, 'status') = {var_status:String}`);
        values.var_status = status;
      }

      if (resourceId) {
        const hasResourceId = await this.#db.hasColumn(TABLE_WORKFLOW_SNAPSHOT, 'resourceId');
        if (hasResourceId) {
          conditions.push(`resourceId = {var_resourceId:String}`);
          values.var_resourceId = resourceId;
        } else {
          this.logger.warn(`[${TABLE_WORKFLOW_SNAPSHOT}] resourceId column not found. Skipping resourceId filter.`);
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
          id: createStorageErrorId('CLICKHOUSE', 'LIST_WORKFLOW_RUNS', 'FAILED'),
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
          id: createStorageErrorId('CLICKHOUSE', 'GET_WORKFLOW_RUN_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { runId: runId ?? '', workflowName: workflowName ?? '' },
        },
        error,
      );
    }
  }

  async deleteWorkflowRunById({ runId, workflowName }: { runId: string; workflowName: string }): Promise<void> {
    try {
      const values: Record<string, any> = {
        var_runId: runId,
        var_workflow_name: workflowName,
      };

      await this.client.command({
        query: `DELETE FROM ${TABLE_WORKFLOW_SNAPSHOT} WHERE run_id = {var_runId:String} AND workflow_name = {var_workflow_name:String}`,
        query_params: values,
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'DELETE_WORKFLOW_RUN_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { runId, workflowName },
        },
        error,
      );
    }
  }
}
