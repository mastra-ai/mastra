import type {
  BackgroundTask,
  BackgroundTaskStatus,
  TaskFilter,
  TaskListResult,
  UpdateBackgroundTask,
} from '@mastra/core/background-tasks';
import { BackgroundTasksStorage, TABLE_BACKGROUND_TASKS, TABLE_SCHEMAS } from '@mastra/core/storage';
import type { CreateIndexOptions } from '@mastra/core/storage';
import type { Pool, RowDataPacket } from 'mysql2/promise';

import type { StoreOperationsMySQL } from '../operations';
import { generateTableSQL, generateIndexSQL } from '../operations';
import { formatTableName, parseDateTime, quoteIdentifier, transformToSqlValue } from '../utils';

function serializeJson(v: unknown): any {
  if (typeof v === 'object' && v != null) return JSON.stringify(v);
  return v ?? null;
}

function parseJson(val: unknown): any {
  if (val == null) return undefined;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
}

function rowToTask(row: Record<string, any>): BackgroundTask {
  return {
    id: String(row.id),
    status: String(row.status) as BackgroundTaskStatus,
    toolName: String(row.tool_name),
    toolCallId: String(row.tool_call_id),
    args: parseJson(row.args) ?? {},
    agentId: String(row.agent_id),
    threadId: row.thread_id != null ? String(row.thread_id) : undefined,
    resourceId: row.resource_id != null ? String(row.resource_id) : undefined,
    runId: String(row.run_id),
    result: parseJson(row.result),
    error: parseJson(row.error),
    suspendPayload: parseJson(row.suspend_payload),
    retryCount: Number(row.retry_count),
    maxRetries: Number(row.max_retries),
    timeoutMs: Number(row.timeout_ms),
    createdAt: parseDateTime(row.createdAt)!,
    startedAt: parseDateTime(row.startedAt),
    suspendedAt: parseDateTime(row.suspendedAt),
    completedAt: parseDateTime(row.completedAt),
  };
}

