import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  normalizePerPage,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_SCHEMAS,
  WorkflowsStorage,
  createStorageErrorId,
} from '@mastra/core/storage';
import type {
  UpdateWorkflowStateOptions,
  StorageListWorkflowRunsInput,
  WorkflowRun,
  WorkflowRuns,
  CreateIndexOptions,
} from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import { PgDB, resolvePgConfig, generateTableSQL } from '../../db';
import type { PgDomainConfig } from '../../db';

function getSchemaName(schema?: string) {
  return schema ? `"${schema}"` : '"public"';
}

function getTableName({ indexName, schemaName }: { indexName: string; schemaName?: string }) {
  const quotedIndexName = `"${indexName}"`;
  return schemaName ? `${schemaName}.${quotedIndexName}` : quotedIndexName;
}

/**
 * Sanitizes JSON string by removing problematic Unicode sequences that PostgreSQL jsonb rejects.
 * Removes:
 * - \u0000 (null character) - causes error 22P05 "unsupported Unicode escape sequence"
 * - \uD800-\uDFFF (unpaired surrogates) - causes "Unicode low surrogate must follow a high surrogate"
 */
function sanitizeJsonForPg(jsonString: string): string {
  return jsonString.replace(/\\u(0000|[Dd][89A-Fa-f][0-9A-Fa-f]{2})/g, '');
}

export class WorkflowsPG extends WorkflowsStorage {
  #db: PgDB;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  /** Tables managed by this domain */
  static readonly MANAGED_TABLES = [TABLE_WORKFLOW_SNAPSHOT] as const;

