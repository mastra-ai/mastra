import type {
  BackgroundTask,
  BackgroundTaskStatus,
  TaskFilter,
  TaskListResult,
  UpdateBackgroundTask,
} from '@mastra/core/background-tasks';
import { BackgroundTasksStorage, TABLE_BACKGROUND_TASKS, TABLE_SCHEMAS } from '@mastra/core/storage';
import { D1DB, resolveD1Config } from '../../db';
import type { D1DomainConfig } from '../../db';
import { createSqlBuilder } from '../../sql-builder';

function serializeJson(v: unknown): any {
  if (typeof v === 'object' && v != null) return JSON.stringify(v);
  return v ?? null;
}

function rowToTask(row: Record<string, any>): BackgroundTask {
  const parseJson = (val: unknown): any => {
    if (val == null || val === '') return undefined;
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
    id: row.id,
    status: row.status as BackgroundTaskStatus,
    toolName: row.tool_name,
    toolCallId: row.tool_call_id,
    args: parseJson(row.args) ?? {},
    agentId: row.agent_id,
    threadId: row.thread_id || undefined,
    resourceId: row.resource_id || undefined,
    runId: row.run_id ?? '',
    result: parseJson(row.result),
    error: parseJson(row.error),
    retryCount: Number(row.retry_count ?? 0),
    maxRetries: Number(row.max_retries ?? 0),
    timeoutMs: Number(row.timeout_ms ?? 300_000),
    createdAt: new Date(row.createdAt),
    startedAt: row.startedAt ? new Date(row.startedAt) : undefined,
    completedAt: row.completedAt ? new Date(row.completedAt) : undefined,
  };
}

export class BackgroundTasksStorageD1 extends BackgroundTasksStorage {
  #db: D1DB;

