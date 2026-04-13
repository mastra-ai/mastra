import type {
  BackgroundTask,
  BackgroundTaskStatus,
  TaskFilter,
  TaskListResult,
  UpdateBackgroundTask,
} from '@mastra/core/background-tasks';
import type { CreateIndexOptions } from '@mastra/core/storage';
import { BackgroundTasksStorage, TABLE_BACKGROUND_TASKS, TABLE_SCHEMAS } from '@mastra/core/storage';
import type { ConnectionPool } from 'mssql';
import { MssqlDB, resolveMssqlConfig } from '../../db';
import type { MssqlDomainConfig } from '../../db';
import { getSchemaName, getTableName } from '../utils';

function serializeJson(v: unknown): any {
  if (typeof v === 'object' && v != null) return JSON.stringify(v);
  return v ?? null;
}

function rowToTask(row: Record<string, any>): BackgroundTask {
  const parseJson = (val: unknown): any => {
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
    id: row.id,
    status: row.status as BackgroundTaskStatus,
    toolName: row.tool_name,
    toolCallId: row.tool_call_id,
    args: parseJson(row.args) ?? {},
    agentId: row.agent_id,
    threadId: row.thread_id ?? undefined,
    resourceId: row.resource_id ?? undefined,
    runId: row.run_id ?? '',
    result: parseJson(row.result),
    error: parseJson(row.error),
    retryCount: Number(row.retry_count),
    maxRetries: Number(row.max_retries),
    timeoutMs: Number(row.timeout_ms),
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    startedAt: row.startedAt ? (row.startedAt instanceof Date ? row.startedAt : new Date(row.startedAt)) : undefined,
    completedAt: row.completedAt
      ? row.completedAt instanceof Date
        ? row.completedAt
        : new Date(row.completedAt)
      : undefined,
  };
}

