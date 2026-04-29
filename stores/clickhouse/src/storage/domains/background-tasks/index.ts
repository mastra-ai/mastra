import type { ClickHouseClient } from '@clickhouse/client';
import type {
  BackgroundTask,
  BackgroundTaskStatus,
  TaskFilter,
  TaskListResult,
  UpdateBackgroundTask,
} from '@mastra/core/background-tasks';
import { BackgroundTasksStorage, TABLE_BACKGROUND_TASKS, TABLE_SCHEMAS } from '@mastra/core/storage';
import { ClickhouseDB, resolveClickhouseConfig } from '../../db';
import type { ClickhouseDomainConfig } from '../../db';

function serializeJson(v: unknown): any {
  if (typeof v === 'object' && v != null) return JSON.stringify(v);
  return v ?? '';
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

export class BackgroundTasksStorageClickhouse extends BackgroundTasksStorage {
  protected client: ClickHouseClient;
  #db: ClickhouseDB;

  constructor(config: ClickhouseDomainConfig) {
    super();
    const { client, ttl } = resolveClickhouseConfig(config);
    this.client = client;
    this.#db = new ClickhouseDB({ client, ttl });
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_BACKGROUND_TASKS, schema: TABLE_SCHEMAS[TABLE_BACKGROUND_TASKS] });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_BACKGROUND_TASKS });
  }

  async createTask(task: BackgroundTask): Promise<void> {
    await this.client.insert({
      table: TABLE_BACKGROUND_TASKS,
      values: [
        {
          id: task.id,
          tool_call_id: task.toolCallId,
          tool_name: task.toolName,
          agent_id: task.agentId,
          thread_id: task.threadId ?? '',
          resource_id: task.resourceId ?? '',
          run_id: task.runId,
          status: task.status,
          args: serializeJson(task.args),
          result: serializeJson(task.result),
          error: serializeJson(task.error),
          retry_count: task.retryCount,
          max_retries: task.maxRetries,
          timeout_ms: task.timeoutMs,
          createdAt: task.createdAt.toISOString(),
          startedAt: task.startedAt?.toISOString() ?? '1970-01-01T00:00:00.000Z',
          completedAt: task.completedAt?.toISOString() ?? '1970-01-01T00:00:00.000Z',
        },
      ],
      format: 'JSONEachRow',
      clickhouse_settings: { date_time_input_format: 'best_effort' },
    });
  }

  async updateTask(taskId: string, update: UpdateBackgroundTask): Promise<void> {
    const existing = await this.getTask(taskId);
    if (!existing) return;
    const merged = { ...existing };
    if ('status' in update) merged.status = update.status!;
    if ('result' in update) merged.result = update.result;
    if ('error' in update) merged.error = update.error;
    if ('retryCount' in update) merged.retryCount = update.retryCount!;
    if ('startedAt' in update) merged.startedAt = update.startedAt;
    if ('completedAt' in update) merged.completedAt = update.completedAt;

    // ClickHouse ReplacingMergeTree — insert replaces by primary key
    await this.createTask(merged);
  }

  async getTask(taskId: string): Promise<BackgroundTask | null> {
    const result = await this.client.query({
      query: `SELECT * FROM ${TABLE_BACKGROUND_TASKS} FINAL WHERE id = {var_id:String} LIMIT 1`,
      query_params: { var_id: taskId },
      format: 'JSONEachRow',
      clickhouse_settings: { date_time_input_format: 'best_effort' },
    });
    const rows = await result.json<Record<string, any>[]>();
    return rows.length > 0 ? rowToTask(rows[0]!) : null;
  }

  async listTasks(filter: TaskFilter): Promise<TaskListResult> {
    const conditions: string[] = [];
    const params: Record<string, any> = {};

    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      conditions.push(`status IN ({var_statuses:Array(String)})`);
      params.var_statuses = statuses;
    }
    if (filter.agentId) {
      conditions.push(`agent_id = {var_agent:String}`);
      params.var_agent = filter.agentId;
    }
    if (filter.threadId) {
      conditions.push(`thread_id = {var_thread:String}`);
      params.var_thread = filter.threadId;
    }
    if (filter.runId) {
      conditions.push(`run_id = {var_run:String}`);
      params.var_run = filter.runId;
    }
    if (filter.toolName) {
      conditions.push(`tool_name = {var_tool:String}`);
      params.var_tool = filter.toolName;
    }

    // Push date range filtering into SQL so total count and LIMIT/OFFSET
    // agree with the in-memory Date objects `rowToTask` returns.
    const dateCol =
      filter.dateFilterBy === 'startedAt'
        ? 'startedAt'
        : filter.dateFilterBy === 'completedAt'
          ? 'completedAt'
          : 'createdAt';
    if (filter.fromDate) {
      conditions.push(`${dateCol} >= parseDateTimeBestEffort({var_from_date:String})`);
      params.var_from_date = filter.fromDate.toISOString();
    }
    if (filter.toDate) {
      conditions.push(`${dateCol} < parseDateTimeBestEffort({var_to_date:String})`);
      params.var_to_date = filter.toDate.toISOString();
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total matching rows (before pagination)
    const countResult = await this.client.query({
      query: `SELECT count() as count FROM ${TABLE_BACKGROUND_TASKS} FINAL ${where}`,
      query_params: params,
      format: 'JSONEachRow',
      clickhouse_settings: { date_time_input_format: 'best_effort' },
    });
    const countRows = (await countResult.json()) as any[];
    const total = Number(countRows[0]?.count ?? 0);

    const orderCol =
      filter.orderBy === 'startedAt' ? 'startedAt' : filter.orderBy === 'completedAt' ? 'completedAt' : 'createdAt';
    const direction = filter.orderDirection === 'desc' ? 'DESC' : 'ASC';
    let sql = `SELECT * FROM ${TABLE_BACKGROUND_TASKS} FINAL ${where} ORDER BY ${orderCol} ${direction}`;
    if (filter.perPage != null) {
      sql += ` LIMIT {var_limit:UInt32}`;
      params.var_limit = filter.perPage;
      if (filter.page != null) {
        sql += ` OFFSET {var_offset:UInt32}`;
        params.var_offset = filter.page * filter.perPage;
      }
    }

    const result = await this.client.query({
      query: sql,
      query_params: params,
      format: 'JSONEachRow',
      clickhouse_settings: { date_time_input_format: 'best_effort' },
    });
    const tasks = (await result.json<Record<string, any>[]>()).map(rowToTask);

    return { tasks, total };
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.client.query({
      query: `ALTER TABLE ${TABLE_BACKGROUND_TASKS} DELETE WHERE id = {var_id:String}`,
      query_params: { var_id: taskId },
      clickhouse_settings: { mutations_sync: '1' },
    });
  }

  async deleteTasks(filter: TaskFilter): Promise<void> {
    const { tasks } = await this.listTasks(filter);
    for (const task of tasks) {
      await this.client.query({
        query: `ALTER TABLE ${TABLE_BACKGROUND_TASKS} DELETE WHERE id = {var_id:String}`,
        query_params: { var_id: task.id },
        clickhouse_settings: { mutations_sync: '1' },
      });
    }
  }

  async getRunningCount(): Promise<number> {
    const result = await this.client.query({
      query: `SELECT count() as count FROM ${TABLE_BACKGROUND_TASKS} FINAL WHERE status = 'running'`,
      format: 'JSONEachRow',
    });
    const rows = (await result.json()) as any[];
    return Number(rows[0]?.count ?? 0);
  }

  async getRunningCountByAgent(agentId: string): Promise<number> {
    const result = await this.client.query({
      query: `SELECT count() as count FROM ${TABLE_BACKGROUND_TASKS} FINAL WHERE status = 'running' AND agent_id = {var_agent:String}`,
      query_params: { var_agent: agentId },
      format: 'JSONEachRow',
    });
    const rows = (await result.json()) as any[];
    return Number(rows[0]?.count ?? 0);
  }
}
