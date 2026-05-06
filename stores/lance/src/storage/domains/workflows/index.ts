import type { Connection } from '@lancedb/lancedb';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type {
  WorkflowRun,
  StorageListWorkflowRunsInput,
  WorkflowRuns,
  UpdateWorkflowStateOptions,
} from '@mastra/core/storage';
import {
  createStorageErrorId,
  ensureDate,
  normalizePerPage,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_SCHEMAS,
  WorkflowsStorage,
} from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import { LanceDB, resolveLanceConfig } from '../../db';
import type { LanceDomainConfig } from '../../db';

/**
 * Escapes single quotes in SQL string values to prevent SQL injection.
 */
function escapeSql(str: string): string {
  return str.replace(/'/g, "''");
}

export class StoreWorkflowsLance extends WorkflowsStorage {
  client: Connection;
  #db: LanceDB;
  constructor(config: LanceDomainConfig) {
    super();
    const client = resolveLanceConfig(config);
    this.client = client;
    this.#db = new LanceDB({ client });
  }

  supportsConcurrentUpdates(): boolean {
    return false;
  }

  private parseWorkflowRun(row: any): WorkflowRun {
    let parsedSnapshot: WorkflowRunState | string = row.snapshot;
    if (typeof parsedSnapshot === 'string') {
      try {
        parsedSnapshot = JSON.parse(row.snapshot as string) as WorkflowRunState;
      } catch (e) {
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
      'updateWorkflowResults is not implemented for LanceDB storage. LanceDB does not support atomic read-modify-write operations needed for concurrent workflow updates.',
    );
  }

  async updateWorkflowState(_args: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
  }): Promise<WorkflowRunState | undefined> {
    throw new Error(
      'updateWorkflowState is not implemented for LanceDB storage. LanceDB does not support atomic read-modify-write operations needed for concurrent workflow updates.',
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
      const table = await this.client.openTable(TABLE_WORKFLOW_SNAPSHOT);

      // Try to find the existing record
      const query = table
        .query()
        .where(`workflow_name = '${escapeSql(workflowName)}' AND run_id = '${escapeSql(runId)}'`);
      const records = await query.toArray();
      let createdAtValue: number;
      const now = createdAt?.getTime() ?? Date.now();

      if (records.length > 0) {
        createdAtValue = records[0].createdAt ?? now;
      } else {
        createdAtValue = now;
      }

      const { status, value, ...rest } = snapshot;

      const record = {
        workflow_name: workflowName,
        run_id: runId,
        resourceId,
        snapshot: JSON.stringify({ status, value, ...rest }), // this is to ensure status is always just before value, for when querying the db by status
        createdAt: createdAtValue,
        updatedAt: updatedAt ?? now,
      };

      await table
        .mergeInsert(['workflow_name', 'run_id'])
        .whenMatchedUpdateAll()
        .whenNotMatchedInsertAll()
        .execute([record]);
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('LANCE', 'PERSIST_WORKFLOW_SNAPSHOT', 'FAILED'),
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
      const query = table
        .query()
        .where(`workflow_name = '${escapeSql(workflowName)}' AND run_id = '${escapeSql(runId)}'`);
      const records = await query.toArray();
      return records.length > 0 ? JSON.parse(records[0].snapshot) : null;
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('LANCE', 'LOAD_WORKFLOW_SNAPSHOT', 'FAILED'),
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
      let whereClause = `run_id = '${escapeSql(args.runId)}'`;
      if (args.workflowName) {
        whereClause += ` AND workflow_name = '${escapeSql(args.workflowName)}'`;
      }
      const query = table.query().where(whereClause);
      const records = await query.toArray();
      if (records.length === 0) return null;
      const record = records[0];
      return this.parseWorkflowRun(record);
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('LANCE', 'GET_WORKFLOW_RUN_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { runId: args.runId, workflowName: args.workflowName ?? '' },
        },
        error,
      );
    }
  }

  async deleteWorkflowRunById({ runId, workflowName }: { runId: string; workflowName: string }): Promise<void> {
    try {
      const table = await this.client.openTable(TABLE_WORKFLOW_SNAPSHOT);
      const whereClause = `run_id = '${escapeSql(runId)}' AND workflow_name = '${escapeSql(workflowName)}'`;
      await table.delete(whereClause);
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('LANCE', 'DELETE_WORKFLOW_RUN_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { runId, workflowName },
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

      if (args?.workflowName) {
        conditions.push(`workflow_name = '${escapeSql(args.workflowName)}'`);
      }

      if (args?.status) {
        // Escape for LIKE pattern: backslashes, single quotes, and LIKE wildcards
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
        conditions.push(`\`resourceId\` = '${escapeSql(args.resourceId)}'`);
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
              id: createStorageErrorId('LANCE', 'LIST_WORKFLOW_RUNS', 'INVALID_PAGINATION'),
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
        runs: records.map(record => this.parseWorkflowRun(record)),
        total: total || records.length,
      };
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('LANCE', 'LIST_WORKFLOW_RUNS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId: args?.resourceId ?? '', workflowName: args?.workflowName ?? '' },
        },
        error,
      );
    }
  }
}