  constructor(config: PgDomainConfig) {
    super();
    const { client, schemaName, skipDefaultIndexes, indexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
    this.#skipDefaultIndexes = skipDefaultIndexes;
    // Filter indexes to only those for tables managed by this domain
    this.#indexes = indexes?.filter(idx => (WorkflowsPG.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  supportsConcurrentUpdates(): boolean {
    return true;
  }

  private parseWorkflowRun(row: Record<string, any>): WorkflowRun {
    let parsedSnapshot: WorkflowRunState | string = row.snapshot as string;
    if (typeof parsedSnapshot === 'string') {
      try {
        parsedSnapshot = JSON.parse(row.snapshot as string) as WorkflowRunState;
      } catch (e) {
        this.logger.warn(`Failed to parse snapshot for workflow ${row.workflow_name}: ${e}`);
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

  /**
   * Returns all DDL statements for this domain: table with unique constraint.
   * Used by exportSchemas to produce a complete, reproducible schema export.
   */
  static getExportDDL(schemaName?: string): string[] {
    const statements: string[] = [];

    // Table (includes the UNIQUE constraint on workflow_name, run_id via generateTableSQL)
    statements.push(
      generateTableSQL({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT],
        schemaName,
        includeAllConstraints: true,
      }),
    );

    return statements;
  }

  /**
   * Returns default index definitions for the workflows domain tables.
   * Currently no default indexes are defined for workflows.
   */
  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [];
  }

  /**
   * Creates default indexes for optimal query performance.
   * Currently no default indexes are defined for workflows.
   */
  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) {
      return;
    }
    // No default indexes for workflows domain
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_WORKFLOW_SNAPSHOT, schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT] });
    await this.#db.alterTable({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT],
      ifNotExists: ['resourceId'],
    });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  /**
   * Creates custom user-defined indexes for this domain's tables.
   */
  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) {
      return;
    }

    for (const indexDef of this.#indexes) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        // Log but continue - indexes are performance optimizations
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
  }

  async updateWorkflowResults({
    workflowName,
    runId,
    stepId,
    result,
    requestContext,
  }: {
    workflowName: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    requestContext: Record<string, any>;
  }): Promise<Record<string, StepResult<any, any, any, any>>> {
    try {
      // Use a transaction with row-level locking to ensure atomicity
      return await this.#db.client.tx(async t => {
        const tableName = getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.#schema) });

        // Load existing snapshot within transaction with FOR UPDATE to lock the row
        // This prevents concurrent updates from reading stale data
        const existingSnapshotResult = await t.oneOrNone<{ snapshot: WorkflowRunState }>(
          `SELECT snapshot FROM ${tableName} WHERE workflow_name = $1 AND run_id = $2 FOR UPDATE`,
          [workflowName, runId],
        );

        let snapshot: WorkflowRunState;
        if (!existingSnapshotResult) {
          // Create new snapshot if none exists
          snapshot = {
            context: {},
            activePaths: [],
            timestamp: Date.now(),
            suspendedPaths: {},
            activeStepsPath: {},
            resumeLabels: {},
            serializedStepGraph: [],
            status: 'pending',
            value: {},
            waitingPaths: {},
            runId: runId,
            requestContext: {},
          } as WorkflowRunState;
        } else {
          // Parse existing snapshot
          const existingSnapshot = existingSnapshotResult.snapshot;
          snapshot = typeof existingSnapshot === 'string' ? JSON.parse(existingSnapshot) : existingSnapshot;
        }

        // Merge the new step result and request context
        snapshot.context[stepId] = result;
        snapshot.requestContext = { ...snapshot.requestContext, ...requestContext };

        // Upsert the snapshot within the same transaction
        const now = new Date();
        const sanitizedSnapshot = sanitizeJsonForPg(JSON.stringify(snapshot));
        await t.none(
          `INSERT INTO ${tableName} (workflow_name, run_id, snapshot, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (workflow_name, run_id) DO UPDATE
           SET snapshot = $3, "updatedAt" = $5`,
          [workflowName, runId, sanitizedSnapshot, now, now],
        );

        return snapshot.context;
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'UPDATE_WORKFLOW_RESULTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            workflowName,
            runId,
            stepId,
          },
        },
        error,
      );
    }
  }
  async updateWorkflowState({
    workflowName,
    runId,
    opts,
  }: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
  }): Promise<WorkflowRunState | undefined> {
    try {
      // Use a transaction with row-level locking to ensure atomicity
      return await this.#db.client.tx(async t => {
        const tableName = getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.#schema) });

        // Load existing snapshot within transaction with FOR UPDATE to lock the row
        // This prevents concurrent updates from reading stale data
        const existingSnapshotResult = await t.oneOrNone<{ snapshot: WorkflowRunState }>(
          `SELECT snapshot FROM ${tableName} WHERE workflow_name = $1 AND run_id = $2 FOR UPDATE`,
          [workflowName, runId],
        );

        if (!existingSnapshotResult) {
          return undefined;
        }

        // Parse existing snapshot
        const existingSnapshot = existingSnapshotResult.snapshot;
        const snapshot = typeof existingSnapshot === 'string' ? JSON.parse(existingSnapshot) : existingSnapshot;

        if (!snapshot || !snapshot?.context) {
          throw new Error(`Snapshot not found for runId ${runId}`);
        }

        // Merge the new options with the existing snapshot
        const updatedSnapshot = { ...snapshot, ...opts };

        // Update the snapshot within the same transaction
        const sanitizedSnapshot = sanitizeJsonForPg(JSON.stringify(updatedSnapshot));
        await t.none(
          `UPDATE ${tableName} SET snapshot = $1, "updatedAt" = $2 WHERE workflow_name = $3 AND run_id = $4`,
          [sanitizedSnapshot, new Date(), workflowName, runId],
        );

        return updatedSnapshot;
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'UPDATE_WORKFLOW_STATE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            workflowName,
            runId,
          },
        },
        error,
      );
    }
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
      const now = new Date();
      const createdAtValue = createdAt ? createdAt : now;
      const updatedAtValue = updatedAt ? updatedAt : now;
      // Sanitize the snapshot JSON to remove problematic Unicode sequences
      const sanitizedSnapshot = sanitizeJsonForPg(JSON.stringify(snapshot));
      await this.#db.client.none(
        `INSERT INTO ${getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.#schema) })} (workflow_name, run_id, "resourceId", snapshot, "createdAt", "updatedAt")
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (workflow_name, run_id) DO UPDATE
                 SET "resourceId" = $3, snapshot = $4, "updatedAt" = $6`,
        [workflowName, runId, resourceId, sanitizedSnapshot, createdAtValue, updatedAtValue],
      );
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'PERSIST_WORKFLOW_SNAPSHOT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
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
      const result = await this.#db.load<{ snapshot: WorkflowRunState }>({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        keys: { workflow_name: workflowName, run_id: runId },
      });

      return result ? result.snapshot : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LOAD_WORKFLOW_SNAPSHOT', 'FAILED'),
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

      const query = `
          SELECT * FROM ${getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.#schema) })}
          ${whereClause}
          ORDER BY "createdAt" DESC LIMIT 1
        `;

      const queryValues = values;

      const result = await this.#db.client.oneOrNone(query, queryValues);

      if (!result) {
        return null;
      }

      return this.parseWorkflowRun(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_WORKFLOW_RUN_BY_ID', 'FAILED'),
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

  async deleteWorkflowRunById({ runId, workflowName }: { runId: string; workflowName: string }): Promise<void> {
    try {
      await this.#db.client.none(
        `DELETE FROM ${getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.#schema) })} WHERE run_id = $1 AND workflow_name = $2`,
        [runId, workflowName],
      );
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_WORKFLOW_RUN_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            runId,
            workflowName,
          },
        },
        error,
      );
    }
  }

  async listWorkflowRuns({
    workflowName,
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

      if (workflowName) {
        conditions.push(`workflow_name = $${paramIndex}`);
        values.push(workflowName);
        paramIndex++;
      }

      if (status) {
        // Use regexp_replace to strip problematic Unicode escape sequences before casting to jsonb.
        // PostgreSQL's jsonb cast fails on:
        // - \u0000 (null character) with error 22P05 "unsupported Unicode escape sequence"
        // - \uD800-\uDFFF (unpaired surrogates) with "Unicode low surrogate must follow a high surrogate"
        // The regex pattern matches \u0000 and all surrogate code points (D800-DFFF).
        // See: https://github.com/mastra-ai/mastra/issues/11563
        conditions.push(
          `regexp_replace(snapshot::text, '\\\\u(0000|[Dd][89A-Fa-f][0-9A-Fa-f]{2})', '', 'g')::jsonb ->> 'status' = $${paramIndex}`,
        );
        values.push(status);
        paramIndex++;
      }

      if (resourceId) {
        const hasResourceId = await this.#db.hasColumn(TABLE_WORKFLOW_SNAPSHOT, 'resourceId');
        if (hasResourceId) {
          conditions.push(`"resourceId" = $${paramIndex}`);
          values.push(resourceId);
          paramIndex++;
        } else {
          this.logger?.warn?.(`[${TABLE_WORKFLOW_SNAPSHOT}] resourceId column not found. Skipping resourceId filter.`);
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
      const usePagination = typeof perPage === 'number' && typeof page === 'number';
      if (usePagination) {
        const countResult = await this.#db.client.one(
          `SELECT COUNT(*) as count FROM ${getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.#schema) })} ${whereClause}`,
          values,
        );
        total = Number(countResult.count);
      }

      const normalizedPerPage = usePagination ? normalizePerPage(perPage, Number.MAX_SAFE_INTEGER) : 0;
      const offset = usePagination ? page! * normalizedPerPage : undefined;

      const query = `
          SELECT * FROM ${getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.#schema) })}
          ${whereClause}
          ORDER BY "createdAt" DESC
          ${usePagination ? ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}` : ''}
        `;

      const queryValues = usePagination ? [...values, normalizedPerPage, offset] : values;

      const result = await this.#db.client.manyOrNone(query, queryValues);

      const runs = (result || []).map(row => {
        return this.parseWorkflowRun(row);
      });

      return { runs, total: total || runs.length };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_WORKFLOW_RUNS', 'FAILED'),
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
