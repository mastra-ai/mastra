import type { StepResult, WorkflowRun, WorkflowRuns, WorkflowRunState } from '@mastra/core';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { TABLE_WORKFLOW_SNAPSHOT, WorkflowsStorage } from '@mastra/core/storage';
import type { IDatabase } from 'pg-promise';
import type { StoreOperationsPG } from '../operations';
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

export class WorkflowsPG extends WorkflowsStorage {
  public client: IDatabase<{}>;
  private operations: StoreOperationsPG;
  private schema: string;

  constructor({
    client,
    operations,
    schema,
  }: {
    client: IDatabase<{}>;
    operations: StoreOperationsPG;
    schema: string;
  }) {
    super();
    this.client = client;
    this.operations = operations;
    this.schema = schema;
  }

  async updateWorkflowResults({
    workflowName,
    runId,
    stepId,
    result,
    runtimeContext,
  }: {
    workflowName: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    runtimeContext: Record<string, any>;
  }): Promise<Record<string, StepResult<any, any, any, any>>> {
    try {
      const tableName = getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: this.schema });
      const now = new Date().toISOString();

      let resultString: string;
      try {
        resultString = JSON.stringify(result);
      } catch (error) {
        throw new MastraError(
          {
            id: 'MASTRA_STORAGE_JSON_STRINGIFY_FAILED',
            text: 'JSON.stringify failed for step result',
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.THIRD_PARTY,
            details: { workflowName, runId, stepId },
          },
          error,
        );
      }

      await this.client.none(
        `UPDATE ${tableName}
         SET snapshot = jsonb_set(
           snapshot::jsonb,
           $1,
           $2::jsonb,
           true
         ),
         "updatedAt" = $3
         WHERE workflow_name = $4 AND run_id = $5`,
        [`{context,${stepId}}`, resultString, now, workflowName, runId],
      );

      if (runtimeContext && Object.keys(runtimeContext).length > 0) {
        for (const [key, value] of Object.entries(runtimeContext)) {
          const valueString = JSON.stringify(value);
          await this.client.none(
            `UPDATE ${tableName}
             SET snapshot = jsonb_set(
               snapshot::jsonb,
               $1,
               $2::jsonb,
               true
             ),
             "updatedAt" = $3
             WHERE workflow_name = $4 AND run_id = $5`,
            [`{runtimeContext,${key}}`, valueString, now, workflowName, runId],
          );
        }
      }