  constructor(config: D1DomainConfig) {
    super();
    const resolved = resolveD1Config(config);
    this.#db = new D1DB(resolved);
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_BACKGROUND_TASKS, schema: TABLE_SCHEMAS[TABLE_BACKGROUND_TASKS] });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_BACKGROUND_TASKS });
  }

  async createTask(task: BackgroundTask): Promise<void> {
    const fullTableName = this.#db.getTableName(TABLE_BACKGROUND_TASKS);
    const { sql, params } = createSqlBuilder()
      .insert(
        fullTableName,
        [
          'id',
          'tool_call_id',
          'tool_name',
          'agent_id',
          'thread_id',
          'resource_id',
          'run_id',
          'status',
          'args',
          'result',
          'error',
          'retry_count',
          'max_retries',
          'timeout_ms',
          'createdAt',
          'startedAt',
          'completedAt',
        ],
        [
          task.id,
          task.toolCallId,
          task.toolName,
          task.agentId,
          task.threadId ?? null,
          task.resourceId ?? null,
          task.runId,
          task.status,
          serializeJson(task.args),
          serializeJson(task.result),
          serializeJson(task.error),
          task.retryCount,
          task.maxRetries,
          task.timeoutMs,
          task.createdAt.toISOString(),
          task.startedAt?.toISOString() ?? null,
          task.completedAt?.toISOString() ?? null,
        ],
      )
      .build();
    await this.#db.executeQuery({ sql, params });
  }

  async updateTask(taskId: string, update: UpdateBackgroundTask): Promise<void> {
    const sets: string[] = [];
    const params: any[] = [];
    if ('status' in update) {
      sets.push('status = ?');
      params.push(update.status);
    }
    if ('result' in update) {
      sets.push('result = ?');
      params.push(serializeJson(update.result));
    }
    if ('error' in update) {
      sets.push('error = ?');
      params.push(serializeJson(update.error));
    }
    if ('retryCount' in update) {
      sets.push('retry_count = ?');
      params.push(update.retryCount);
    }
    if ('startedAt' in update) {
      sets.push('startedAt = ?');
      params.push(update.startedAt?.toISOString() ?? null);
    }
    if ('completedAt' in update) {
      sets.push('completedAt = ?');
      params.push(update.completedAt?.toISOString() ?? null);
    }
    if (sets.length === 0) return;
    params.push(taskId);
    const fullTableName = this.#db.getTableName(TABLE_BACKGROUND_TASKS);
    await this.#db.executeQuery({
      sql: `UPDATE ${fullTableName} SET ${sets.join(', ')} WHERE id = ?`,
      params,
    });
  }

  async getTask(taskId: string): Promise<BackgroundTask | null> {
    const fullTableName = this.#db.getTableName(TABLE_BACKGROUND_TASKS);
    const { sql, params } = createSqlBuilder().select('*').from(fullTableName).where('id = ?', taskId).build();
    const row = await this.#db.executeQuery({ sql, params, first: true });
    return row ? rowToTask(row as Record<string, any>) : null;
  }

  async listTasks(filter: TaskFilter): Promise<TaskListResult> {
    const fullTableName = this.#db.getTableName(TABLE_BACKGROUND_TASKS);
    let builder = createSqlBuilder().select('*').from(fullTableName);
    let countBuilder = createSqlBuilder().count().from(fullTableName);
    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      builder = builder.where(`status IN (${statuses.map(() => '?').join(',')})`, ...statuses);
      countBuilder = countBuilder.where(`status IN (${statuses.map(() => '?').join(',')})`, ...statuses);
    }
    if (filter.agentId) {
      builder = builder.whereAnd('agent_id = ?', filter.agentId);
      countBuilder = countBuilder.whereAnd('agent_id = ?', filter.agentId);
    }
    if (filter.threadId) {
      builder = builder.whereAnd('thread_id = ?', filter.threadId);
      countBuilder = countBuilder.whereAnd('thread_id = ?', filter.threadId);
    }
    if (filter.runId) {
      builder = builder.whereAnd('run_id = ?', filter.runId);
      countBuilder = countBuilder.whereAnd('run_id = ?', filter.runId);
    }
    if (filter.toolName) {
      builder = builder.whereAnd('tool_name = ?', filter.toolName);
      countBuilder = countBuilder.whereAnd('tool_name = ?', filter.toolName);
    }
    // Date range filtering
    const dateCol =
      filter.dateFilterBy === 'startedAt'
        ? 'startedAt'
        : filter.dateFilterBy === 'completedAt'
          ? 'completedAt'
          : 'createdAt';
    if (filter.fromDate) {
      builder = builder.whereAnd(`${dateCol} >= ?`, filter.fromDate.toISOString());
      countBuilder = countBuilder.whereAnd(`${dateCol} >= ?`, filter.fromDate.toISOString());
    }
    if (filter.toDate) {
      builder = builder.whereAnd(`${dateCol} < ?`, filter.toDate.toISOString());
      countBuilder = countBuilder.whereAnd(`${dateCol} < ?`, filter.toDate.toISOString());
    }

    // Count total matching rows (before pagination)
    const { sql: countSql, params: countParams } = countBuilder.build();
    const countRow = await this.#db.executeQuery({ sql: countSql, params: countParams, first: true });
    const total = Number((countRow as any)?.count ?? 0);

    const orderCol =
      filter.orderBy === 'startedAt' ? 'startedAt' : filter.orderBy === 'completedAt' ? 'completedAt' : 'createdAt';
    builder = builder.orderBy(orderCol, filter.orderDirection === 'desc' ? 'DESC' : 'ASC');
    if (filter.perPage != null) {
      builder = builder.limit(filter.perPage);
      if (filter.page != null) {
        builder = builder.offset(filter.page * filter.perPage);
      }
    }

    const { sql, params } = builder.build();
    const rows = await this.#db.executeQuery({ sql, params });
    return { tasks: (rows as Record<string, any>[]).map(rowToTask), total };
  }

  async deleteTask(taskId: string): Promise<void> {
    const fullTableName = this.#db.getTableName(TABLE_BACKGROUND_TASKS);
    await this.#db.executeQuery({ sql: `DELETE FROM ${fullTableName} WHERE id = ?`, params: [taskId] });
  }

  async deleteTasks(filter: TaskFilter): Promise<void> {
    const conditions: string[] = [];
    const params: any[] = [];
    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      conditions.push(`status IN (${statuses.map(() => '?').join(',')})`);
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
    if (conditions.length === 0) return;
    const fullTableName = this.#db.getTableName(TABLE_BACKGROUND_TASKS);
    await this.#db.executeQuery({
      sql: `DELETE FROM ${fullTableName} WHERE ${conditions.join(' AND ')}`,
      params,
    });
  }

  async getRunningCount(): Promise<number> {
    const fullTableName = this.#db.getTableName(TABLE_BACKGROUND_TASKS);
    const row = await this.#db.executeQuery({
      sql: `SELECT COUNT(*) as count FROM ${fullTableName} WHERE status = 'running'`,
      params: [],
      first: true,
    });
    return Number((row as any)?.count ?? 0);
  }

  async getRunningCountByAgent(agentId: string): Promise<number> {
    const fullTableName = this.#db.getTableName(TABLE_BACKGROUND_TASKS);
    const row = await this.#db.executeQuery({
      sql: `SELECT COUNT(*) as count FROM ${fullTableName} WHERE status = 'running' AND agent_id = ?`,
      params: [agentId],
      first: true,
    });
    return Number((row as any)?.count ?? 0);
  }
}
