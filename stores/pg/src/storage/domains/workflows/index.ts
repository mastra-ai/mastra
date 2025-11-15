import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { normalizePerPage, TABLE_WORKFLOW_SNAPSHOT, WorkflowsStorageBase, TABLE_SCHEMAS } from '@mastra/core/storage';
import type {
  StorageListWorkflowRunsInput,
  WorkflowRun,
  WorkflowRuns,
  CreateIndexOptions,
  IndexInfo,
  StorageIndexStats,
} from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import { PGDomainBase } from '../base';
import type { PGDomainConfig } from '../base';
import { IndexManagementPG } from '../operations';
import { getTableName } from '../utils';

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
    createdAt: new Date(row.createdAtZ || (row.createdAt as string)),
    updatedAt: new Date(row.updatedAtZ || (row.updatedAt as string)),
  };
}

// Workflows domain table names
type WorkflowsTableNames = typeof TABLE_WORKFLOW_SNAPSHOT;

export class WorkflowsStoragePG extends WorkflowsStorageBase {
  private domainBase: PGDomainBase;
  indexManagement?: IndexManagementPG;
  schemaPrefix?: string;

  constructor(opts: PGDomainConfig) {
    super();
    this.domainBase = new PGDomainBase(opts);
    this.schemaPrefix =
      this.domainBase.getSchema() && this.domainBase.getSchema() !== 'public' ? `${this.domainBase.getSchema()}_` : '';
  }

  private getIndexManagement() {
    if (!this.indexManagement) {
      this.indexManagement = new IndexManagementPG({
        client: this.domainBase.getClient(),
        schemaName: this.domainBase.getSchema(),
      });
    }
    return this.indexManagement;
  }

  async createIndex<T extends WorkflowsTableNames>({
    name,
    table,
    columns,
  }: {
    table: T;
  } & Omit<CreateIndexOptions, 'table'>) {
    const indexManagement = this.getIndexManagement();

    await indexManagement.createIndex({
      name: `${this.schemaPrefix}${name}`,
      table,
      columns,
    });
  }

  async listIndexes<T extends WorkflowsTableNames>(table: T): Promise<IndexInfo[]> {
    const indexManagement = this.getIndexManagement();
    return indexManagement.listIndexes(table);
  }

  async describeIndex(name: string): Promise<StorageIndexStats> {
    const indexManagement = this.getIndexManagement();
    return indexManagement.describeIndex(`${this.schemaPrefix}${name}`);
  }

  async dropIndex(name: string) {
    const indexManagement = this.getIndexManagement();
    await indexManagement.dropIndex(`${this.schemaPrefix}${name}`);
  }

  async init(): Promise<void> {
    await this.domainBase.getOperations().createTable({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT],
    });

    await this.domainBase.getOperations().alterTable?.({
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
      const now = new Date().toISOString();
      await this.domainBase.getClient().none(
        `INSERT INTO ${getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: this.domainBase.getSchema() })} (workflow_name, run_id, "resourceId", snapshot, "createdAt", "updatedAt")
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (workflow_name, run_id) DO UPDATE
                 SET "resourceId" = $3, snapshot = $4, "updatedAt" = $6`,
        [
          workflowId,
          runId,
          resourceId,
          JSON.stringify(snapshot),
          createdAt ? createdAt.toISOString() : now,
          updatedAt ? updatedAt.toISOString() : now,
        ],
      );
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_PERSIST_WORKFLOW_SNAPSHOT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
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
      const result = await this.domainBase.getOperations().load<{ snapshot: WorkflowRunState }>({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        keys: { workflow_name: workflowId, run_id: runId },
      });

      return result ? result.snapshot : null;
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_LOAD_WORKFLOW_SNAPSHOT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getWorkflowRunById({ runId, workflowId }: { runId: string; workflowId?: string }): Promise<WorkflowRun | null> {
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (runId) {
        conditions.push(`run_id = $${paramIndex}`);
        values.push(runId);
        paramIndex++;
      }

      if (workflowId) {
        conditions.push(`workflow_name = $${paramIndex}`);
        values.push(workflowId);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get results
      const query = `
          SELECT * FROM ${getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: this.domainBase.getSchema() })}
          ${whereClause}
          ORDER BY "createdAt" DESC LIMIT 1
        `;

      const queryValues = values;

      const result = await this.domainBase.getClient().oneOrNone(query, queryValues);

      if (!result) {
        return null;
      }

      return parseWorkflowRun(result);
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_GET_WORKFLOW_RUN_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            runId,
            workflowId: workflowId || '',
          },
        },
        error,
      );
    }
  }

  async listWorkflowRuns({
    workflowId,
    fromDate,
    toDate,
    perPage,
    page,
    resourceId,
    status,
  }: StorageListWorkflowRunsInput = {}): Promise<WorkflowRuns> {
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (workflowId) {
        conditions.push(`workflow_name = $${paramIndex}`);
        values.push(workflowId);
        paramIndex++;
      }

      if (status) {
        conditions.push(`snapshot::jsonb ->> 'status' = $${paramIndex}`);
        values.push(status);
        paramIndex++;
      }

      if (resourceId) {
        const hasResourceId = await this.domainBase.getOperations().hasColumn(TABLE_WORKFLOW_SNAPSHOT, 'resourceId');
        if (hasResourceId) {
          conditions.push(`"resourceId" = $${paramIndex}`);
          values.push(resourceId);
          paramIndex++;
        } else {
          console.warn(`[${TABLE_WORKFLOW_SNAPSHOT}] resourceId column not found. Skipping resourceId filter.`);
        }
      }

      if (fromDate) {
        conditions.push(`"createdAt" >= $${paramIndex}`);
        values.push(fromDate instanceof Date ? fromDate.toISOString() : fromDate);
        paramIndex++;
      }

      if (toDate) {
        conditions.push(`"createdAt" <= $${paramIndex}`);
        values.push(toDate instanceof Date ? toDate.toISOString() : toDate);
        paramIndex++;
      }
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      let total = 0;
      const usePagination = typeof perPage === 'number' && typeof page === 'number';
      // Only get total count when using pagination
      if (usePagination) {
        const countResult = await this.domainBase
          .getClient()
          .one(
            `SELECT COUNT(*) as count FROM ${getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: this.domainBase.getSchema() })} ${whereClause}`,
            values,
          );
        total = Number(countResult.count);
      }

      const normalizedPerPage = usePagination ? normalizePerPage(perPage, Number.MAX_SAFE_INTEGER) : 0;
      const offset = usePagination ? page! * normalizedPerPage : undefined;

      // Get results
      const query = `
          SELECT * FROM ${getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: this.domainBase.getSchema() })}
          ${whereClause}
          ORDER BY "createdAt" DESC
          ${usePagination ? ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}` : ''}
        `;

      const queryValues = usePagination ? [...values, normalizedPerPage, offset] : values;

      const result = await this.domainBase.getClient().manyOrNone(query, queryValues);

      const runs = (result || []).map(row => {
        return parseWorkflowRun(row);
      });

      // Use runs.length as total when not paginating
      return { runs, total: total || runs.length };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_LIST_WORKFLOW_RUNS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            workflowId: workflowId || 'all',
          },
        },
        error,
      );
    }
  }
}
