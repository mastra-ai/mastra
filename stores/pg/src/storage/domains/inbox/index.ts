import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  TaskStatus,
  TaskPriority,
  type Task,
  type CreateTaskInput,
  type ListFilter,
  type InboxStats,
  type SuspendTaskInput,
  type ResumeTaskInput,
} from '@mastra/core/inbox';
import { DEFAULT_MAX_ATTEMPTS, DEFAULT_PRIORITY, DEFAULT_CLAIM_TIMEOUT } from '@mastra/core/inbox';
import { calculateBackoff, generateTaskId } from '@mastra/core/inbox';
import {
  InboxStorage,
  type ClaimTaskParams,
  type FailTaskParams,
  type DeleteTasksParams,
  createStorageErrorId,
  TABLE_INBOX_TASKS,
  INBOX_TASKS_SCHEMA,
  type CreateIndexOptions,
} from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';
import { PgDB, resolvePgConfig } from '../../db';
import type { PgDomainConfig } from '../../db';

function getSchemaName(schema?: string) {
  return schema ? `"${schema}"` : '"public"';
}

function getTableName({ indexName, schemaName }: { indexName: string; schemaName?: string }) {
  const quotedIndexName = `"${indexName}"`;
  return schemaName ? `${schemaName}.${quotedIndexName}` : quotedIndexName;
}

export class InboxPG extends InboxStorage {
  #db: PgDB;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  /** Tables managed by this domain */
  static readonly MANAGED_TABLES = [TABLE_INBOX_TASKS] as const;

  constructor(config: PgDomainConfig) {
    super();
    const { client, schemaName, skipDefaultIndexes, indexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
    this.#skipDefaultIndexes = skipDefaultIndexes;
    // Filter indexes to only those for tables managed by this domain
    this.#indexes = indexes?.filter(idx => (InboxPG.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_INBOX_TASKS, schema: INBOX_TASKS_SCHEMA });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_INBOX_TASKS });
  }

  /**
   * Returns default index definitions for the inbox domain tables.
   */
  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    const schemaPrefix = this.#schema !== 'public' ? `${this.#schema}_` : '';
    return [
      {
        name: `${schemaPrefix}mastra_inbox_tasks_inbox_status_priority_idx`,
        table: TABLE_INBOX_TASKS,
        columns: ['inboxId', 'status', 'priority DESC', 'createdAt ASC'],
      },
      {
        name: `${schemaPrefix}mastra_inbox_tasks_inbox_sourceid_idx`,
        table: TABLE_INBOX_TASKS,
        columns: ['inboxId', 'sourceId'],
      },
      {
        name: `${schemaPrefix}mastra_inbox_tasks_claimedby_idx`,
        table: TABLE_INBOX_TASKS,
        columns: ['claimedBy'],
      },
    ];
  }

