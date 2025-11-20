import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { WorkflowRun, WorkflowRuns, StorageListWorkflowRunsInput } from '@mastra/core/storage';
import { ensureDate, TABLE_WORKFLOW_SNAPSHOT, WorkflowsStorageBase, TABLE_SCHEMAS } from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import { createSqlBuilder } from '../../sql-builder';
import type { SqlParam } from '../../sql-builder';
import { D1DomainBase } from '../base';
import type { D1DomainConfig } from '../base';
import { isArrayOfRecords } from '../utils';

export class WorkflowsStorageD1 extends WorkflowsStorageBase {
  private domainBase: D1DomainBase;

  constructor(opts: D1DomainConfig) {
    super();
    this.domainBase = new D1DomainBase(opts);
  }

  async init(): Promise<void> {
    await this.domainBase.getOperations().createTable({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT],
    });
  }

  async close(): Promise<void> {
    // D1 doesn't need explicit cleanup
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
    const fullTableName = this.domainBase.getOperations().getTableName(TABLE_WORKFLOW_SNAPSHOT);
    const now = createdAt ?? new Date();
    const updatedAtValue = updatedAt ?? new Date();

    const currentSnapshot = await this.domainBase.getOperations().load({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      keys: { workflow_name: workflowId, run_id: runId },
    });

    const persisting = currentSnapshot
      ? {
          ...currentSnapshot,
          resourceId,
          snapshot: JSON.stringify(snapshot),
          updatedAt: updatedAtValue,
        }
      : {
          workflow_name: workflowId,
          run_id: runId,
          resourceId,
          snapshot: snapshot as Record<string, any>,
          createdAt: now,
          updatedAt: updatedAtValue,
        };

    // Process record for SQL insertion
    const processedRecord = await this.domainBase.getOperations().processRecord(persisting);

    const columns = Object.keys(processedRecord);
    const values = Object.values(processedRecord);

    // Specify which columns to update on conflict (all except PKs)
    const updateMap: Record<string, string> = {
      snapshot: 'excluded.snapshot',
      updatedAt: 'excluded.updatedAt',
    };

    this.logger.debug('Persisting workflow snapshot', { workflowId, runId });

    // Use the new insert method with ON CONFLICT
    const query = createSqlBuilder().insert(fullTableName, columns, values, ['workflow_name', 'run_id'], updateMap);

    const { sql, params } = query.build();

    try {
      await this.domainBase.getOperations().executeQuery({ sql, params });
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_PERSIST_WORKFLOW_SNAPSHOT_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to persist workflow snapshot: ${error instanceof Error ? error.message : String(error)}`,
          details: { workflowId, runId },
        },
        error,
      );
    }
  }

  async getWorkflowSnapshot(params: { workflowId: string; runId: string }): Promise<WorkflowRunState | null> {
    const { workflowId, runId } = params;

    this.logger.debug('Loading workflow snapshot', { workflowId, runId });

    try {
      const d = await this.domainBase.getOperations().load<{ snapshot: unknown }>({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        keys: {
          workflow_name: workflowId,
          run_id: runId,
        },
      });

      return d ? (d.snapshot as WorkflowRunState) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_LOAD_WORKFLOW_SNAPSHOT_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to load workflow snapshot: ${error instanceof Error ? error.message : String(error)}`,
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
      createdAt: ensureDate(row.createdAt)!,
      updatedAt: ensureDate(row.updatedAt)!,
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
    const fullTableName = this.domainBase.getOperations().getTableName(TABLE_WORKFLOW_SNAPSHOT);
    try {
      const builder = createSqlBuilder().select().from(fullTableName);
      const countBuilder = createSqlBuilder().count().from(fullTableName);

      if (workflowId) builder.whereAnd('workflow_name = ?', workflowId);
      if (status) {
        builder.whereAnd("json_extract(snapshot, '$.status') = ?", status);
        countBuilder.whereAnd("json_extract(snapshot, '$.status') = ?", status);
      }
      if (resourceId) {
        const hasResourceId = await this.domainBase.getOperations().hasColumn(fullTableName, 'resourceId');
        if (hasResourceId) {
          builder.whereAnd('resourceId = ?', resourceId);
          countBuilder.whereAnd('resourceId = ?', resourceId);
        } else {
          console.warn(`[${fullTableName}] resourceId column not found. Skipping resourceId filter.`);
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
        const countResult = await this.domainBase.getOperations().executeQuery({
          sql: countSql,
          params: countParams,
          first: true,
        });
        total = Number((countResult as Record<string, any>)?.count ?? 0);
      }

      const results = await this.domainBase.getOperations().executeQuery({ sql, params });
      const runs = (isArrayOfRecords(results) ? results : []).map((row: any) => this.parseWorkflowRun(row));
      return { runs, total: total || runs.length };
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_LIST_WORKFLOW_RUNS_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to retrieve workflow runs: ${error instanceof Error ? error.message : String(error)}`,
          details: {
            workflowId: workflowId ?? '',
            resourceId: resourceId ?? '',
          },
        },
        error,
      );
    }
  }

  async getWorkflowRunById({ runId, workflowId }: { runId: string; workflowId?: string }): Promise<WorkflowRun | null> {
    const fullTableName = this.domainBase.getOperations().getTableName(TABLE_WORKFLOW_SNAPSHOT);
    try {
      const conditions: string[] = [];
      const params: SqlParam[] = [];
      if (runId) {
        conditions.push('run_id = ?');
        params.push(runId);
      }
      if (workflowId) {
        conditions.push('workflow_name = ?');
        params.push(workflowId);
      }
      const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
      const sql = `SELECT * FROM ${fullTableName} ${whereClause} ORDER BY createdAt DESC LIMIT 1`;
      const result = await this.domainBase.getOperations().executeQuery({ sql, params, first: true });
      if (!result) return null;
      return this.parseWorkflowRun(result);
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_GET_WORKFLOW_RUN_BY_ID_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to retrieve workflow run by ID: ${error instanceof Error ? error.message : String(error)}`,
          details: { runId, workflowId: workflowId ?? '' },
        },
        error,
      );
    }
  }
}
