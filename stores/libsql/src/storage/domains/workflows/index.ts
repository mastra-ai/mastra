import type { Client, InValue } from '@libsql/client';
import type { WorkflowRun, WorkflowRuns, WorkflowRunState } from '@mastra/core';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { TABLE_WORKFLOW_SNAPSHOT, WorkflowsStorage } from '@mastra/core/storage';
import type { StoreOperationsLibSQL } from '../operations';

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
    createdAt: new Date(row.createdAt as string),
    updatedAt: new Date(row.updatedAt as string),
  };
}

export class WorkflowsLibSQL extends WorkflowsStorage {
  operations: StoreOperationsLibSQL;
  client: Client;
  constructor({ operations, client }: { operations: StoreOperationsLibSQL; client: Client }) {
    super();
    this.operations = operations;
    this.client = client;
  }

  async persistWorkflowSnapshot({
    workflowName,
    runId,
    snapshot,
  }: {
    workflowName: string;
    runId: string;
    snapshot: WorkflowRunState;
  }) {
    const data = {
      workflow_name: workflowName,
      run_id: runId,
      snapshot,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.logger.debug('Persisting workflow snapshot', { workflowName, runId, data });
    await this.operations.insert({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      record: data,
    });
  }

  async loadWorkflowSnapshot({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    this.logger.debug('Loading workflow snapshot', { workflowName, runId });
    const d = await this.operations.load<{ snapshot: WorkflowRunState }>({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      keys: { workflow_name: workflowName, run_id: runId },
    });

    return d ? d.snapshot : null;
  }

  async getWorkflowRunById({
    runId,
    workflowName,
  }: {
    runId: string;
    workflowName?: string;
  }): Promise<WorkflowRun | null> {
    const conditions: string[] = [];
    const args: (string | number)[] = [];

    if (runId) {
      conditions.push('run_id = ?');
      args.push(runId);
    }

    if (workflowName) {
      conditions.push('workflow_name = ?');
      args.push(workflowName);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
      const result = await this.client.execute({
        sql: `SELECT * FROM ${TABLE_WORKFLOW_SNAPSHOT} ${whereClause} ORDER BY createdAt DESC LIMIT 1`,
        args,
      });

      if (!result.rows?.[0]) {
        return null;
      }

      return parseWorkflowRun(result.rows[0]);
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_GET_WORKFLOW_RUN_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
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
      const args: InValue[] = [];

      if (workflowName) {
        conditions.push('workflow_name = ?');
        args.push(workflowName);
      }

      if (fromDate) {
        conditions.push('createdAt >= ?');
        args.push(fromDate.toISOString());
      }

      if (toDate) {
        conditions.push('createdAt <= ?');
        args.push(toDate.toISOString());
      }

      if (resourceId) {
        const hasResourceId = await this.operations.hasColumn(TABLE_WORKFLOW_SNAPSHOT, 'resourceId');
        if (hasResourceId) {
          conditions.push('resourceId = ?');
          args.push(resourceId);
        } else {
          console.warn(`[${TABLE_WORKFLOW_SNAPSHOT}] resourceId column not found. Skipping resourceId filter.`);
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      let total = 0;
      // Only get total count when using pagination
      if (limit !== undefined && offset !== undefined) {
        const countResult = await this.client.execute({
          sql: `SELECT COUNT(*) as count FROM ${TABLE_WORKFLOW_SNAPSHOT} ${whereClause}`,
          args,
        });
        total = Number(countResult.rows?.[0]?.count ?? 0);
      }

      // Get results
      const result = await this.client.execute({
        sql: `SELECT * FROM ${TABLE_WORKFLOW_SNAPSHOT} ${whereClause} ORDER BY createdAt DESC${limit !== undefined && offset !== undefined ? ` LIMIT ? OFFSET ?` : ''}`,
        args: limit !== undefined && offset !== undefined ? [...args, limit, offset] : args,
      });

      const runs = (result.rows || []).map(row => parseWorkflowRun(row));

      // Use runs.length as total when not paginating
      return { runs, total: total || runs.length };
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_GET_WORKFLOW_RUNS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
