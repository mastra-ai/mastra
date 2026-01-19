import type { Client, InValue } from '@libsql/client';
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
} from '@mastra/core/storage';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import { buildSelectColumns } from '../../db/utils';

export class InboxLibSQL extends InboxStorage {
  #db: LibSQLDB;
  #client: Client;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#client = client;
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_INBOX_TASKS, schema: INBOX_TASKS_SCHEMA });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_INBOX_TASKS });
  }

  /**
   * Parse a JSON field that may be stored as string, ArrayBuffer, or already parsed object.
   * LibSQL may return JSONB columns as binary data.
   */
  private parseJsonField(value: unknown): unknown {
    if (value === null || value === undefined) {
      return undefined;
    }
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    if (value instanceof ArrayBuffer) {
      const text = new TextDecoder().decode(value);
      // LibSQL JSONB binary format starts with 0xbc byte, need to skip header
      const jsonStr = text.startsWith('\xbc') ? text.slice(1) : text;
      try {
        return JSON.parse(jsonStr);
      } catch {
        return jsonStr;
      }
    }
    if (ArrayBuffer.isView(value)) {
      const uint8 = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
      const text = new TextDecoder().decode(uint8);
      // LibSQL JSONB binary format starts with 0xbc byte, need to skip header
      const jsonStr = text.startsWith('\xbc') ? text.slice(1) : text;
      try {
        return JSON.parse(jsonStr);
      } catch {
        return jsonStr;
      }
    }
    return value;
  }

  private parseTaskRow(row: Record<string, any>): Task {
    // Helper to convert null to undefined for optional fields
    const nullToUndefined = <T>(value: T | null): T | undefined => (value === null ? undefined : value);

    return {
      id: row.id as string,
      inboxId: row.inboxId as string,
      type: row.type as string,
      status: row.status as TaskStatus,
      priority: row.priority as TaskPriority,
      title: nullToUndefined(row.title) as string | undefined,
      sourceId: nullToUndefined(row.sourceId) as string | undefined,
      sourceUrl: nullToUndefined(row.sourceUrl) as string | undefined,
      payload: this.parseJsonField(row.payload),
      result: row.result ? this.parseJsonField(row.result) : undefined,
      error: row.error
        ? (this.parseJsonField(row.error) as { message: string; stack?: string; retryable?: boolean })
        : undefined,
      targetAgentId: nullToUndefined(row.targetAgentId) as string | undefined,
      claimedBy: nullToUndefined(row.claimedBy) as string | undefined,
      runId: nullToUndefined(row.runId) as string | undefined,
      createdAt: new Date(row.createdAt as string),
      claimedAt: row.claimedAt ? new Date(row.claimedAt as string) : undefined,
      claimExpiresAt: row.claimExpiresAt ? new Date(row.claimExpiresAt as string) : undefined,
      startedAt: row.startedAt ? new Date(row.startedAt as string) : undefined,
      completedAt: row.completedAt ? new Date(row.completedAt as string) : undefined,
      attempts: row.attempts as number,
      maxAttempts: row.maxAttempts as number,
      nextRetryAt: row.nextRetryAt ? new Date(row.nextRetryAt as string) : undefined,
      suspendedAt: row.suspendedAt ? new Date(row.suspendedAt as string) : undefined,
      suspendPayload: row.suspendPayload ? this.parseJsonField(row.suspendPayload) : undefined,
      resumePayload: row.resumePayload ? this.parseJsonField(row.resumePayload) : undefined,
      metadata: row.metadata ? (this.parseJsonField(row.metadata) as Record<string, unknown>) : undefined,
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
        createdAt: now.toISOString(),
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
          id: createStorageErrorId('LIBSQL', 'CREATE_TASK', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getTaskById(taskId: string): Promise<Task | null> {
    try {
      const columns = buildSelectColumns(TABLE_INBOX_TASKS);
      const result = await this.#client.execute({
        sql: `SELECT ${columns} FROM ${TABLE_INBOX_TASKS} WHERE id = ?`,
        args: [taskId],
      });
      return result.rows?.[0] ? this.parseTaskRow(result.rows[0]) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_TASK', 'FAILED'),
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
      const args: InValue[] = [];

      if (updates.runId !== undefined) {
        setClauses.push('runId = ?');
        args.push(updates.runId);
      }

      if (updates.metadata !== undefined) {
        const mergedMetadata = { ...task.metadata, ...updates.metadata };
        setClauses.push('metadata = ?');
        args.push(JSON.stringify(mergedMetadata));
      }

      if (setClauses.length > 0) {
        args.push(taskId);
        await this.#client.execute({
          sql: `UPDATE ${TABLE_INBOX_TASKS} SET ${setClauses.join(', ')} WHERE id = ?`,
          args,
        });
      }

      const updated = await this.getTaskById(taskId);
      return updated!;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'UPDATE_TASK', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    try {
      await this.#client.execute({
        sql: `DELETE FROM ${TABLE_INBOX_TASKS} WHERE id = ?`,
        args: [taskId],
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_TASK', 'FAILED'),
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

    try {
      // Build WHERE clause
      const conditions: string[] = ['inboxId = ?', 'status = ?'];
      const args: InValue[] = [inboxId, TaskStatus.PENDING];

      // Skip if not yet ready for retry
      conditions.push('(nextRetryAt IS NULL OR nextRetryAt <= ?)');
      args.push(now.toISOString());

      // Check targetAgentId - only claim if it's null or matches this agent
      conditions.push('(targetAgentId IS NULL OR targetAgentId = ?)');
      args.push(agentId);

      // Check type filter
      if (filter?.types && filter.types.length > 0) {
        const placeholders = filter.types.map(() => '?').join(', ');
        conditions.push(`type IN (${placeholders})`);
        args.push(...filter.types);
      }

      // Get highest priority pending task (priority DESC, createdAt ASC)
      const columns = buildSelectColumns(TABLE_INBOX_TASKS);
      const result = await this.#client.execute({
        sql: `SELECT ${columns} FROM ${TABLE_INBOX_TASKS} WHERE ${conditions.join(' AND ')} ORDER BY priority DESC, createdAt ASC LIMIT 1`,
        args,
      });

      if (!result.rows?.[0]) {
        return null;
      }

      const task = this.parseTaskRow(result.rows[0]);

      // Apply custom filter if provided
      if (filter?.filter && !filter.filter(task)) {
        return null;
      }

      // Claim the task
      const claimExpiresAt = new Date(now.getTime() + claimTimeout);
      await this.#client.execute({
        sql: `UPDATE ${TABLE_INBOX_TASKS} SET status = ?, claimedBy = ?, claimedAt = ?, claimExpiresAt = ? WHERE id = ?`,
        args: [TaskStatus.CLAIMED, agentId, now.toISOString(), claimExpiresAt.toISOString(), task.id],
      });

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
          id: createStorageErrorId('LIBSQL', 'CLAIM_TASK', 'FAILED'),
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

      await this.#client.execute({
        sql: `UPDATE ${TABLE_INBOX_TASKS} SET status = ?, claimedBy = NULL, claimedAt = NULL, claimExpiresAt = NULL WHERE id = ?`,
        args: [TaskStatus.PENDING, taskId],
      });

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
          id: createStorageErrorId('LIBSQL', 'RELEASE_TASK', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async releaseExpiredClaims(): Promise<number> {
    const now = new Date();
    try {
      const result = await this.#client.execute({
        sql: `UPDATE ${TABLE_INBOX_TASKS} SET status = ?, claimedBy = NULL, claimedAt = NULL, claimExpiresAt = NULL WHERE status = ? AND claimExpiresAt < ?`,
        args: [TaskStatus.PENDING, TaskStatus.CLAIMED, now.toISOString()],
      });
      return result.rowsAffected;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'RELEASE_EXPIRED_CLAIMS', 'FAILED'),
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
      await this.#client.execute({
        sql: `UPDATE ${TABLE_INBOX_TASKS} SET status = ?, startedAt = ? WHERE id = ?`,
        args: [TaskStatus.IN_PROGRESS, now.toISOString(), taskId],
      });

      return {
        ...task,
        status: TaskStatus.IN_PROGRESS,
        startedAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'START_TASK', 'FAILED'),
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
      await this.#client.execute({
        sql: `UPDATE ${TABLE_INBOX_TASKS} SET status = ?, result = ?, completedAt = ? WHERE id = ?`,
        args: [TaskStatus.COMPLETED, JSON.stringify(result), now.toISOString(), taskId],
      });

      return {
        ...task,
        status: TaskStatus.COMPLETED,
        result,
        completedAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'COMPLETE_TASK', 'FAILED'),
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
      const newAttempts = task.attempts + 1;
      const maxAttempts = task.maxAttempts;
      const shouldRetry = error.retryable !== false && newAttempts < maxAttempts;

      if (shouldRetry) {
        const backoffMs = calculateBackoff(newAttempts, retryConfig);
        const nextRetryAt = new Date(now.getTime() + backoffMs);
        const errorWithRetry = { ...error, retryable: true };

        await this.#client.execute({
          sql: `UPDATE ${TABLE_INBOX_TASKS} SET status = ?, attempts = ?, nextRetryAt = ?, error = ?, claimedBy = NULL, claimedAt = NULL, claimExpiresAt = NULL WHERE id = ?`,
          args: [TaskStatus.PENDING, newAttempts, nextRetryAt.toISOString(), JSON.stringify(errorWithRetry), taskId],
        });

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

        await this.#client.execute({
          sql: `UPDATE ${TABLE_INBOX_TASKS} SET status = ?, attempts = ?, completedAt = ?, error = ? WHERE id = ?`,
          args: [TaskStatus.FAILED, newAttempts, now.toISOString(), JSON.stringify(errorWithNoRetry), taskId],
        });

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
          id: createStorageErrorId('LIBSQL', 'FAIL_TASK', 'FAILED'),
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
      await this.#client.execute({
        sql: `UPDATE ${TABLE_INBOX_TASKS} SET status = ?, completedAt = ? WHERE id = ?`,
        args: [TaskStatus.CANCELLED, now.toISOString(), taskId],
      });

      return {
        ...task,
        status: TaskStatus.CANCELLED,
        completedAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'CANCEL_TASK', 'FAILED'),
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
      // Store just the payload, not the full input with reason
      const suspendPayload = input.payload;

      await this.#client.execute({
        sql: `UPDATE ${TABLE_INBOX_TASKS} SET status = ?, suspendedAt = ?, suspendPayload = ? WHERE id = ?`,
        args: [TaskStatus.WAITING_FOR_INPUT, now.toISOString(), JSON.stringify(suspendPayload), taskId],
      });

      return {
        ...task,
        status: TaskStatus.WAITING_FOR_INPUT,
        suspendedAt: now,
        suspendPayload,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'SUSPEND_TASK', 'FAILED'),
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

      await this.#client.execute({
        sql: `UPDATE ${TABLE_INBOX_TASKS} SET status = ?, resumePayload = ? WHERE id = ?`,
        args: [TaskStatus.IN_PROGRESS, JSON.stringify(input.payload), taskId],
      });

      return {
        ...task,
        status: TaskStatus.IN_PROGRESS,
        resumePayload: input.payload,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'RESUME_TASK', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listWaitingTasks(inboxId?: string): Promise<Task[]> {
    try {
      const columns = buildSelectColumns(TABLE_INBOX_TASKS);
      let sql = `SELECT ${columns} FROM ${TABLE_INBOX_TASKS} WHERE status = ?`;
      const args: InValue[] = [TaskStatus.WAITING_FOR_INPUT];

      if (inboxId) {
        sql += ' AND inboxId = ?';
        args.push(inboxId);
      }

      sql += ' ORDER BY priority DESC, createdAt ASC';

      const result = await this.#client.execute({ sql, args });
      return result.rows?.map(row => this.parseTaskRow(row)) ?? [];
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_WAITING_TASKS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listTasks(inboxId: string, filter?: ListFilter): Promise<Task[]> {
    try {
      const conditions: string[] = ['inboxId = ?'];
      const args: InValue[] = [inboxId];

      if (filter?.status) {
        const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
        const placeholders = statuses.map(() => '?').join(', ');
        conditions.push(`status IN (${placeholders})`);
        args.push(...statuses);
      }

      if (filter?.type) {
        const types = Array.isArray(filter.type) ? filter.type : [filter.type];
        const placeholders = types.map(() => '?').join(', ');
        conditions.push(`type IN (${placeholders})`);
        args.push(...types);
      }

      if (filter?.targetAgentId) {
        conditions.push('targetAgentId = ?');
        args.push(filter.targetAgentId);
      }

      if (filter?.claimedBy) {
        conditions.push('claimedBy = ?');
        args.push(filter.claimedBy);
      }

      if (filter?.priority !== undefined) {
        conditions.push('priority = ?');
        args.push(filter.priority);
      }

      const columns = buildSelectColumns(TABLE_INBOX_TASKS);
      let sql = `SELECT ${columns} FROM ${TABLE_INBOX_TASKS} WHERE ${conditions.join(' AND ')} ORDER BY priority DESC, createdAt ASC`;

      // SQLite requires LIMIT when using OFFSET, so add a high default if only offset is specified
      if (filter?.limit || filter?.offset) {
        sql += ` LIMIT ${filter?.limit ?? 1000000}`;
        if (filter?.offset) {
          sql += ` OFFSET ${filter.offset}`;
        }
      }

      const result = await this.#client.execute({ sql, args });
      return result.rows?.map(row => this.parseTaskRow(row)) ?? [];
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_TASKS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getStats(inboxId: string): Promise<InboxStats> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT status, COUNT(*) as count FROM ${TABLE_INBOX_TASKS} WHERE inboxId = ? GROUP BY status`,
        args: [inboxId],
      });

      const stats: InboxStats = {
        pending: 0,
        claimed: 0,
        inProgress: 0,
        waitingForInput: 0,
        completed: 0,
        failed: 0,
      };

      for (const row of result.rows ?? []) {
        const status = row.status as TaskStatus;
        const count = Number(row.count);

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
          id: createStorageErrorId('LIBSQL', 'GET_STATS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getStatsByInbox(): Promise<Record<string, InboxStats>> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT inboxId, status, COUNT(*) as count FROM ${TABLE_INBOX_TASKS} GROUP BY inboxId, status`,
        args: [],
      });

      const statsByInbox: Record<string, InboxStats> = {};

      for (const row of result.rows ?? []) {
        const inboxId = row.inboxId as string;
        const status = row.status as TaskStatus;
        const count = Number(row.count);

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
          id: createStorageErrorId('LIBSQL', 'GET_STATS_BY_INBOX', 'FAILED'),
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
      const conditions: string[] = [];
      const args: InValue[] = [];

      if (inboxId) {
        conditions.push('inboxId = ?');
        args.push(inboxId);
      }

      if (status && status.length > 0) {
        const placeholders = status.map(() => '?').join(', ');
        conditions.push(`status IN (${placeholders})`);
        args.push(...status);
      }

      if (olderThan) {
        conditions.push('createdAt < ?');
        args.push(olderThan.toISOString());
      }

      if (conditions.length === 0) {
        return 0;
      }

      const result = await this.#client.execute({
        sql: `DELETE FROM ${TABLE_INBOX_TASKS} WHERE ${conditions.join(' AND ')}`,
        args,
      });

      return result.rowsAffected;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_TASKS', 'FAILED'),
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
      // Find existing task by sourceId
      const columns = buildSelectColumns(TABLE_INBOX_TASKS);
      const result = await this.#client.execute({
        sql: `SELECT ${columns} FROM ${TABLE_INBOX_TASKS} WHERE inboxId = ? AND sourceId = ?`,
        args: [inboxId, sourceId],
      });

      if (result.rows?.[0]) {
        const existingTask = this.parseTaskRow(result.rows[0]);

        // Only update if not completed or cancelled
        if (existingTask.status !== TaskStatus.COMPLETED && existingTask.status !== TaskStatus.CANCELLED) {
          const mergedMetadata = input.metadata
            ? { ...existingTask.metadata, ...input.metadata }
            : existingTask.metadata;

          await this.#client.execute({
            sql: `UPDATE ${TABLE_INBOX_TASKS} SET type = ?, payload = ?, title = ?, sourceUrl = ?, priority = ?, metadata = ? WHERE id = ?`,
            args: [
              input.type,
              JSON.stringify(input.payload),
              input.title ?? existingTask.title ?? null,
              input.sourceUrl ?? existingTask.sourceUrl ?? null,
              input.priority ?? existingTask.priority,
              mergedMetadata ? JSON.stringify(mergedMetadata) : null,
              existingTask.id,
            ],
          });

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
          id: createStorageErrorId('LIBSQL', 'UPSERT_TASK', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
