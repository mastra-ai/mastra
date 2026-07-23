import type {
  BackgroundTask,
  BackgroundTaskStatus,
  TaskFilter,
  TaskListResult,
  UpdateBackgroundTask,
} from '@mastra/core/background-tasks';
import type { CreateIndexOptions } from '@mastra/core/storage';
import { BackgroundTasksStorage, TABLE_BACKGROUND_TASKS, TABLE_SCHEMAS } from '@mastra/core/storage';

import { HANAClient, resolveHanaConfig } from '../../db';
import type { HANADomainConfig } from '../../db';
import { getSchemaName, getTableName } from '../utils';

function serializeJson(v: unknown): unknown {
  if (typeof v === 'object' && v != null) return JSON.stringify(v);
  return v ?? null;
}

function rowToTask(row: Record<string, unknown>): BackgroundTask {
  const parseJson = (val: unknown): unknown => {
    if (val == null) return undefined;
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return val;
      }
    }
    return val;
  };

  return {
    id: row['id'] as string,
    status: row['status'] as BackgroundTaskStatus,
    toolName: row['tool_name'] as string,
    toolCallId: row['tool_call_id'] as string,
    args: (parseJson(row['args']) ?? {}) as Record<string, unknown>,
    agentId: row['agent_id'] as string,
    threadId: (row['thread_id'] as string | null | undefined) ?? undefined,
    resourceId: (row['resource_id'] as string | null | undefined) ?? undefined,
    runId: (row['run_id'] as string) ?? '',
    result: parseJson(row['result']),
    error: parseJson(row['error']) as { message: string; stack?: string } | undefined,
    suspendPayload: parseJson(row['suspend_payload']),
    retryCount: Number(row['retry_count']),
    maxRetries: Number(row['max_retries']),
    timeoutMs: Number(row['timeout_ms']),
    createdAt: row['createdAt'] instanceof Date ? row['createdAt'] : new Date(row['createdAt'] as string),
    startedAt: row['startedAt']
      ? row['startedAt'] instanceof Date
        ? row['startedAt']
        : new Date(row['startedAt'] as string)
      : undefined,
    suspendedAt: row['suspendedAt']
      ? row['suspendedAt'] instanceof Date
        ? row['suspendedAt']
        : new Date(row['suspendedAt'] as string)
      : undefined,
    completedAt: row['completedAt']
      ? row['completedAt'] instanceof Date
        ? row['completedAt']
        : new Date(row['completedAt'] as string)
      : undefined,
  };
}

