import type { Client, InValue } from '@libsql/client';
import type {
  BackgroundTask,
  BackgroundTaskStatus,
  TaskFilter,
  TaskListResult,
  UpdateBackgroundTask,
} from '@mastra/core/background-tasks';
import { BackgroundTasksStorage, TABLE_BACKGROUND_TASKS, TABLE_SCHEMAS } from '@mastra/core/storage';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import { buildSelectColumns } from '../../db/utils';

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
    retryCount: Number(row.retry_count),
    maxRetries: Number(row.max_retries),
    timeoutMs: Number(row.timeout_ms),
    createdAt: new Date(String(row.createdAt)),
    startedAt: row.startedAt ? new Date(String(row.startedAt)) : undefined,
    completedAt: row.completedAt ? new Date(String(row.completedAt)) : undefined,
  };
}

export class BackgroundTasksLibSQL extends BackgroundTasksStorage {
  #db: LibSQLDB;
  #client: Client;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#client = client;
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    await this.#db.createTable({
      tableName: TABLE_BACKGROUND_TASKS,
      schema: TABLE_SCHEMAS[TABLE_BACKGROUND_TASKS],
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_BACKGROUND_TASKS });
  }

  async createTask(task: BackgroundTask): Promise<void> {
    // Note: don't JSON.stringify jsonb fields — LibSQLDB.insert handles that via schema
    await this.#db.insert({
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
        args: task.args,
        result: task.result ?? null,
        error: task.error ?? null,
        retry_count: task.retryCount,
        max_retries: task.maxRetries,
        timeout_ms: task.timeoutMs,
        createdAt: task.createdAt.toISOString(),
        startedAt: task.startedAt?.toISOString() ?? null,
        completedAt: task.completedAt?.toISOString() ?? null,
      },
    });
  }

  async updateTask(taskId: string, update: UpdateBackgroundTask): Promise<void> {
    const setClauses: string[] = [];
    const params: InValue[] = [];

    if ('status' in update) {
      setClauses.push('status = ?');
      params.push(update.status as string);
    }
    if ('result' in update) {
      setClauses.push('result = jsonb(?)');
      params.push(serializeJson(update.result));
    }
    if ('error' in update) {
      setClauses.push('error = jsonb(?)');
      params.push(serializeJson(update.error));
    }
    if ('retryCount' in update) {
      setClauses.push('retry_count = ?');
      params.push(update.retryCount as number);
    }
    if ('startedAt' in update) {
      setClauses.push('startedAt = ?');
      params.push(update.startedAt?.toISOString() ?? null);
    }
    if ('completedAt' in update) {
      setClauses.push('completedAt = ?');
      params.push(update.completedAt?.toISOString() ?? null);
    }

    if (setClauses.length === 0) return;

    params.push(taskId);
    await this.#client.execute({
      sql: `UPDATE ${TABLE_BACKGROUND_TASKS} SET ${setClauses.join(', ')} WHERE id = ?`,
      args: params,
    });
  }

  async getTask(taskId: string): Promise<BackgroundTask | null> {
    const result = await this.#client.execute({
      sql: `SELECT ${buildSelectColumns(TABLE_BACKGROUND_TASKS)} FROM ${TABLE_BACKGROUND_TASKS} WHERE id = ?`,
      args: [taskId],
    });
    const row = result.rows[0];
    return row ? rowToTask(row as Record<string, any>) : null;
  }

  async listTasks(filter: TaskFilter): Promise<TaskListResult> {
    const conditions: string[] = [];
    const params: InValue[] = [];

    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      conditions.push(`status IN (${statuses.map(() => '?').join(', ')})`);
      params.push(...statuses);
    }
    if (filter.agentId) {
      conditions.push('agent_id = ?');
      params.push(filter.agentId);
    }
    if (filter.threadId) {
      conditions.push('thread_id = ?');
      params.push(filter.threadId);
    }
    if (filter.runId) {
      conditions.push('run_id = ?');
      params.push(filter.runId);
    }
    if (filter.resourceId) {
      conditions.push('resource_id = ?');
      params.push(filter.resourceId);
    }
    if (filter.toolName) {
      conditions.push('tool_name = ?');
      params.push(filter.toolName);
    }
    // Date range filtering
    const dateCol =
      filter.dateFilterBy === 'startedAt'
        ? 'startedAt'
        : filter.dateFilterBy === 'completedAt'
          ? 'completedAt'
          : 'createdAt';
    if (filter.fromDate) {
      conditions.push(`${dateCol} >= ?`);
      params.push(filter.fromDate.toISOString());
    }
    if (filter.toDate) {
      conditions.push(`${dateCol} < ?`);
      params.push(filter.toDate.toISOString());
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total matching rows (before pagination)
    const countResult = await this.#client.execute({
      sql: `SELECT COUNT(*) as count FROM ${TABLE_BACKGROUND_TASKS} ${where}`,
      args: [...params],
    });
    const total = Number(countResult.rows[0]?.count ?? 0);

    const orderCol =
      filter.orderBy === 'startedAt' ? 'startedAt' : filter.orderBy === 'completedAt' ? 'completedAt' : 'createdAt';
    const direction = filter.orderDirection === 'desc' ? 'DESC' : 'ASC';

    let sql = `SELECT ${buildSelectColumns(TABLE_BACKGROUND_TASKS)} FROM ${TABLE_BACKGROUND_TASKS} ${where} ORDER BY ${orderCol} ${direction}`;

    if (filter.perPage != null) {
      sql += ' LIMIT ?';
      params.push(filter.perPage);
      if (filter.page != null) {
        sql += ' OFFSET ?';
        params.push(filter.page * filter.perPage);
      }
    }

    const result = await this.#client.execute({ sql, args: params });
    return { tasks: result.rows.map(row => rowToTask(row as Record<string, any>)), total };
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.#client.execute({
      sql: `DELETE FROM ${TABLE_BACKGROUND_TASKS} WHERE id = ?`,
      args: [taskId],
    });
  }

  async deleteTasks(filter: TaskFilter): Promise<void> {
    const conditions: string[] = [];
    const params: InValue[] = [];

    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      conditions.push(`status IN (${statuses.map(() => '?').join(', ')})`);
      params.push(...statuses);
    }
    // Date range filtering
    const dateCol =
      filter.dateFilterBy === 'startedAt'
        ? 'startedAt'
        : filter.dateFilterBy === 'completedAt'
          ? 'completedAt'
          : 'createdAt';
    if (filter.fromDate) {
      conditions.push(`${dateCol} >= ?`);
      params.push(filter.fromDate.toISOString());
    }
    if (filter.toDate) {
      conditions.push(`${dateCol} < ?`);
      params.push(filter.toDate.toISOString());
    }
    if (filter.agentId) {
      conditions.push('agent_id = ?');
      params.push(filter.agentId);
    }
    if (filter.runId) {
      conditions.push('run_id = ?');
      params.push(filter.runId);
    }

    if (conditions.length === 0) return; // Safety: don't delete everything

    await this.#client.execute({
      sql: `DELETE FROM ${TABLE_BACKGROUND_TASKS} WHERE ${conditions.join(' AND ')}`,
      args: params,
    });
  }

  async getRunningCount(): Promise<number> {
    const result = await this.#client.execute({
      sql: `SELECT COUNT(*) as count FROM ${TABLE_BACKGROUND_TASKS} WHERE status = 'running'`,
      args: [],
    });
    return Number(result.rows[0]?.count ?? 0);
  }

  async getRunningCountByAgent(agentId: string): Promise<number> {
    const result = await this.#client.execute({
      sql: `SELECT COUNT(*) as count FROM ${TABLE_BACKGROUND_TASKS} WHERE status = 'running' AND agent_id = ?`,
      args: [agentId],
    });
    return Number(result.rows[0]?.count ?? 0);
  }
}
