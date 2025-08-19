import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { WorkflowRun, WorkflowRuns } from '@mastra/core/storage';
import { ensureDate, TABLE_WORKFLOW_SNAPSHOT, WorkflowsStorage } from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import { createSqlBuilder } from '../../sql-builder';
import type { SqlParam } from '../../sql-builder';
import type { StoreOperationsD1 } from '../operations';
import { isArrayOfRecords } from '../utils';

export class WorkflowsStorageD1 extends WorkflowsStorage {
  private operations: StoreOperationsD1;

  constructor({ operations }: { operations: StoreOperationsD1 }) {
    super();
    this.operations = operations;
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
    const fullTableName = this.operations.getTableName(TABLE_WORKFLOW_SNAPSHOT);
    const now = new Date().toISOString();

    const currentSnapshot = await this.operations.load({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      keys: { workflow_name: workflowName, run_id: runId },
    });

    const persisting = currentSnapshot
      ? {
          ...currentSnapshot,
          snapshot: JSON.stringify(snapshot),
          updatedAt: now,
        }
      : {
          workflow_name: workflowName,
          run_id: runId,
          snapshot: snapshot as Record<string, any>,
          createdAt: now,
          updatedAt: now,
        };

    // Process record for SQL insertion
    const processedRecord = await this.operations.processRecord(persisting);

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
      await this.operations.executeQuery({ sql, params });
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_PERSIST_WORKFLOW_SNAPSHOT_ERROR',
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
      const d = await this.operations.load<{ snapshot: unknown }>({
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
          id: 'CLOUDFLARE_D1_STORAGE_LOAD_WORKFLOW_SNAPSHOT_ERROR',
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
    const fullTableName = this.operations.getTableName(TABLE_WORKFLOW_SNAPSHOT);
    try {
      const builder = createSqlBuilder().select().from(fullTableName);
      const countBuilder = createSqlBuilder().count().from(fullTableName);

      if (workflowName) builder.whereAnd('workflow_name = ?', workflowName);
      if (resourceId) {
        const hasResourceId = await this.operations.hasColumn(fullTableName, 'resourceId');
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
      if (typeof limit === 'number') builder.limit(limit);
      if (typeof offset === 'number') builder.offset(offset);

      const { sql, params } = builder.build();

      let total = 0;

      if (limit !== undefined && offset !== undefined) {
        const { sql: countSql, params: countParams } = countBuilder.build();
        const countResult = await this.operations.executeQuery({
          sql: countSql,
          params: countParams,
          first: true,
        });
        total = Number((countResult as Record<string, any>)?.count ?? 0);
      }

      const results = await this.operations.executeQuery({ sql, params });
      const runs = (isArrayOfRecords(results) ? results : []).map((row: any) => this.parseWorkflowRun(row));
      return { runs, total: total || runs.length };
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_GET_WORKFLOW_RUNS_ERROR',
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
    const fullTableName = this.operations.getTableName(TABLE_WORKFLOW_SNAPSHOT);
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
      const result = await this.operations.executeQuery({ sql, params, first: true });
      if (!result) return null;
      return this.parseWorkflowRun(result);
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_GET_WORKFLOW_RUN_BY_ID_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to retrieve workflow run by ID: ${error instanceof Error ? error.message : String(error)}`,
          details: { runId, workflowName: workflowName ?? '' },
        },
        error,
      );
    }
  }
}