export class BackgroundTasksHANA extends BackgroundTasksStorage {
  private db: HANAClient;
  private schema?: string;
  private needsInit: boolean;
  private skipDefaultIndexes?: boolean;
  private indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_BACKGROUND_TASKS] as const;

  constructor(config: HANADomainConfig) {
    super();
    const { pool, schemaName, skipDefaultIndexes, indexes, needsInit } = resolveHanaConfig(config);
    this.schema = schemaName;
    this.db = new HANAClient({ pool, schemaName, skipDefaultIndexes });
    this.needsInit = needsInit;
    this.skipDefaultIndexes = skipDefaultIndexes;
    this.indexes = indexes?.filter(idx =>
      (BackgroundTasksHANA.MANAGED_TABLES as readonly string[]).includes(idx.table),
    );
  }

  async init(): Promise<void> {
    if (this.needsInit) {
      await this.db.pool.initialize();
      this.needsInit = false;
    }
    await this.db.createTable({
      tableName: TABLE_BACKGROUND_TASKS,
      schema: TABLE_SCHEMAS[TABLE_BACKGROUND_TASKS],
    });
    this.schema = this.db.schemaName;
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    const schemaPrefix = this.schema ? `${this.schema}_` : '';
    return [
      {
        name: `${schemaPrefix}mastra_bg_tasks_status_created_at_idx`,
        table: TABLE_BACKGROUND_TASKS,
        columns: ['status', 'createdAt'],
      },
      {
        name: `${schemaPrefix}mastra_bg_tasks_agent_status_idx`,
        table: TABLE_BACKGROUND_TASKS,
        columns: ['agent_id', 'status'],
      },
      {
        name: `${schemaPrefix}mastra_bg_tasks_thread_idx`,
        table: TABLE_BACKGROUND_TASKS,
        columns: ['thread_id', 'createdAt'],
      },
      {
        name: `${schemaPrefix}mastra_bg_tasks_tool_call_idx`,
        table: TABLE_BACKGROUND_TASKS,
        columns: ['tool_call_id'],
      },
    ];
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.skipDefaultIndexes) return;
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        await this.db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create index ${indexDef.name}:`, error);
      }
    }
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.indexes || this.indexes.length === 0) return;
    for (const indexDef of this.indexes) {
      try {
        await this.db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.db.clearTable({ tableName: TABLE_BACKGROUND_TASKS });
  }

  private tableName(): string {
    return getTableName({ indexName: TABLE_BACKGROUND_TASKS, schemaName: getSchemaName(this.schema) });
  }

  async createTask(task: BackgroundTask): Promise<void> {
    await this.db.insert({
      tableName: TABLE_BACKGROUND_TASKS,
      record: {
        id: task.id,
        tool_call_id: task.toolCallId,
        tool_name: task.toolName,
        agent_id: task.agentId,
        thread_id: task.threadId ?? null,
        resource_id: task.resourceId ?? null,
        run_id: task.runId,
        status: task.status,
        args: serializeJson(task.args),
        result: serializeJson(task.result),
        error: serializeJson(task.error),
        suspend_payload: serializeJson(task.suspendPayload),
        retry_count: task.retryCount,
        max_retries: task.maxRetries,
        timeout_ms: task.timeoutMs,
        createdAt: task.createdAt.toISOString(),
        startedAt: task.startedAt?.toISOString() ?? null,
        suspendedAt: task.suspendedAt?.toISOString() ?? null,
        completedAt: task.completedAt?.toISOString() ?? null,
      },
    });
  }

  async updateTask(taskId: string, update: UpdateBackgroundTask): Promise<void> {
    const setClauses: string[] = [];
    const params: unknown[] = [];

    if ('status' in update) {
      setClauses.push(`"status" = ?`);
      params.push(update.status);
    }
    if ('result' in update) {
      setClauses.push(`"result" = ?`);
      params.push(serializeJson(update.result));
    }
    if ('error' in update) {
      setClauses.push(`"error" = ?`);
      params.push(serializeJson(update.error));
    }
    if ('suspendPayload' in update) {
      setClauses.push(`"suspend_payload" = ?`);
      params.push(serializeJson(update.suspendPayload));
    }
    if ('retryCount' in update) {
      setClauses.push(`"retry_count" = ?`);
      params.push(update.retryCount);
    }
    if ('startedAt' in update) {
      setClauses.push(`"startedAt" = ?`);
      params.push(update.startedAt?.toISOString() ?? null);
    }
    if ('suspendedAt' in update) {
      setClauses.push(`"suspendedAt" = ?`);
      params.push(update.suspendedAt?.toISOString() ?? null);
    }
    if ('completedAt' in update) {
      setClauses.push(`"completedAt" = ?`);
      params.push(update.completedAt?.toISOString() ?? null);
    }

    if (setClauses.length === 0) return;

    params.push(taskId);
    await this.db.pool.withConnection(conn =>
      conn.execPromise(`UPDATE ${this.tableName()} SET ${setClauses.join(', ')} WHERE "id" = ?`, params),
    );
  }

  async getTask(taskId: string): Promise<BackgroundTask | null> {
    const rows = await this.db.pool.withConnection(conn =>
      conn.execPromise(`SELECT * FROM ${this.tableName()} WHERE "id" = ?`, [taskId]),
    );
    if (!rows || (rows as unknown[]).length === 0) return null;
    const row = (rows as Array<Record<string, unknown>>)[0];
    if (!row) return null;
    return rowToTask(row);
  }

  async listTasks(filter: TaskFilter): Promise<TaskListResult> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      const placeholders = statuses.map(() => '?').join(', ');
      conditions.push(`"status" IN (${placeholders})`);
      params.push(...statuses);
    }
    if (filter.agentId) {
      conditions.push(`"agent_id" = ?`);
      params.push(filter.agentId);
    }
    if (filter.threadId) {
      conditions.push(`"thread_id" = ?`);
      params.push(filter.threadId);
    }
    if (filter.resourceId) {
      conditions.push(`"resource_id" = ?`);
      params.push(filter.resourceId);
    }
    if (filter.runId) {
      conditions.push(`"run_id" = ?`);
      params.push(filter.runId);
    }
    if (filter.toolName) {
      conditions.push(`"tool_name" = ?`);
      params.push(filter.toolName);
    }
    if (filter.toolCallId) {
      conditions.push(`"tool_call_id" = ?`);
      params.push(filter.toolCallId);
    }

    const dateCol =
      filter.dateFilterBy === 'startedAt'
        ? '"startedAt"'
        : filter.dateFilterBy === 'suspendedAt'
          ? '"suspendedAt"'
          : filter.dateFilterBy === 'completedAt'
            ? '"completedAt"'
            : '"createdAt"';

    if (filter.fromDate) {
      conditions.push(`${dateCol} >= ?`);
      params.push(filter.fromDate.toISOString());
    }
    if (filter.toDate) {
      conditions.push(`${dateCol} < ?`);
      params.push(filter.toDate.toISOString());
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const countRows = await this.db.pool.withConnection(conn =>
      conn.execPromise(`SELECT COUNT(*) AS CNT FROM ${this.tableName()} ${where}`, [...params]),
    );
    const total = Number((countRows as Array<{ CNT: number }>)[0]?.CNT ?? 0);

    const orderCol =
      filter.orderBy === 'startedAt'
        ? '"startedAt"'
        : filter.orderBy === 'suspendedAt'
          ? '"suspendedAt"'
          : filter.orderBy === 'completedAt'
            ? '"completedAt"'
            : '"createdAt"';
    const direction = filter.orderDirection === 'desc' ? 'DESC' : 'ASC';

    let sql = `SELECT * FROM ${this.tableName()} ${where} ORDER BY ${orderCol} ${direction}`;
    const listParams = [...params];

    if (filter.perPage != null) {
      const offset = filter.page != null ? filter.page * filter.perPage : 0;
      sql += ` LIMIT ? OFFSET ?`;
      listParams.push(filter.perPage, offset);
    }

    const rows = await this.db.pool.withConnection(conn => conn.execPromise(sql, listParams));
    return {
      tasks: (rows as Array<Record<string, unknown>>).map(rowToTask),
      total,
    };
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.db.pool.withConnection(conn =>
      conn.execPromise(`DELETE FROM ${this.tableName()} WHERE "id" = ?`, [taskId]),
    );
  }

  async deleteTasks(filter: TaskFilter): Promise<void> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      const placeholders = statuses.map(() => '?').join(', ');
      conditions.push(`"status" IN (${placeholders})`);
      params.push(...statuses);
    }

    const dateCol =
      filter.dateFilterBy === 'startedAt'
        ? '"startedAt"'
        : filter.dateFilterBy === 'suspendedAt'
          ? '"suspendedAt"'
          : filter.dateFilterBy === 'completedAt'
            ? '"completedAt"'
            : '"createdAt"';

    if (filter.fromDate) {
      conditions.push(`${dateCol} >= ?`);
      params.push(filter.fromDate.toISOString());
    }
    if (filter.toDate) {
      conditions.push(`${dateCol} < ?`);
      params.push(filter.toDate.toISOString());
    }
    if (filter.agentId) {
      conditions.push(`"agent_id" = ?`);
      params.push(filter.agentId);
    }
    if (filter.runId) {
      conditions.push(`"run_id" = ?`);
      params.push(filter.runId);
    }

    if (conditions.length === 0) return;

    await this.db.pool.withConnection(conn =>
      conn.execPromise(`DELETE FROM ${this.tableName()} WHERE ${conditions.join(' AND ')}`, params),
    );
  }

  async getRunningCount(): Promise<number> {
    const rows = await this.db.pool.withConnection(conn =>
      conn.execPromise(`SELECT COUNT(*) AS CNT FROM ${this.tableName()} WHERE "status" = 'running'`, []),
    );
    return Number((rows as Array<{ CNT: number }>)[0]?.CNT ?? 0);
  }

  async getRunningCountByAgent(agentId: string): Promise<number> {
    const rows = await this.db.pool.withConnection(conn =>
      conn.execPromise(
        `SELECT COUNT(*) AS CNT FROM ${this.tableName()} WHERE "status" = 'running' AND "agent_id" = ?`,
        [agentId],
      ),
    );
    return Number((rows as Array<{ CNT: number }>)[0]?.CNT ?? 0);
  }
}
