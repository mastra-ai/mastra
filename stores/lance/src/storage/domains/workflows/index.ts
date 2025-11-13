import type { Connection } from '@lancedb/lancedb';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { WorkflowRun, StorageListWorkflowRunsInput, WorkflowRuns } from '@mastra/core/storage';
import {
  ensureDate,
  normalizePerPage,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_SCHEMAS,
  WorkflowsStorageBase,
} from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import { LanceDomainBase } from '../base';
import type { LanceDomainConfig } from '../base';

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

export class WorkflowsStorageLance extends WorkflowsStorageBase {
  private domainBase: LanceDomainBase;

  private constructor(domainBase: LanceDomainBase) {
    super();
    this.domainBase = domainBase;
  }

  /**
   * Static factory method to create a StoreWorkflowsLance instance
   * Required because LanceDB connection is async
   */
  static async create(opts: LanceDomainConfig): Promise<WorkflowsStorageLance> {
    const domainBase = await LanceDomainBase.create(opts);
    return new WorkflowsStorageLance(domainBase);
  }

  private get client(): Connection {
    return this.domainBase['client'];
  }

  async init(): Promise<void> {
    await this.domainBase['operations'].createTable({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT],
    });
    await this.domainBase['operations'].alterTable({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT],
      ifNotExists: ['resourceId'],
    });
  }

  async close(): Promise<void> {
    await this.domainBase.close();
  }

  async dropData(): Promise<void> {
    await this.domainBase['operations'].clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
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
      const table = await this.client.openTable(TABLE_WORKFLOW_SNAPSHOT);

      // Try to find the existing record
      const query = table.query().where(`workflow_name = '${workflowId}' AND run_id = '${runId}'`);
      const records = await query.toArray();
      let createdAtVar: number;
      const now = Date.now();

      if (records.length > 0) {
        createdAtVar = records[0].createdAt ?? now;
      } else {
        createdAtVar = createdAt ? createdAt.getTime() : now;
      }

      const { status, value, ...rest } = snapshot;

      const record = {
        workflow_name: workflowId,
        run_id: runId,
        resourceId,
        snapshot: JSON.stringify({ status, value, ...rest }), // this is to ensure status is always just before value, for when querying the db by status
        createdAt: createdAtVar,
        updatedAt: updatedAt ? updatedAt.getTime() : now,
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
      const table = await this.client.openTable(TABLE_WORKFLOW_SNAPSHOT);
      const query = table.query().where(`workflow_name = '${workflowId}' AND run_id = '${runId}'`);
      const records = await query.toArray();
      return records.length > 0 ? JSON.parse(records[0].snapshot) : null;
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'LANCE_STORE_LOAD_WORKFLOW_SNAPSHOT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowId, runId },
        },
        error,
      );
    }
  }

  async getWorkflowRunById(args: { runId: string; workflowId?: string }): Promise<WorkflowRun | null> {
    try {
      const table = await this.client.openTable(TABLE_WORKFLOW_SNAPSHOT);
      let whereClause = `run_id = '${args.runId}'`;
      if (args.workflowId) {
        whereClause += ` AND workflow_name = '${args.workflowId}'`;
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
          details: { runId: args.runId, workflowId: args.workflowId ?? '' },
        },
        error,
      );
    }
  }

  async listWorkflowRuns(args?: StorageListWorkflowRunsInput): Promise<WorkflowRuns> {
    try {
      const table = await this.client.openTable(TABLE_WORKFLOW_SNAPSHOT);

      let query = table.query();

      const conditions: string[] = [];

      if (args?.workflowId) {
        conditions.push(`workflow_name = '${args.workflowId.replace(/'/g, "''")}'`);
      }

      if (args?.status) {
        const escapedStatus = args.status
          .replace(/\\/g, '\\\\')
          .replace(/'/g, "''")
          .replace(/%/g, '\\%')
          .replace(/_/g, '\\_');
        // Note: Using LIKE pattern since LanceDB doesn't support JSON extraction on string columns
        // The pattern ensures we match the workflow status (which appears before "value") and not step status
        conditions.push(`\`snapshot\` LIKE '%"status":"${escapedStatus}","value"%'`);
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

      if (args?.perPage !== undefined && args?.page !== undefined) {
        const normalizedPerPage = normalizePerPage(args.perPage, Number.MAX_SAFE_INTEGER);

        if (args.page < 0 || !Number.isInteger(args.page)) {
          throw new MastraError(
            {
              id: 'LANCE_STORE_INVALID_PAGINATION_PARAMS',
              domain: ErrorDomain.STORAGE,
              category: ErrorCategory.USER,
              details: { page: args.page, perPage: args.perPage },
            },
            new Error(`Invalid pagination parameters: page=${args.page}, perPage=${args.perPage}`),
          );
        }
        const offset = args.page * normalizedPerPage;
        query.limit(normalizedPerPage);
        query.offset(offset);
      }

      const records = await query.toArray();

      return {
        runs: records.map(record => parseWorkflowRun(record)),
        total: total || records.length,
      };
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'LANCE_STORE_LIST_WORKFLOW_RUNS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId: args?.resourceId ?? '', workflowId: args?.workflowId ?? '' },
        },
        error,
      );
    }
  }
}