      const updatedSnapshot = await this.loadWorkflowSnapshot({ workflowName, runId });
      if (!updatedSnapshot) {
        throw new MastraError({
          id: 'MASTRA_STORAGE_PG_STORE_UPDATE_WORKFLOW_RESULTS_SNAPSHOT_NOT_FOUND',
          text: `Workflow snapshot not found after update for ${workflowName}:${runId}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { workflowName, runId },
        });
      }

      return updatedSnapshot.context;
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_UPDATE_WORKFLOW_RESULTS_FAILED',
          text: 'Failed to update workflow results',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName, runId, stepId },
        },
        error,
      );
    }
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
    resourceId,
    snapshot,
  }: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
  }): Promise<void> {
    let snapshotString: string;

    // Quick size estimation to prevent crashes
    // Count string lengths as rough approximation
    const estimateSize = (obj: any, depth = 0): number => {
      if (depth > 10) return 100; // Prevent infinite recursion
      if (typeof obj === 'string') return obj.length;
      if (typeof obj === 'number' || typeof obj === 'boolean') return 8;
      if (!obj) return 0;
      if (Array.isArray(obj)) {
        return obj.reduce((sum, item) => sum + estimateSize(item, depth + 1), 50);
      }
      if (typeof obj === 'object') {
        return Object.entries(obj).reduce((sum, [k, v]) => sum + k.length + estimateSize(v, depth + 1), 100);
      }
      return 0;
    };

    const estimatedBytes = estimateSize(snapshot);
    const estimatedMB = Math.round(estimatedBytes / 1024 / 1024);

    // Prevent attempting JSON.stringify on payloads likely to cause heap errors
    // Use conservative limit since estimation is rough
    if (estimatedMB > 200) {
      throw new MastraError({
        id: 'MASTRA_STORAGE_PAYLOAD_TOO_LARGE',
        text: `Workflow snapshot too large (~${estimatedMB}MB). Maximum supported size is 200MB. Consider using external storage for large payloads.`,
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: {
          workflowName,
          runId,
          estimatedMB,
          maxSizeMB: 200,
        },
      });
    }

    try {
      snapshotString = JSON.stringify(snapshot);
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_JSON_STRINGIFY_FAILED',
          text: `JSON.stringify failed - payload (~${estimatedMB}MB) exceeds V8 string limit`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            workflowName,
            runId,
            estimatedMB,
          },
        },
        error,
      );
    }
    try {
      const now = new Date().toISOString();
      await this.client.none(
        `INSERT INTO ${getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: this.schema })} (workflow_name, run_id, "resourceId", snapshot, "createdAt", "updatedAt")
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (workflow_name, run_id) DO UPDATE
                 SET "resourceId" = $3, snapshot = $4, "updatedAt" = $6`,
        [workflowName, runId, resourceId, snapshotString, now, now],
      );
    } catch (error) {
      let isPgPromiseFormattingError = false;
      if (error instanceof Error) {
        // Check if it's the pg-promise formatting error (happens around 255MB)
        isPgPromiseFormattingError = !!(
          error.message?.includes('Invalid string length') &&
          (error.stack?.includes('pg-promise') || error.stack?.includes('formatting.js'))
        );
      }
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_PERSIST_WORKFLOW_SNAPSHOT_FAILED',
          text: isPgPromiseFormattingError
            ? 'Database query formatting failed - payload exceeds pg-promise limit (~255MB)'
            : 'Database insert failed',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            workflowName,
            runId,
            payloadSizeMB: Math.round(snapshotString.length / 1024 / 1024),
          },
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
      const result = await this.operations.load<{ snapshot: WorkflowRunState }>({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        keys: { workflow_name: workflowName, run_id: runId },
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

  async getWorkflowRunById({
    runId,
    workflowName,
  }: {
    runId: string;
    workflowName?: string;
  }): Promise<WorkflowRun | null> {
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (runId) {
        conditions.push(`run_id = $${paramIndex}`);
        values.push(runId);
        paramIndex++;
      }

      if (workflowName) {
        conditions.push(`workflow_name = $${paramIndex}`);
        values.push(workflowName);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get results
      const query = `
          SELECT * FROM ${getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: this.schema })}
          ${whereClause}
          ORDER BY "createdAt" DESC LIMIT 1
        `;

      const queryValues = values;

      const result = await this.client.oneOrNone(query, queryValues);

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
            workflowName: workflowName || '',
          },
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
      const values: any[] = [];
      let paramIndex = 1;

      if (workflowName) {
        conditions.push(`workflow_name = $${paramIndex}`);
        values.push(workflowName);
        paramIndex++;
      }

      if (resourceId) {
        const hasResourceId = await this.operations.hasColumn(TABLE_WORKFLOW_SNAPSHOT, 'resourceId');
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
        values.push(fromDate);
        paramIndex++;
      }

      if (toDate) {
        conditions.push(`"createdAt" <= $${paramIndex}`);
        values.push(toDate);
        paramIndex++;
      }
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      let total = 0;
      // Only get total count when using pagination
      if (limit !== undefined && offset !== undefined) {
        const countResult = await this.client.one(
          `SELECT COUNT(*) as count FROM ${getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: this.schema })} ${whereClause}`,
          values,
        );
        total = Number(countResult.count);
      }

      // Get results
      const query = `
          SELECT * FROM ${getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: this.schema })}
          ${whereClause}
          ORDER BY "createdAt" DESC
          ${limit !== undefined && offset !== undefined ? ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}` : ''}
        `;

      const queryValues = limit !== undefined && offset !== undefined ? [...values, limit, offset] : values;

      const result = await this.client.manyOrNone(query, queryValues);

      const runs = (result || []).map(row => {
        return parseWorkflowRun(row);
      });

      // Use runs.length as total when not paginating
      return { runs, total: total || runs.length };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_GET_WORKFLOW_RUNS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            workflowName: workflowName || 'all',
          },
        },
        error,
      );
    }
  }
}
