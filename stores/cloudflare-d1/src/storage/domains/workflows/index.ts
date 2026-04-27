import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type {
  WorkflowRun,
  WorkflowRuns,
  StorageListWorkflowRunsInput,
  UpdateWorkflowStateOptions,
} from '@mastra/core/storage';
import {
  createStorageErrorId,
  ensureDate,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_SCHEMAS,
  WorkflowsStorage,
} from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import { D1DB, resolveD1Config } from '../../db';
import type { D1DomainConfig } from '../../db';
import { createSqlBuilder } from '../../sql-builder';
import type { SqlParam } from '../../sql-builder';
import { isArrayOfRecords } from '../utils';

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
  }: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
    createdAt?: Date;
    updatedAt?: Date;
  }): Promise<void> {
    const fullTableName = this.#db.getTableName(TABLE_WORKFLOW_SNAPSHOT);
    const now = new Date().toISOString();

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
    const query = createSqlBuilder().insert(fullTableName, columns, values, ['workflow_name', 'run_id'], updateMap);

    const { sql, params } = query.build();

    try {
      await this.#db.executeQuery({ sql, params });
    } catch (error) {
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
        builder.whereAnd("json_extract(snapshot, '$.status') = ?", status);
        countBuilder.whereAnd("json_extract(snapshot, '$.status') = ?", status);
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

  async deleteWorkflowRunById({ runId, workflowName }: { runId: string; workflowName: string }): Promise<void> {
    const fullTableName = this.#db.getTableName(TABLE_WORKFLOW_SNAPSHOT);
    try {
      const sql = `DELETE FROM ${fullTableName} WHERE workflow_name = ? AND run_id = ?`;
      const params: SqlParam[] = [workflowName, runId];
      await this.#db.executeQuery({ sql, params });
    } catch (error) {
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
