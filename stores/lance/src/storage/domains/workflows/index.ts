import type { Connection } from '@lancedb/lancedb';
import type { StepResult, WorkflowRunState, WorkflowRuns } from '@mastra/core';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { WorkflowRun } from '@mastra/core/storage';
import { ensureDate, TABLE_WORKFLOW_SNAPSHOT, WorkflowsStorage } from '@mastra/core/storage';

function parseWorkflowRun(row: any): WorkflowRun {
  let parsedSnapshot: WorkflowRunState | string = row.snapshot;
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

export class StoreWorkflowsLance extends WorkflowsStorage {
  client: Connection;
  constructor({ client }: { client: Connection }) {
    super();
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
      const table = await this.client.openTable(TABLE_WORKFLOW_SNAPSHOT);

      // Try to find the existing record
      const query = table.query().where(`workflow_name = '${workflowName}' AND run_id = '${runId}'`);
      const records = await query.toArray();
      let createdAt: number;
      const now = Date.now();

      if (records.length > 0) {
        createdAt = records[0].createdAt ?? now;
      } else {
        createdAt = now;
      }

      const record = {
        workflow_name: workflowName,
        run_id: runId,
        snapshot: JSON.stringify(snapshot),
        createdAt,
        updatedAt: now,
      };

      await table
        .mergeInsert(['workflow_name', 'run_id'])
        .whenMatchedUpdateAll()
        .whenNotMatchedInsertAll()
        .execute([record]);
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'LANCE_STORE_PERSIST_WORKFLOW_SNAPSHOT_FAILED',
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
      const table = await this.client.openTable(TABLE_WORKFLOW_SNAPSHOT);
      const query = table.query().where(`workflow_name = '${workflowName}' AND run_id = '${runId}'`);
      const records = await query.toArray();
      return records.length > 0 ? JSON.parse(records[0].snapshot) : null;
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'LANCE_STORE_LOAD_WORKFLOW_SNAPSHOT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName, runId },
        },
        error,
      );
    }
  }

  async getWorkflowRunById(args: { runId: string; workflowName?: string }): Promise<{
    workflowName: string;
    runId: string;
    snapshot: any;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    try {
      const table = await this.client.openTable(TABLE_WORKFLOW_SNAPSHOT);
      let whereClause = `run_id = '${args.runId}'`;
      if (args.workflowName) {
        whereClause += ` AND workflow_name = '${args.workflowName}'`;
      }
      const query = table.query().where(whereClause);
      const records = await query.toArray();
      if (records.length === 0) return null;
      const record = records[0];
      return parseWorkflowRun(record);
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'LANCE_STORE_GET_WORKFLOW_RUN_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { runId: args.runId, workflowName: args.workflowName ?? '' },
        },
        error,
      );
    }
  }

  async getWorkflowRuns(args?: {
    namespace?: string;
    resourceId?: string;
    workflowName?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<WorkflowRuns> {
    try {
      const table = await this.client.openTable(TABLE_WORKFLOW_SNAPSHOT);

      let query = table.query();

      const conditions: string[] = [];

      if (args?.workflowName) {
        conditions.push(`workflow_name = '${args.workflowName.replace(/'/g, "''")}'`);
      }

      if (args?.resourceId) {
        conditions.push(`\`resourceId\` = '${args.resourceId}'`);
      }

      if (args?.fromDate instanceof Date) {
        conditions.push(`\`createdAt\` >= ${args.fromDate.getTime()}`);
      }

      if (args?.toDate instanceof Date) {
        conditions.push(`\`createdAt\` <= ${args.toDate.getTime()}`);
      }

      let total = 0;

      // Apply all conditions
      if (conditions.length > 0) {
        query = query.where(conditions.join(' AND '));
        total = await table.countRows(conditions.join(' AND '));
      } else {
        total = await table.countRows();
      }

      if (args?.limit) {
        query.limit(args.limit);
      }

      if (args?.offset) {
        query.offset(args.offset);
      }

      const records = await query.toArray();

      return {
        runs: records.map(record => parseWorkflowRun(record)),
        total: total || records.length,
      };
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'LANCE_STORE_GET_WORKFLOW_RUNS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { namespace: args?.namespace ?? '', workflowName: args?.workflowName ?? '' },
        },
        error,
      );
    }
  }
}
