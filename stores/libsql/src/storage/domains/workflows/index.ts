import type { Client, InValue } from '@libsql/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { WorkflowRun, WorkflowRuns } from '@mastra/core/storage';
import { TABLE_WORKFLOW_SNAPSHOT, WorkflowsStorage } from '@mastra/core/storage';
import type { WorkflowRunState, StepResult } from '@mastra/core/workflows';
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
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;

  constructor({
    operations,
    client,
    maxRetries = 5,
    initialBackoffMs = 500,
  }: {
    operations: StoreOperationsLibSQL;
    client: Client;
    maxRetries?: number;
    initialBackoffMs?: number;
  }) {
    super();
    this.operations = operations;
    this.client = client;
    this.maxRetries = maxRetries;
    this.initialBackoffMs = initialBackoffMs;

    // Set PRAGMA settings to help with database locks
    // Note: This is async but we can't await in constructor, so we'll handle it as a fire-and-forget
    this.setupPragmaSettings().catch(err =>
      this.logger.warn('LibSQL Workflows: Failed to setup PRAGMA settings.', err),
    );
  }

  private async setupPragmaSettings() {
    try {
      // Set busy timeout to wait longer before returning busy errors
      await this.client.execute('PRAGMA busy_timeout = 10000;');
      this.logger.debug('LibSQL Workflows: PRAGMA busy_timeout=10000 set.');

      // Enable WAL mode for better concurrency (if supported)
      try {
        await this.client.execute('PRAGMA journal_mode = WAL;');
        this.logger.debug('LibSQL Workflows: PRAGMA journal_mode=WAL set.');
      } catch {
        this.logger.debug('LibSQL Workflows: WAL mode not supported, using default journal mode.');
      }

      // Set synchronous mode for better durability vs performance trade-off
      try {
        await this.client.execute('PRAGMA synchronous = NORMAL;');
        this.logger.debug('LibSQL Workflows: PRAGMA synchronous=NORMAL set.');
      } catch {
        this.logger.debug('LibSQL Workflows: Failed to set synchronous mode.');
      }
    } catch (err) {
      this.logger.warn('LibSQL Workflows: Failed to set PRAGMA settings.', err);
    }
  }

  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let attempts = 0;
    let backoff = this.initialBackoffMs;

    while (attempts < this.maxRetries) {
      try {
        return await operation();
      } catch (error: any) {
        // Log the error details for debugging
        this.logger.debug('LibSQL Workflows: Error caught in retry loop', {
          errorType: error.constructor.name,
          errorCode: error.code,
          errorMessage: error.message,
          attempts,
          maxRetries: this.maxRetries,
        });

        // Check for various database lock/busy conditions
        const isLockError =
          error.code === 'SQLITE_BUSY' ||
          error.code === 'SQLITE_LOCKED' ||
          error.message?.toLowerCase().includes('database is locked') ||
          error.message?.toLowerCase().includes('database table is locked') ||
          error.message?.toLowerCase().includes('table is locked') ||
          (error.constructor.name === 'SqliteError' && error.message?.toLowerCase().includes('locked'));

        if (isLockError) {
          attempts++;
          if (attempts >= this.maxRetries) {
            this.logger.error(
              `LibSQL Workflows: Operation failed after ${this.maxRetries} attempts due to database lock: ${error.message}`,
              { error, attempts, maxRetries: this.maxRetries },
            );
            throw error;
          }
          this.logger.warn(
            `LibSQL Workflows: Attempt ${attempts} failed due to database lock. Retrying in ${backoff}ms...`,
            { errorMessage: error.message, attempts, backoff, maxRetries: this.maxRetries },
          );
          await new Promise(resolve => setTimeout(resolve, backoff));
          backoff *= 2;
        } else {
          // Not a lock error, re-throw immediately
          this.logger.error('LibSQL Workflows: Non-lock error occurred, not retrying', { error });
          throw error;
        }
      }
    }
    throw new Error('LibSQL Workflows: Max retries reached, but no error was re-thrown from the loop.');
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
    return this.executeWithRetry(async () => {
      // Use a transaction to ensure atomicity
      const tx = await this.client.transaction('write');
      try {
        // Load existing snapshot within transaction
        const existingSnapshotResult = await tx.execute({
          sql: `SELECT snapshot FROM ${TABLE_WORKFLOW_SNAPSHOT} WHERE workflow_name = ? AND run_id = ?`,
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
            serializedStepGraph: [],
            value: {},
            waitingPaths: {},
            status: 'pending',
            runId: runId,
            runtimeContext: {},
          } as WorkflowRunState;
        } else {
          // Parse existing snapshot
          const existingSnapshot = existingSnapshotResult.rows[0].snapshot;
          snapshot = typeof existingSnapshot === 'string' ? JSON.parse(existingSnapshot) : existingSnapshot;
        }

        // Merge the new step result and runtime context
        snapshot.context[stepId] = result;
        snapshot.runtimeContext = { ...snapshot.runtimeContext, ...runtimeContext };

        // Update the snapshot within the same transaction
        await tx.execute({
          sql: `UPDATE ${TABLE_WORKFLOW_SNAPSHOT} SET snapshot = ? WHERE workflow_name = ? AND run_id = ?`,
          args: [JSON.stringify(snapshot), workflowName, runId],
        });

        await tx.commit();
        return snapshot.context;
      } catch (error) {
        if (!tx.closed) {
          await tx.rollback();
        }
        throw error;
      }
    });
  }

  async updateWorkflowState({
    workflowName,
    runId,
    opts,
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
  }): Promise<WorkflowRunState | undefined> {
    return this.executeWithRetry(async () => {
      // Use a transaction to ensure atomicity
      const tx = await this.client.transaction('write');
      try {
        // Load existing snapshot within transaction
        const existingSnapshotResult = await tx.execute({
          sql: `SELECT snapshot FROM ${TABLE_WORKFLOW_SNAPSHOT} WHERE workflow_name = ? AND run_id = ?`,
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
          sql: `UPDATE ${TABLE_WORKFLOW_SNAPSHOT} SET snapshot = ? WHERE workflow_name = ? AND run_id = ?`,
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
    });
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