export class BackgroundTasksMySQL extends BackgroundTasksStorage {
  private pool: Pool;
  private operations: StoreOperationsMySQL;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_BACKGROUND_TASKS] as const;

  constructor({
    pool,
    operations,
    skipDefaultIndexes,
    indexes,
  }: {
    pool: Pool;
    operations: StoreOperationsMySQL;
    skipDefaultIndexes?: boolean;
    indexes?: CreateIndexOptions[];
  }) {
    super();
    this.pool = pool;
    this.operations = operations;
    this.#skipDefaultIndexes = skipDefaultIndexes;
    this.#indexes = indexes?.filter(idx =>
      (BackgroundTasksMySQL.MANAGED_TABLES as readonly string[]).includes(idx.table),
    );
  }

  async init(): Promise<void> {
    await this.operations.createTable({
      tableName: TABLE_BACKGROUND_TASKS,
      schema: TABLE_SCHEMAS[TABLE_BACKGROUND_TASKS],
    });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  static getDefaultIndexDefs(prefix: string = ''): CreateIndexOptions[] {
    return [
      {
        name: `${prefix}mastra_bg_tasks_status_created_at_idx`,
        table: TABLE_BACKGROUND_TASKS,
        columns: ['status', 'createdAt'],
      },
      {
        name: `${prefix}mastra_bg_tasks_agent_status_idx`,
        table: TABLE_BACKGROUND_TASKS,
        columns: ['agent_id', 'status'],
      },
      {
        name: `${prefix}mastra_bg_tasks_thread_idx`,
        table: TABLE_BACKGROUND_TASKS,
        columns: ['thread_id', 'createdAt'],
      },
      {
        name: `${prefix}mastra_bg_tasks_tool_call_idx`,
        table: TABLE_BACKGROUND_TASKS,
        columns: ['tool_call_id'],
      },
    ];
  }

  static getExportDDL(): string[] {
    const statements: string[] = [];

    statements.push(
      generateTableSQL({
        tableName: TABLE_BACKGROUND_TASKS,
        schema: TABLE_SCHEMAS[TABLE_BACKGROUND_TASKS],
      }),
    );

    for (const idx of BackgroundTasksMySQL.getDefaultIndexDefs()) {
      statements.push(generateIndexSQL(idx));
    }

    return statements;
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return BackgroundTasksMySQL.getDefaultIndexDefs('');
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) return;
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      await this.operations.createIndex(indexDef);
    }
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) return;
    for (const indexDef of this.#indexes) {
      await this.operations.createIndex(indexDef);
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.operations.clearTable({ tableName: TABLE_BACKGROUND_TASKS });
  }

  async createTask(task: BackgroundTask): Promise<void> {
    await this.pool.execute(
      `INSERT INTO ${formatTableName(TABLE_BACKGROUND_TASKS)} (${quoteIdentifier('id', 'column name')}, ${quoteIdentifier('tool_call_id', 'column name')}, ${quoteIdentifier('tool_name', 'column name')}, ${quoteIdentifier('agent_id', 'column name')}, ${quoteIdentifier('thread_id', 'column name')}, ${quoteIdentifier('resource_id', 'column name')}, ${quoteIdentifier('run_id', 'column name')}, ${quoteIdentifier('status', 'column name')}, ${quoteIdentifier('args', 'column name')}, ${quoteIdentifier('result', 'column name')}, ${quoteIdentifier('error', 'column name')}, ${quoteIdentifier('suspend_payload', 'column name')}, ${quoteIdentifier('retry_count', 'column name')}, ${quoteIdentifier('max_retries', 'column name')}, ${quoteIdentifier('timeout_ms', 'column name')}, ${quoteIdentifier('createdAt', 'column name')}, ${quoteIdentifier('startedAt', 'column name')}, ${quoteIdentifier('suspendedAt', 'column name')}, ${quoteIdentifier('completedAt', 'column name')}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.toolCallId,
        task.toolName,
        task.agentId,
        task.threadId ?? null,
        task.resourceId ?? null,
        task.runId,
        task.status,
        JSON.stringify(task.args),
        task.result ? JSON.stringify(task.result) : null,
        task.error ? JSON.stringify(task.error) : null,
        task.suspendPayload ? JSON.stringify(task.suspendPayload) : null,
        task.retryCount,
        task.maxRetries,
        task.timeoutMs,
        transformToSqlValue(task.createdAt),
        transformToSqlValue(task.startedAt),
        transformToSqlValue(task.suspendedAt),
        transformToSqlValue(task.completedAt),
      ],
    );
  }

  async updateTask(taskId: string, update: UpdateBackgroundTask): Promise<void> {
    const setClauses: string[] = [];
    const params: (string | number | null)[] = [];

    if ('status' in update) {
      setClauses.push(`${quoteIdentifier('status', 'column name')} = ?`);
      params.push(update.status as string);
    }
    if ('result' in update) {
      setClauses.push(`${quoteIdentifier('result', 'column name')} = ?`);
      params.push(serializeJson(update.result));
    }
    if ('error' in update) {
      setClauses.push(`${quoteIdentifier('error', 'column name')} = ?`);
      params.push(serializeJson(update.error));
    }
    if ('suspendPayload' in update) {
      setClauses.push(`${quoteIdentifier('suspend_payload', 'column name')} = ?`);
      params.push(serializeJson(update.suspendPayload));
    }
    if ('retryCount' in update) {
      setClauses.push(`${quoteIdentifier('retry_count', 'column name')} = ?`);
      params.push(update.retryCount as number);
    }
    if ('startedAt' in update) {
      setClauses.push(`${quoteIdentifier('startedAt', 'column name')} = ?`);
      params.push(transformToSqlValue(update.startedAt));
    }
    if ('suspendedAt' in update) {
      setClauses.push(`${quoteIdentifier('suspendedAt', 'column name')} = ?`);
      params.push(transformToSqlValue(update.suspendedAt));
    }
    if ('completedAt' in update) {
      setClauses.push(`${quoteIdentifier('completedAt', 'column name')} = ?`);
      params.push(transformToSqlValue(update.completedAt));
    }

    if (setClauses.length === 0) return;

    params.push(taskId);
    await this.pool.execute(
      `UPDATE ${formatTableName(TABLE_BACKGROUND_TASKS)} SET ${setClauses.join(', ')} WHERE ${quoteIdentifier('id', 'column name')} = ?`,
      params,
    );
  }

  async getTask(taskId: string): Promise<BackgroundTask | null> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT * FROM ${formatTableName(TABLE_BACKGROUND_TASKS)} WHERE ${quoteIdentifier('id', 'column name')} = ?`,
      [taskId],
    );
    const row = rows[0];
    return row ? rowToTask(row as Record<string, any>) : null;
  }

  async listTasks(filter: TaskFilter): Promise<TaskListResult> {
    const conditions: string[] = [];
    const params: (string | number | null)[] = [];

    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      const placeholders = statuses.map(() => '?').join(', ');
      conditions.push(`${quoteIdentifier('status', 'column name')} IN (${placeholders})`);
      params.push(...statuses);
    }
    if (filter.agentId) {
      conditions.push(`${quoteIdentifier('agent_id', 'column name')} = ?`);
      params.push(filter.agentId);
    }
    if (filter.threadId) {
      conditions.push(`${quoteIdentifier('thread_id', 'column name')} = ?`);
      params.push(filter.threadId);
    }
    if (filter.runId) {
      conditions.push(`${quoteIdentifier('run_id', 'column name')} = ?`);
      params.push(filter.runId);
    }
    if (filter.resourceId) {
      conditions.push(`${quoteIdentifier('resource_id', 'column name')} = ?`);
      params.push(filter.resourceId);
    }
    if (filter.toolName) {
      conditions.push(`${quoteIdentifier('tool_name', 'column name')} = ?`);
      params.push(filter.toolName);
    }
    if (filter.toolCallId) {
      conditions.push(`${quoteIdentifier('tool_call_id', 'column name')} = ?`);
      params.push(filter.toolCallId);
    }
    // Date range filtering
    const dateCol =
      filter.dateFilterBy === 'startedAt'
        ? quoteIdentifier('startedAt', 'column name')
        : filter.dateFilterBy === 'suspendedAt'
          ? quoteIdentifier('suspendedAt', 'column name')
          : filter.dateFilterBy === 'completedAt'
            ? quoteIdentifier('completedAt', 'column name')
            : quoteIdentifier('createdAt', 'column name');
    if (filter.fromDate) {
      conditions.push(`${dateCol} >= ?`);
      params.push(transformToSqlValue(filter.fromDate));
    }
    if (filter.toDate) {
      conditions.push(`${dateCol} < ?`);
      params.push(transformToSqlValue(filter.toDate));
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total matching rows (before pagination)
    const [countRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM ${formatTableName(TABLE_BACKGROUND_TASKS)} ${where}`,
      [...params],
    );
    const total = Number(countRows[0]?.count ?? 0);

    const orderCol =
      filter.orderBy === 'startedAt'
        ? quoteIdentifier('startedAt', 'column name')
        : filter.orderBy === 'suspendedAt'
          ? quoteIdentifier('suspendedAt', 'column name')
          : filter.orderBy === 'completedAt'
            ? quoteIdentifier('completedAt', 'column name')
            : quoteIdentifier('createdAt', 'column name');
    const direction = filter.orderDirection === 'desc' ? 'DESC' : 'ASC';

    let sql = `SELECT * FROM ${formatTableName(TABLE_BACKGROUND_TASKS)} ${where} ORDER BY ${orderCol} ${direction}`;

    if (filter.perPage != null) {
      sql += ' LIMIT ?';
      params.push(filter.perPage);
      if (filter.page != null) {
        sql += ' OFFSET ?';
        params.push(filter.page * filter.perPage);
      }
    }

    const [rows] = await this.pool.query<RowDataPacket[]>(sql, params);
    return { tasks: rows.map(row => rowToTask(row as Record<string, any>)), total };
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.pool.execute(
      `DELETE FROM ${formatTableName(TABLE_BACKGROUND_TASKS)} WHERE ${quoteIdentifier('id', 'column name')} = ?`,
      [taskId],
    );
  }

  async deleteTasks(filter: TaskFilter): Promise<void> {
    const conditions: string[] = [];
    const params: (string | number | null)[] = [];

    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      const placeholders = statuses.map(() => '?').join(', ');
      conditions.push(`${quoteIdentifier('status', 'column name')} IN (${placeholders})`);
      params.push(...statuses);
    }
    // Date range filtering
    const dateCol =
      filter.dateFilterBy === 'startedAt'
        ? quoteIdentifier('startedAt', 'column name')
        : filter.dateFilterBy === 'suspendedAt'
          ? quoteIdentifier('suspendedAt', 'column name')
          : filter.dateFilterBy === 'completedAt'
            ? quoteIdentifier('completedAt', 'column name')
            : quoteIdentifier('createdAt', 'column name');
    if (filter.fromDate) {
      conditions.push(`${dateCol} >= ?`);
      params.push(transformToSqlValue(filter.fromDate));
    }
    if (filter.toDate) {
      conditions.push(`${dateCol} < ?`);
      params.push(transformToSqlValue(filter.toDate));
    }
    if (filter.agentId) {
      conditions.push(`${quoteIdentifier('agent_id', 'column name')} = ?`);
      params.push(filter.agentId);
    }
    if (filter.runId) {
      conditions.push(`${quoteIdentifier('run_id', 'column name')} = ?`);
      params.push(filter.runId);
    }

    if (conditions.length === 0) return; // Safety: don't delete everything

    await this.pool.execute(
      `DELETE FROM ${formatTableName(TABLE_BACKGROUND_TASKS)} WHERE ${conditions.join(' AND ')}`,
      params,
    );
  }

  async getRunningCount(): Promise<number> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM ${formatTableName(TABLE_BACKGROUND_TASKS)} WHERE ${quoteIdentifier('status', 'column name')} = ?`,
      ['running'],
    );
    return Number(rows[0]?.count ?? 0);
  }

  async getRunningCountByAgent(agentId: string): Promise<number> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM ${formatTableName(TABLE_BACKGROUND_TASKS)} WHERE ${quoteIdentifier('status', 'column name')} = ? AND ${quoteIdentifier('agent_id', 'column name')} = ?`,
      ['running', agentId],
    );
    return Number(rows[0]?.count ?? 0);
  }
}