  /**
   * Creates default indexes for optimal query performance.
   */
  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) {
      return;
    }

    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        // Log but continue - indexes are performance optimizations
        this.logger?.warn?.(`Failed to create index ${indexDef.name}:`, error);
      }
    }
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

  private parseTaskRow(row: Record<string, any>): Task {
    // Helper to convert null to undefined for optional fields
    const nullToUndefined = <T>(value: T | null): T | undefined => (value === null ? undefined : value);

    // Parse JSON fields
    const parseJson = (value: unknown): unknown => {
      if (value === null || value === undefined) return undefined;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return value;
    };

    return {
      id: row.id as string,
      inboxId: row.inboxId as string,
      type: row.type as string,
      status: row.status as TaskStatus,
      priority: row.priority as TaskPriority,
      title: nullToUndefined(row.title) as string | undefined,
      sourceId: nullToUndefined(row.sourceId) as string | undefined,
      sourceUrl: nullToUndefined(row.sourceUrl) as string | undefined,
      payload: parseJson(row.payload),
      result: row.result ? parseJson(row.result) : undefined,
      error: row.error ? (parseJson(row.error) as { message: string; stack?: string; retryable?: boolean }) : undefined,
      targetAgentId: nullToUndefined(row.targetAgentId) as string | undefined,
      claimedBy: nullToUndefined(row.claimedBy) as string | undefined,
      runId: nullToUndefined(row.runId) as string | undefined,
      createdAt: row.createdAtZ ? new Date(row.createdAtZ) : new Date(row.createdAt),
      claimedAt: row.claimedAt ? new Date(row.claimedAtZ || row.claimedAt) : undefined,
      claimExpiresAt: row.claimExpiresAt ? new Date(row.claimExpiresAtZ || row.claimExpiresAt) : undefined,
      startedAt: row.startedAt ? new Date(row.startedAtZ || row.startedAt) : undefined,
      completedAt: row.completedAt ? new Date(row.completedAtZ || row.completedAt) : undefined,
      attempts: row.attempts as number,
      maxAttempts: row.maxAttempts as number,
      nextRetryAt: row.nextRetryAt ? new Date(row.nextRetryAtZ || row.nextRetryAt) : undefined,
      suspendedAt: row.suspendedAt ? new Date(row.suspendedAtZ || row.suspendedAt) : undefined,
      suspendPayload: row.suspendPayload ? parseJson(row.suspendPayload) : undefined,
      resumePayload: row.resumePayload ? parseJson(row.resumePayload) : undefined,
      metadata: row.metadata ? (parseJson(row.metadata) as Record<string, unknown>) : undefined,
    };
  }

  async createTask<TPayload = unknown>(inboxId: string, input: CreateTaskInput<TPayload>): Promise<Task<TPayload>> {
    try {
      const now = new Date();
      const taskId = input.id ?? generateTaskId();

      const record = {
        id: taskId,
        inboxId,
        type: input.type,
        status: TaskStatus.PENDING,
        priority: input.priority ?? DEFAULT_PRIORITY,
        title: input.title ?? null,
        sourceId: input.sourceId ?? null,
        sourceUrl: input.sourceUrl ?? null,
        payload: input.payload,
        result: null,
        error: null,
        targetAgentId: input.targetAgentId ?? null,
        claimedBy: null,
        runId: null,
        createdAt: now,
        claimedAt: null,
        claimExpiresAt: null,
        startedAt: null,
        completedAt: null,
        attempts: 0,
        maxAttempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
        nextRetryAt: null,
        suspendedAt: null,
        suspendPayload: null,
        resumePayload: null,
        metadata: input.metadata ?? null,
      };

      await this.#db.insert({ tableName: TABLE_INBOX_TASKS, record });

      return {
        id: taskId,
        inboxId,
        type: input.type,
        status: TaskStatus.PENDING,
        priority: input.priority ?? DEFAULT_PRIORITY,
        title: input.title,
        sourceId: input.sourceId,
        sourceUrl: input.sourceUrl,
        payload: input.payload,
        targetAgentId: input.targetAgentId,
        createdAt: now,
        attempts: 0,
        maxAttempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
        metadata: input.metadata,
      } as Task<TPayload>;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'CREATE_TASK', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getTaskById(taskId: string): Promise<Task | null> {
    try {
      const tableName = getTableName({ indexName: TABLE_INBOX_TASKS, schemaName: getSchemaName(this.#schema) });
      const result = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE id = $1`, [taskId]);
      return result ? this.parseTaskRow(result) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_TASK', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async updateTask(taskId: string, updates: Partial<Pick<Task, 'runId' | 'metadata'>>): Promise<Task> {
    try {
      const task = await this.getTaskById(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.runId !== undefined) {
        setClauses.push(`"runId" = $${paramIndex++}`);
        values.push(updates.runId);
      }

      if (updates.metadata !== undefined) {
        const mergedMetadata = { ...task.metadata, ...updates.metadata };
        setClauses.push(`metadata = $${paramIndex++}`);
        values.push(JSON.stringify(mergedMetadata));
      }

      if (setClauses.length > 0) {
        values.push(taskId);
        const tableName = getTableName({ indexName: TABLE_INBOX_TASKS, schemaName: getSchemaName(this.#schema) });
        await this.#db.client.none(
          `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
          values,
        );
      }

      const updated = await this.getTaskById(taskId);
      return updated!;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'UPDATE_TASK', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    try {
      const tableName = getTableName({ indexName: TABLE_INBOX_TASKS, schemaName: getSchemaName(this.#schema) });
      await this.#db.client.none(`DELETE FROM ${tableName} WHERE id = $1`, [taskId]);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_TASK', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async claimTask(params: ClaimTaskParams): Promise<Task | null> {
    const { inboxId, agentId, filter, claimTimeout = DEFAULT_CLAIM_TIMEOUT } = params;
    const now = new Date();
    const nowIso = now.toISOString();

    try {
      const tableName = getTableName({ indexName: TABLE_INBOX_TASKS, schemaName: getSchemaName(this.#schema) });

      // Build WHERE clause
      const conditions: string[] = ['"inboxId" = $1', 'status = $2'];
      const args: any[] = [inboxId, TaskStatus.PENDING];
      let paramIndex = 3;

      // Skip if not yet ready for retry - use ISO string for timestamp comparison
      conditions.push(`("nextRetryAt" IS NULL OR "nextRetryAt" <= $${paramIndex++}::timestamp)`);
      args.push(nowIso);

      // Check targetAgentId - only claim if it's null or matches this agent
      conditions.push(`("targetAgentId" IS NULL OR "targetAgentId" = $${paramIndex++})`);
      args.push(agentId);

      // Check type filter
      if (filter?.types && filter.types.length > 0) {
        const placeholders = filter.types.map((_, i) => `$${paramIndex + i}`).join(', ');
        conditions.push(`type IN (${placeholders})`);
        args.push(...filter.types);
        paramIndex += filter.types.length;
      }

      // Get highest priority pending task (priority DESC, createdAt ASC)
      // Use FOR UPDATE SKIP LOCKED for concurrent access
      const result = await this.#db.client.oneOrNone(
        `SELECT * FROM ${tableName} WHERE ${conditions.join(' AND ')} ORDER BY priority DESC, "createdAt" ASC LIMIT 1 FOR UPDATE SKIP LOCKED`,
        args,
      );

      if (!result) {
        return null;
      }

      const task = this.parseTaskRow(result);

      // Apply custom filter if provided
      if (filter?.filter && !filter.filter(task)) {
        return null;
      }

      // Claim the task - use ISO strings for timestamps
      const claimExpiresAt = new Date(now.getTime() + claimTimeout);
      const claimExpiresAtIso = claimExpiresAt.toISOString();
      await this.#db.client.none(
        `UPDATE ${tableName} SET status = $1, "claimedBy" = $2, "claimedAt" = $3::timestamp, "claimExpiresAt" = $4::timestamp, "claimedAtZ" = $3::timestamptz, "claimExpiresAtZ" = $4::timestamptz WHERE id = $5`,
        [TaskStatus.CLAIMED, agentId, nowIso, claimExpiresAtIso, task.id],
      );

      return {
        ...task,
        status: TaskStatus.CLAIMED,
        claimedBy: agentId,
        claimedAt: now,
        claimExpiresAt,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'CLAIM_TASK', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async releaseTask(taskId: string): Promise<Task> {
    try {
      const task = await this.getTaskById(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      const tableName = getTableName({ indexName: TABLE_INBOX_TASKS, schemaName: getSchemaName(this.#schema) });
      await this.#db.client.none(
        `UPDATE ${tableName} SET status = $1, "claimedBy" = NULL, "claimedAt" = NULL, "claimExpiresAt" = NULL, "claimedAtZ" = NULL, "claimExpiresAtZ" = NULL WHERE id = $2`,
        [TaskStatus.PENDING, taskId],
      );

      return {
        ...task,
        status: TaskStatus.PENDING,
        claimedBy: undefined,
        claimedAt: undefined,
        claimExpiresAt: undefined,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'RELEASE_TASK', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async releaseExpiredClaims(): Promise<number> {
    const now = new Date();
    const nowIso = now.toISOString();
    try {
      const tableName = getTableName({ indexName: TABLE_INBOX_TASKS, schemaName: getSchemaName(this.#schema) });
      const result = await this.#db.client.query(
        `UPDATE ${tableName} SET status = $1, "claimedBy" = NULL, "claimedAt" = NULL, "claimExpiresAt" = NULL, "claimedAtZ" = NULL, "claimExpiresAtZ" = NULL WHERE status = $2 AND "claimExpiresAt" < $3::timestamp`,
        [TaskStatus.PENDING, TaskStatus.CLAIMED, nowIso],
      );
      return result.rowCount ?? 0;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'RELEASE_EXPIRED_CLAIMS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async startTask(taskId: string): Promise<Task> {
    try {
      const task = await this.getTaskById(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const tableName = getTableName({ indexName: TABLE_INBOX_TASKS, schemaName: getSchemaName(this.#schema) });
      await this.#db.client.none(
        `UPDATE ${tableName} SET status = $1, "startedAt" = $2::timestamp, "startedAtZ" = $2::timestamptz WHERE id = $3`,
        [TaskStatus.IN_PROGRESS, nowIso, taskId],
      );

      return {
        ...task,
        status: TaskStatus.IN_PROGRESS,
        startedAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'START_TASK', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async completeTask(taskId: string, result: unknown): Promise<Task> {
    try {
      const task = await this.getTaskById(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const tableName = getTableName({ indexName: TABLE_INBOX_TASKS, schemaName: getSchemaName(this.#schema) });
      await this.#db.client.none(
        `UPDATE ${tableName} SET status = $1, result = $2, "completedAt" = $3::timestamp, "completedAtZ" = $3::timestamptz WHERE id = $4`,
        [TaskStatus.COMPLETED, JSON.stringify(result), nowIso, taskId],
      );

      return {
        ...task,
        status: TaskStatus.COMPLETED,
        result,
        completedAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'COMPLETE_TASK', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async failTask(params: FailTaskParams): Promise<Task> {
    const { taskId, error, retryConfig } = params;

    try {
      const task = await this.getTaskById(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const newAttempts = task.attempts + 1;
      const maxAttempts = task.maxAttempts;
      const shouldRetry = error.retryable !== false && newAttempts < maxAttempts;

      const tableName = getTableName({ indexName: TABLE_INBOX_TASKS, schemaName: getSchemaName(this.#schema) });

      if (shouldRetry) {
        const backoffMs = calculateBackoff(newAttempts, retryConfig);
        const nextRetryAt = new Date(now.getTime() + backoffMs);
        const nextRetryAtIso = nextRetryAt.toISOString();
        const errorWithRetry = { ...error, retryable: true };

        await this.#db.client.none(
          `UPDATE ${tableName} SET status = $1, attempts = $2, "nextRetryAt" = $3::timestamp, "nextRetryAtZ" = $3::timestamptz, error = $4, "claimedBy" = NULL, "claimedAt" = NULL, "claimExpiresAt" = NULL, "claimedAtZ" = NULL, "claimExpiresAtZ" = NULL WHERE id = $5`,
          [TaskStatus.PENDING, newAttempts, nextRetryAtIso, JSON.stringify(errorWithRetry), taskId],
        );

        return {
          ...task,
          status: TaskStatus.PENDING,
          attempts: newAttempts,
          nextRetryAt,
          error: errorWithRetry,
          claimedBy: undefined,
          claimedAt: undefined,
          claimExpiresAt: undefined,
        };
      } else {
        const errorWithNoRetry = { ...error, retryable: false };

        await this.#db.client.none(
          `UPDATE ${tableName} SET status = $1, attempts = $2, "completedAt" = $3::timestamp, "completedAtZ" = $3::timestamptz, error = $4 WHERE id = $5`,
          [TaskStatus.FAILED, newAttempts, nowIso, JSON.stringify(errorWithNoRetry), taskId],
        );

        return {
          ...task,
          status: TaskStatus.FAILED,
          attempts: newAttempts,
          completedAt: now,
          error: errorWithNoRetry,
        };
      }
    } catch (err) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'FAIL_TASK', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        err,
      );
    }
  }

  async cancelTask(taskId: string): Promise<Task> {
    try {
      const task = await this.getTaskById(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const tableName = getTableName({ indexName: TABLE_INBOX_TASKS, schemaName: getSchemaName(this.#schema) });
      await this.#db.client.none(
        `UPDATE ${tableName} SET status = $1, "completedAt" = $2::timestamp, "completedAtZ" = $2::timestamptz WHERE id = $3`,
        [TaskStatus.CANCELLED, nowIso, taskId],
      );

      return {
        ...task,
        status: TaskStatus.CANCELLED,
        completedAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'CANCEL_TASK', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async suspendTask(taskId: string, input: SuspendTaskInput): Promise<Task> {
    try {
      const task = await this.getTaskById(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      const now = new Date();
      const nowIso = now.toISOString();
      // Store just the payload, not the full input with reason
      const suspendPayload = input.payload;

      const tableName = getTableName({ indexName: TABLE_INBOX_TASKS, schemaName: getSchemaName(this.#schema) });
      await this.#db.client.none(
        `UPDATE ${tableName} SET status = $1, "suspendedAt" = $2::timestamp, "suspendedAtZ" = $2::timestamptz, "suspendPayload" = $3 WHERE id = $4`,
        [TaskStatus.WAITING_FOR_INPUT, nowIso, JSON.stringify(suspendPayload), taskId],
      );

      return {
        ...task,
        status: TaskStatus.WAITING_FOR_INPUT,
        suspendedAt: now,
        suspendPayload,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'SUSPEND_TASK', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async resumeTask(taskId: string, input: ResumeTaskInput): Promise<Task> {
    try {
      const task = await this.getTaskById(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      if (task.status !== TaskStatus.WAITING_FOR_INPUT) {
        throw new Error(`Task ${taskId} is not waiting for input`);
      }

      const tableName = getTableName({ indexName: TABLE_INBOX_TASKS, schemaName: getSchemaName(this.#schema) });
      await this.#db.client.none(`UPDATE ${tableName} SET status = $1, "resumePayload" = $2 WHERE id = $3`, [
        TaskStatus.IN_PROGRESS,
        JSON.stringify(input.payload),
        taskId,
      ]);

      return {
        ...task,
        status: TaskStatus.IN_PROGRESS,
        resumePayload: input.payload,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'RESUME_TASK', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listWaitingTasks(inboxId?: string): Promise<Task[]> {
    try {
      const tableName = getTableName({ indexName: TABLE_INBOX_TASKS, schemaName: getSchemaName(this.#schema) });
      let sql = `SELECT * FROM ${tableName} WHERE status = $1`;
      const args: any[] = [TaskStatus.WAITING_FOR_INPUT];

      if (inboxId) {
        sql += ' AND "inboxId" = $2';
        args.push(inboxId);
      }

      sql += ' ORDER BY priority DESC, "createdAt" ASC';

      const result = await this.#db.client.manyOrNone(sql, args);
      return result.map(row => this.parseTaskRow(row));
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_WAITING_TASKS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listTasks(inboxId: string, filter?: ListFilter): Promise<Task[]> {
    try {
      const tableName = getTableName({ indexName: TABLE_INBOX_TASKS, schemaName: getSchemaName(this.#schema) });
      const conditions: string[] = ['"inboxId" = $1'];
      const args: any[] = [inboxId];
      let paramIndex = 2;

      if (filter?.status) {
        const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
        const placeholders = statuses.map((_, i) => `$${paramIndex + i}`).join(', ');
        conditions.push(`status IN (${placeholders})`);
        args.push(...statuses);
        paramIndex += statuses.length;
      }

      if (filter?.type) {
        const types = Array.isArray(filter.type) ? filter.type : [filter.type];
        const placeholders = types.map((_, i) => `$${paramIndex + i}`).join(', ');
        conditions.push(`type IN (${placeholders})`);
        args.push(...types);
        paramIndex += types.length;
      }

      if (filter?.targetAgentId) {
        conditions.push(`"targetAgentId" = $${paramIndex++}`);
        args.push(filter.targetAgentId);
      }

      if (filter?.claimedBy) {
        conditions.push(`"claimedBy" = $${paramIndex++}`);
        args.push(filter.claimedBy);
      }

      if (filter?.priority !== undefined) {
        conditions.push(`priority = $${paramIndex++}`);
        args.push(filter.priority);
      }

      let sql = `SELECT * FROM ${tableName} WHERE ${conditions.join(' AND ')} ORDER BY priority DESC, "createdAt" ASC`;

      if (filter?.limit) {
        sql += ` LIMIT $${paramIndex++}`;
        args.push(filter.limit);
      }

      if (filter?.offset) {
        sql += ` OFFSET $${paramIndex++}`;
        args.push(filter.offset);
      }

      const result = await this.#db.client.manyOrNone(sql, args);
      return result.map(row => this.parseTaskRow(row));
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_TASKS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getStats(inboxId: string): Promise<InboxStats> {
    try {
      const tableName = getTableName({ indexName: TABLE_INBOX_TASKS, schemaName: getSchemaName(this.#schema) });
      const result = await this.#db.client.manyOrNone(
        `SELECT status, COUNT(*)::int as count FROM ${tableName} WHERE "inboxId" = $1 GROUP BY status`,
        [inboxId],
      );

      const stats: InboxStats = {
        pending: 0,
        claimed: 0,
        inProgress: 0,
        waitingForInput: 0,
        completed: 0,
        failed: 0,
      };

      for (const row of result) {
        const status = row.status as TaskStatus;
        const count = row.count as number;

        switch (status) {
          case TaskStatus.PENDING:
            stats.pending = count;
            break;
          case TaskStatus.CLAIMED:
            stats.claimed = count;
            break;
          case TaskStatus.IN_PROGRESS:
            stats.inProgress = count;
            break;
          case TaskStatus.WAITING_FOR_INPUT:
            stats.waitingForInput = count;
            break;
          case TaskStatus.COMPLETED:
            stats.completed = count;
            break;
          case TaskStatus.FAILED:
          case TaskStatus.CANCELLED:
            stats.failed += count;
            break;
        }
      }

      return stats;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_STATS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getStatsByInbox(): Promise<Record<string, InboxStats>> {
    try {
      const tableName = getTableName({ indexName: TABLE_INBOX_TASKS, schemaName: getSchemaName(this.#schema) });
      const result = await this.#db.client.manyOrNone(
        `SELECT "inboxId", status, COUNT(*)::int as count FROM ${tableName} GROUP BY "inboxId", status`,
      );

      const statsByInbox: Record<string, InboxStats> = {};

      for (const row of result) {
        const inboxId = row.inboxId as string;
        const status = row.status as TaskStatus;
        const count = row.count as number;

        if (!statsByInbox[inboxId]) {
          statsByInbox[inboxId] = {
            pending: 0,
            claimed: 0,
            inProgress: 0,
            waitingForInput: 0,
            completed: 0,
            failed: 0,
          };
        }

        const stats = statsByInbox[inboxId]!;

        switch (status) {
          case TaskStatus.PENDING:
            stats.pending = count;
            break;
          case TaskStatus.CLAIMED:
            stats.claimed = count;
            break;
          case TaskStatus.IN_PROGRESS:
            stats.inProgress = count;
            break;
          case TaskStatus.WAITING_FOR_INPUT:
            stats.waitingForInput = count;
            break;
          case TaskStatus.COMPLETED:
            stats.completed = count;
            break;
          case TaskStatus.FAILED:
          case TaskStatus.CANCELLED:
            stats.failed += count;
            break;
        }
      }

      return statsByInbox;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_STATS_BY_INBOX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async createTasks<TPayload = unknown>(
    inboxId: string,
    inputs: CreateTaskInput<TPayload>[],
  ): Promise<Task<TPayload>[]> {
    const tasks: Task<TPayload>[] = [];

    for (const input of inputs) {
      const task = await this.createTask(inboxId, input);
      tasks.push(task);
    }

    return tasks;
  }

  async deleteTasks(params: DeleteTasksParams): Promise<number> {
    const { inboxId, status, olderThan } = params;

    try {
      const tableName = getTableName({ indexName: TABLE_INBOX_TASKS, schemaName: getSchemaName(this.#schema) });
      const conditions: string[] = [];
      const args: any[] = [];
      let paramIndex = 1;

      if (inboxId) {
        conditions.push(`"inboxId" = $${paramIndex++}`);
        args.push(inboxId);
      }

      if (status && status.length > 0) {
        const placeholders = status.map((_, i) => `$${paramIndex + i}`).join(', ');
        conditions.push(`status IN (${placeholders})`);
        args.push(...status);
        paramIndex += status.length;
      }

      if (olderThan) {
        conditions.push(`"createdAt" < $${paramIndex++}::timestamp`);
        args.push(olderThan.toISOString());
      }

      if (conditions.length === 0) {
        return 0;
      }

      const result = await this.#db.client.query(`DELETE FROM ${tableName} WHERE ${conditions.join(' AND ')}`, args);

      return result.rowCount ?? 0;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_TASKS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async upsertTask<TPayload = unknown>(
    inboxId: string,
    sourceId: string,
    input: CreateTaskInput<TPayload>,
  ): Promise<Task<TPayload>> {
    try {
      const tableName = getTableName({ indexName: TABLE_INBOX_TASKS, schemaName: getSchemaName(this.#schema) });
      // Find existing task by sourceId
      const result = await this.#db.client.oneOrNone(
        `SELECT * FROM ${tableName} WHERE "inboxId" = $1 AND "sourceId" = $2`,
        [inboxId, sourceId],
      );

      if (result) {
        const existingTask = this.parseTaskRow(result);

        // Only update if not completed or cancelled
        if (existingTask.status !== TaskStatus.COMPLETED && existingTask.status !== TaskStatus.CANCELLED) {
          const mergedMetadata = input.metadata
            ? { ...existingTask.metadata, ...input.metadata }
            : existingTask.metadata;

          await this.#db.client.none(
            `UPDATE ${tableName} SET type = $1, payload = $2, title = $3, "sourceUrl" = $4, priority = $5, metadata = $6 WHERE id = $7`,
            [
              input.type,
              JSON.stringify(input.payload),
              input.title ?? existingTask.title ?? null,
              input.sourceUrl ?? existingTask.sourceUrl ?? null,
              input.priority ?? existingTask.priority,
              mergedMetadata ? JSON.stringify(mergedMetadata) : null,
              existingTask.id,
            ],
          );

          return {
            ...existingTask,
            type: input.type,
            payload: input.payload,
            title: input.title ?? existingTask.title,
            sourceUrl: input.sourceUrl ?? existingTask.sourceUrl,
            priority: input.priority ?? existingTask.priority,
            metadata: mergedMetadata,
          } as Task<TPayload>;
        }

        // Return existing completed/cancelled task without update
        return existingTask as Task<TPayload>;
      }

      // Create new task
      return this.createTask(inboxId, {
        ...input,
        sourceId,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'UPSERT_TASK', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