export class BackgroundTasksMSSQL extends BackgroundTasksStorage {
  public pool: ConnectionPool;
  private db: MssqlDB;
  private schema?: string;
  private needsConnect: boolean;
  private skipDefaultIndexes?: boolean;
  private indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_BACKGROUND_TASKS] as const;

  constructor(config: MssqlDomainConfig) {
    super();
    const { pool, schemaName, skipDefaultIndexes, indexes, needsConnect } = resolveMssqlConfig(config);
    this.pool = pool;
    this.schema = schemaName;
    this.db = new MssqlDB({ pool, schemaName, skipDefaultIndexes });
    this.needsConnect = needsConnect;
    this.skipDefaultIndexes = skipDefaultIndexes;
    this.indexes = indexes?.filter(idx =>
      (BackgroundTasksMSSQL.MANAGED_TABLES as readonly string[]).includes(idx.table),
    );
  }

  async init(): Promise<void> {
    if (this.needsConnect) {
      await this.pool.connect();
      this.needsConnect = false;
    }
    await this.db.createTable({
      tableName: TABLE_BACKGROUND_TASKS,
      schema: TABLE_SCHEMAS[TABLE_BACKGROUND_TASKS],
    });
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
    const params: Record<string, any> = {};
    let idx = 1;

    if ('status' in update) {
      setClauses.push(`[status] = @p${idx}`);
      params[`p${idx++}`] = update.status;
    }
    if ('result' in update) {
      setClauses.push(`[result] = @p${idx}`);
      params[`p${idx++}`] = serializeJson(update.result);
    }
    if ('error' in update) {
      setClauses.push(`[error] = @p${idx}`);
      params[`p${idx++}`] = serializeJson(update.error);
    }
    if ('retryCount' in update) {
      setClauses.push(`[retry_count] = @p${idx}`);
      params[`p${idx++}`] = update.retryCount;
    }
    if ('startedAt' in update) {
      setClauses.push(`[startedAt] = @p${idx}`);
      params[`p${idx++}`] = update.startedAt?.toISOString() ?? null;
    }
    if ('completedAt' in update) {
      setClauses.push(`[completedAt] = @p${idx}`);
      params[`p${idx++}`] = update.completedAt?.toISOString() ?? null;
    }

    if (setClauses.length === 0) return;

    setClauses.push(`[id] = [id]`); // no-op to ensure valid SET
    params[`p${idx}`] = taskId;

    const request = this.pool.request();
    for (const [name, value] of Object.entries(params)) {
      request.input(name, value);
    }

    await request.query(`UPDATE ${this.tableName()} SET ${setClauses.join(', ')} WHERE [id] = @p${idx}`);
  }

  async getTask(taskId: string): Promise<BackgroundTask | null> {
    const request = this.pool.request();
    request.input('p1', taskId);
    const result = await request.query(`SELECT * FROM ${this.tableName()} WHERE [id] = @p1`);
    if (result.recordset.length === 0) return null;
    return rowToTask(result.recordset[0]);
  }

  async listTasks(filter: TaskFilter): Promise<TaskListResult> {
    const conditions: string[] = [];
    const params: Record<string, any> = {};
    let idx = 1;

    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      const placeholders = statuses.map(() => {
        const name = `p${idx++}`;
        return `@${name}`;
      });
      statuses.forEach((s, i) => {
        params[`p${idx - statuses.length + i}`] = s;
      });
      conditions.push(`[status] IN (${placeholders.join(', ')})`);
    }
    if (filter.agentId) {
      params[`p${idx}`] = filter.agentId;
      conditions.push(`[agent_id] = @p${idx++}`);
    }
    if (filter.threadId) {
      params[`p${idx}`] = filter.threadId;
      conditions.push(`[thread_id] = @p${idx++}`);
    }
    if (filter.resourceId) {
      params[`p${idx}`] = filter.resourceId;
      conditions.push(`[resource_id] = @p${idx++}`);
    }
    if (filter.runId) {
      params[`p${idx}`] = filter.runId;
      conditions.push(`[run_id] = @p${idx++}`);
    }
    if (filter.toolName) {
      params[`p${idx}`] = filter.toolName;
      conditions.push(`[tool_name] = @p${idx++}`);
    }
    // Date range filtering
    const dateCol =
      filter.dateFilterBy === 'startedAt'
        ? '[startedAt]'
        : filter.dateFilterBy === 'completedAt'
          ? '[completedAt]'
          : '[createdAt]';
    if (filter.fromDate) {
      params[`p${idx}`] = filter.fromDate.toISOString();
      conditions.push(`${dateCol} >= @p${idx++}`);
    }
    if (filter.toDate) {
      params[`p${idx}`] = filter.toDate.toISOString();
      conditions.push(`${dateCol} < @p${idx++}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total matching rows (before pagination)
    const countRequest = this.pool.request();
    for (const [name, value] of Object.entries(params)) {
      countRequest.input(name, value);
    }
    const countResult = await countRequest.query(`SELECT COUNT(*) as count FROM ${this.tableName()} ${where}`);
    const total = Number(countResult.recordset[0]?.count ?? 0);

    const orderCol =
      filter.orderBy === 'startedAt'
        ? '[startedAt]'
        : filter.orderBy === 'completedAt'
          ? '[completedAt]'
          : '[createdAt]';
    const direction = filter.orderDirection === 'desc' ? 'DESC' : 'ASC';

    let sql = `SELECT * FROM ${this.tableName()} ${where} ORDER BY ${orderCol} ${direction}`;

    if (filter.perPage != null) {
      const offset = filter.page != null ? filter.page * filter.perPage : 0;
      params[`p${idx}`] = offset;
      params[`p${idx + 1}`] = filter.perPage;
      sql += ` OFFSET @p${idx} ROWS FETCH NEXT @p${idx + 1} ROWS ONLY`;
      idx += 2;
    }

    const request = this.pool.request();
    for (const [name, value] of Object.entries(params)) {
      request.input(name, value);
    }

    const result = await request.query(sql);
    return { tasks: result.recordset.map(rowToTask), total };
  }

  async deleteTask(taskId: string): Promise<void> {
    const request = this.pool.request();
    request.input('p1', taskId);
    await request.query(`DELETE FROM ${this.tableName()} WHERE [id] = @p1`);
  }

  async deleteTasks(filter: TaskFilter): Promise<void> {
    const conditions: string[] = [];
    const params: Record<string, any> = {};
    let idx = 1;

    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      const placeholders = statuses.map(() => {
        const name = `p${idx++}`;
        return `@${name}`;
      });
      statuses.forEach((s, i) => {
        params[`p${idx - statuses.length + i}`] = s;
      });
      conditions.push(`[status] IN (${placeholders.join(', ')})`);
    }
    // Date range filtering
    const dateCol =
      filter.dateFilterBy === 'startedAt'
        ? '[startedAt]'
        : filter.dateFilterBy === 'completedAt'
          ? '[completedAt]'
          : '[createdAt]';
    if (filter.fromDate) {
      params[`p${idx}`] = filter.fromDate.toISOString();
      conditions.push(`${dateCol} >= @p${idx++}`);
    }
    if (filter.toDate) {
      params[`p${idx}`] = filter.toDate.toISOString();
      conditions.push(`${dateCol} < @p${idx++}`);
    }
    if (filter.agentId) {
      params[`p${idx}`] = filter.agentId;
      conditions.push(`[agent_id] = @p${idx++}`);
    }
    if (filter.runId) {
      params[`p${idx}`] = filter.runId;
      conditions.push(`[run_id] = @p${idx++}`);
    }

    if (conditions.length === 0) return;

    const request = this.pool.request();
    for (const [name, value] of Object.entries(params)) {
      request.input(name, value);
    }

    await request.query(`DELETE FROM ${this.tableName()} WHERE ${conditions.join(' AND ')}`);
  }

  async getRunningCount(): Promise<number> {
    const result = await this.pool
      .request()
      .query(`SELECT COUNT(*) as count FROM ${this.tableName()} WHERE [status] = 'running'`);
    return Number(result.recordset[0]?.count ?? 0);
  }

  async getRunningCountByAgent(agentId: string): Promise<number> {
    const request = this.pool.request();
    request.input('p1', agentId);
    const result = await request.query(
      `SELECT COUNT(*) as count FROM ${this.tableName()} WHERE [status] = 'running' AND [agent_id] = @p1`,
    );
    return Number(result.recordset[0]?.count ?? 0);
  }
}
