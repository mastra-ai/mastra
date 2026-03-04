import type { Client, InValue } from '@libsql/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type {
  WorkflowRun,
  WorkflowRuns,
  StorageListWorkflowRunsInput,
  UpdateWorkflowStateOptions,
} from '@mastra/core/storage';
import {
  createStorageErrorId,
  normalizePerPage,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_SCHEMAS,
  WorkflowsStorage,
} from '@mastra/core/storage';
import type { WorkflowRunState, StepResult } from '@mastra/core/workflows';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import { createExecuteWriteOperationWithRetry } from '../../db/utils';

export class WorkflowsLibSQL extends WorkflowsStorage {
  #db: LibSQLDB;
  #client: Client;
  private readonly executeWithRetry: <T>(operationFn: () => Promise<T>, operationDescription: string) => Promise<T>;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    const maxRetries = config.maxRetries ?? 5;
    const initialBackoffMs = config.initialBackoffMs ?? 500;

    this.#client = client;
    this.#db = new LibSQLDB({ client, maxRetries, initialBackoffMs });
    this.executeWithRetry = createExecuteWriteOperationWithRetry({
      logger: this.logger,
      maxRetries,
      initialBackoffMs,
    });

    // Set PRAGMA settings to help with database locks
    // Note: This is async but we can't await in constructor, so we'll handle it as a fire-and-forget
    this.setupPragmaSettings().catch(err =>
      this.logger.warn('LibSQL Workflows: Failed to setup PRAGMA settings.', err),
    );
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
      createdAt: new Date(row.createdAt as string),
      updatedAt: new Date(row.updatedAt as string),
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
    await this.#db.deleteData({ tableName: TABLE_WORKFLOW_SNAPSHOT });
  }

  private async setupPragmaSettings() {
    try {
      // Set busy timeout to wait longer before returning busy errors
      await this.#client.execute('PRAGMA busy_timeout = 10000;');
      this.logger.debug('LibSQL Workflows: PRAGMA busy_timeout=10000 set.');

      // Enable WAL mode for better concurrency (if supported)
      try {
        await this.#client.execute('PRAGMA journal_mode = WAL;');
        this.logger.debug('LibSQL Workflows: PRAGMA journal_mode=WAL set.');
      } catch {
        this.logger.debug('LibSQL Workflows: WAL mode not supported, using default journal mode.');
      }

      // Set synchronous mode for better durability vs performance trade-off
      try {
        await this.#client.execute('PRAGMA synchronous = NORMAL;');
        this.logger.debug('LibSQL Workflows: PRAGMA synchronous=NORMAL set.');
      } catch {
        this.logger.debug('LibSQL Workflows: Failed to set synchronous mode.');
      }
    } catch (err) {
      this.logger.warn('LibSQL Workflows: Failed to set PRAGMA settings.', err);
    }
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
    return this.executeWithRetry(async () => {
      // Use a transaction to ensure atomicity
      const tx = await this.#client.transaction('write');
      try {
        // Load existing snapshot within transaction
        const existingSnapshotResult = await tx.execute({
          sql: `SELECT json(snapshot) as snapshot FROM ${TABLE_WORKFLOW_SNAPSHOT} WHERE workflow_name = ? AND run_id = ?`,
          args: [workflowName, runId],
        });

        let snapshot: WorkflowRunState;
        if (!existingSnapshotResult.rows?.[0]) {
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
          const existingSnapshot = existingSnapshotResult.rows[0].snapshot;
          snapshot = typeof existingSnapshot === 'string' ? JSON.parse(existingSnapshot) : existingSnapshot;
        }

        // Merge the new step result and request context
        snapshot.context[stepId] = result;
        snapshot.requestContext = { ...snapshot.requestContext, ...requestContext };

        // Upsert the snapshot within the same transaction
        const now = new Date().toISOString();
        await tx.execute({
          sql: `INSERT INTO ${TABLE_WORKFLOW_SNAPSHOT} (workflow_name, run_id, snapshot, createdAt, updatedAt)
                VALUES (?, ?, jsonb(?), ?, ?)
                ON CONFLICT(workflow_name, run_id)
                DO UPDATE SET snapshot = excluded.snapshot, updatedAt = excluded.updatedAt`,
          args: [workflowName, runId, JSON.stringify(snapshot), now, now],
        });

        await tx.commit();
        return snapshot.context;
      } catch (error) {
        if (!tx.closed) {
          await tx.rollback();
        }
        throw error;
      }
    }, 'updateWorkflowResults');
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
    return this.executeWithRetry(async () => {
      // Use a transaction to ensure atomicity
      const tx = await this.#client.transaction('write');
      try {
        // Load existing snapshot within transaction
        const existingSnapshotResult = await tx.execute({
          sql: `SELECT json(snapshot) as snapshot FROM ${TABLE_WORKFLOW_SNAPSHOT} WHERE workflow_name = ? AND run_id = ?`,
          args: [workflowName, runId],
        });

        if (!existingSnapshotResult.rows?.[0]) {
          await tx.rollback();
          return undefined;
        }

        // Parse existing snapshot
        const existingSnapshot = existingSnapshotResult.rows[0].snapshot;
        const snapshot = typeof existingSnapshot === 'string' ? JSON.parse(existingSnapshot) : existingSnapshot;

        if (!snapshot || !snapshot?.context) {
          await tx.rollback();
          throw new Error(`Snapshot not found for runId ${runId}`);
        }

        // Merge the new options with the existing snapshot
        const updatedSnapshot = { ...snapshot, ...opts };

        // Update the snapshot within the same transaction
        await tx.execute({
          sql: `UPDATE ${TABLE_WORKFLOW_SNAPSHOT} SET snapshot = jsonb(?) WHERE workflow_name = ? AND run_id = ?`,
          args: [JSON.stringify(updatedSnapshot), workflowName, runId],
        });

        await tx.commit();
        return updatedSnapshot;
      } catch (error) {
        if (!tx.closed) {
          await tx.rollback();
        }
        throw error;
      }
    }, 'updateWorkflowState');
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
  }) {
    const now = new Date();
    const data = {
      workflow_name: workflowName,
      run_id: runId,
      resourceId,
      snapshot,
      createdAt: createdAt ?? now,
      updatedAt: updatedAt ?? now,
    };

    this.logger.debug('Persisting workflow snapshot', { workflowName, runId, data });
    await this.#db.insert({
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
    const d = await this.#db.select<{ snapshot: WorkflowRunState }>({
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
      const result = await this.#client.execute({
        sql: `SELECT workflow_name, run_id, resourceId, json(snapshot) as snapshot, createdAt, updatedAt FROM ${TABLE_WORKFLOW_SNAPSHOT} ${whereClause} ORDER BY createdAt DESC LIMIT 1`,
        args,
      });

      if (!result.rows?.[0]) {
        return null;
      }

      return this.parseWorkflowRun(result.rows[0]);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_WORKFLOW_RUN_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteWorkflowRunById({ runId, workflowName }: { runId: string; workflowName: string }): Promise<void> {
    return this.executeWithRetry(async () => {
      try {
        await this.#client.execute({
          sql: `DELETE FROM ${TABLE_WORKFLOW_SNAPSHOT} WHERE workflow_name = ? AND run_id = ?`,
          args: [workflowName, runId],
        });
      } catch (error) {
        throw new MastraError(
          {
            id: createStorageErrorId('LIBSQL', 'DELETE_WORKFLOW_RUN_BY_ID', 'FAILED'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.THIRD_PARTY,
            details: { runId, workflowName },
          },
          error,
        );
      }
    }, 'deleteWorkflowRunById');
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
    try {
      const conditions: string[] = [];
      const args: InValue[] = [];

      if (workflowName) {
        conditions.push('workflow_name = ?');
        args.push(workflowName);
      }

      if (status) {
        conditions.push("json_extract(snapshot, '$.status') = ?");
        args.push(status);
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
        const hasResourceId = await this.#db.hasColumn(TABLE_WORKFLOW_SNAPSHOT, 'resourceId');
        if (hasResourceId) {
          conditions.push('resourceId = ?');
          args.push(resourceId);
        } else {
          this.logger.warn(`[${TABLE_WORKFLOW_SNAPSHOT}] resourceId column not found. Skipping resourceId filter.`);
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      let total = 0;
      // Only get total count when using pagination
      const usePagination = typeof perPage === 'number' && typeof page === 'number';
      if (usePagination) {
        const countResult = await this.#client.execute({
          sql: `SELECT COUNT(*) as count FROM ${TABLE_WORKFLOW_SNAPSHOT} ${whereClause}`,
          args,
        });
        total = Number(countResult.rows?.[0]?.count ?? 0);
      }

      // Get results
      const normalizedPerPage = usePagination ? normalizePerPage(perPage, Number.MAX_SAFE_INTEGER) : 0;
      const offset = usePagination ? page! * normalizedPerPage : 0;
      const result = await this.#client.execute({
        sql: `SELECT workflow_name, run_id, resourceId, json(snapshot) as snapshot, createdAt, updatedAt FROM ${TABLE_WORKFLOW_SNAPSHOT} ${whereClause} ORDER BY createdAt DESC${usePagination ? ` LIMIT ? OFFSET ?` : ''}`,
        args: usePagination ? [...args, normalizedPerPage, offset] : args,
      });

      const runs = (result.rows || []).map(row => this.parseWorkflowRun(row));

      // Use runs.length as total when not paginating
      return { runs, total: total || runs.length };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_WORKFLOW_RUNS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
