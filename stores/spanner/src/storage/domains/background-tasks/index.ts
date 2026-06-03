import type { Database } from '@google-cloud/spanner';
import type {
  BackgroundTask,
  BackgroundTaskStatus,
  TaskFilter,
  TaskListResult,
  UpdateBackgroundTask,
} from '@mastra/core/background-tasks';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { CreateIndexOptions } from '@mastra/core/storage';
import {
  BackgroundTasksStorage,
  createStorageErrorId,
  TABLE_BACKGROUND_TASKS,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import { SpannerDB, resolveSpannerConfig } from '../../db';
import type { SpannerDomainConfig } from '../../db';
import { quoteIdent } from '../../db/utils';
import { transformFromSpannerRow } from '../utils';

function buildStatusCondition(
  filter: TaskFilter,
  params: Record<string, any>,
  startIdx: number,
): { kind: 'no-filter' } | { kind: 'empty' } | { kind: 'sql'; sql: string; nextIdx: number } {
  if (filter.status === undefined) return { kind: 'no-filter' };
  const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
  if (statuses.length === 0) return { kind: 'empty' };
  const placeholders: string[] = [];
  let idx = startIdx;
  for (const status of statuses) {
    const name = `p${idx++}`;
    params[name] = status;
    placeholders.push(`@${name}`);
  }
  return {
    kind: 'sql',
    sql: `${quoteIdent('status', 'column name')} IN (${placeholders.join(', ')})`,
    nextIdx: idx,
  };
}

function rowToTask(row: Record<string, any>): BackgroundTask {
  const transformed = transformFromSpannerRow<Record<string, any>>({ tableName: TABLE_BACKGROUND_TASKS, row });
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
  const suspendPayload = parseJson(transformed.suspend_payload);
  return {
    id: transformed.id,
    status: transformed.status as BackgroundTaskStatus,
    toolName: transformed.tool_name,
    toolCallId: transformed.tool_call_id,
    args: parseJson(transformed.args) ?? {},
    agentId: transformed.agent_id,
    threadId: transformed.thread_id ?? undefined,
    resourceId: transformed.resource_id ?? undefined,
    runId: transformed.run_id ?? '',
    result: parseJson(transformed.result),
    error: parseJson(transformed.error),
    suspendPayload: suspendPayload === null ? undefined : suspendPayload,
    retryCount: Number(transformed.retry_count),
    maxRetries: Number(transformed.max_retries),
    timeoutMs: Number(transformed.timeout_ms),
    createdAt: transformed.createdAt instanceof Date ? transformed.createdAt : new Date(transformed.createdAt),
    startedAt: transformed.startedAt
      ? transformed.startedAt instanceof Date
        ? transformed.startedAt
        : new Date(transformed.startedAt)
      : undefined,
    suspendedAt: transformed.suspendedAt
      ? transformed.suspendedAt instanceof Date
        ? transformed.suspendedAt
        : new Date(transformed.suspendedAt)
      : undefined,
    completedAt: transformed.completedAt
      ? transformed.completedAt instanceof Date
        ? transformed.completedAt
        : new Date(transformed.completedAt)
      : undefined,
  };
}

export class BackgroundTasksSpanner extends BackgroundTasksStorage {
  private database: Database;
  private db: SpannerDB;
  private skipDefaultIndexes?: boolean;
  private indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_BACKGROUND_TASKS] as const;

  constructor(config: SpannerDomainConfig) {
    super();
    const { database, indexes, skipDefaultIndexes, initMode } = resolveSpannerConfig(config);
    this.database = database;
    this.db = new SpannerDB({ database, skipDefaultIndexes, initMode });
    this.skipDefaultIndexes = skipDefaultIndexes;
    this.indexes = indexes?.filter(idx =>
      (BackgroundTasksSpanner.MANAGED_TABLES as readonly string[]).includes(idx.table),
    );
  }

  async init(): Promise<void> {
    await this.db.createTable({
      tableName: TABLE_BACKGROUND_TASKS,
      schema: TABLE_SCHEMAS[TABLE_BACKGROUND_TASKS],
    });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    // Indexes here cover every filter shape that listTasks / deleteTasks
    // accept (status, agent_id, thread_id, tool_call_id, run_id,
    // resource_id, tool_name) plus the createdAt ordering used as the
    // default sort. Operators with workloads that would hot-spot on the
    // monotonically-increasing createdAt column can opt out via
    // `skipDefaultIndexes` and supply hashed alternatives.
    return [
      {
        name: 'mastra_bg_tasks_status_created_at_idx',
        table: TABLE_BACKGROUND_TASKS,
        columns: ['status', 'createdAt'],
      },
      {
        name: 'mastra_bg_tasks_agent_status_idx',
        table: TABLE_BACKGROUND_TASKS,
        columns: ['agent_id', 'status'],
      },
      {
        name: 'mastra_bg_tasks_thread_idx',
        table: TABLE_BACKGROUND_TASKS,
        columns: ['thread_id', 'createdAt'],
      },
      {
        name: 'mastra_bg_tasks_tool_call_idx',
        table: TABLE_BACKGROUND_TASKS,
        columns: ['tool_call_id'],
      },
      // listTasks({ runId })  runs scoped to a single workflow run.
      {
        name: 'mastra_bg_tasks_run_id_idx',
        table: TABLE_BACKGROUND_TASKS,
        columns: ['run_id'],
      },
      // listTasks({ resourceId, ... })  resource-scoped listings.
      {
        name: 'mastra_bg_tasks_resource_id_created_at_idx',
        table: TABLE_BACKGROUND_TASKS,
        columns: ['resource_id', 'createdAt'],
      },
      // listTasks({ toolName, ... })  per-tool dashboards / metrics.
      {
        name: 'mastra_bg_tasks_tool_name_created_at_idx',
        table: TABLE_BACKGROUND_TASKS,
        columns: ['tool_name', 'createdAt'],
      },
    ];
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.skipDefaultIndexes) return;
    await this.db.createIndexes(this.getDefaultIndexDefinitions());
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.indexes || this.indexes.length === 0) return;
    await this.db.createIndexes(this.indexes);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.db.clearTable({ tableName: TABLE_BACKGROUND_TASKS });
  }

  private tableName(): string {
    return quoteIdent(TABLE_BACKGROUND_TASKS, 'table name');
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
        args: task.args,
        result: task.result ?? null,
        error: task.error ?? null,
        suspend_payload: task.suspendPayload ?? null,
        retry_count: task.retryCount,
        max_retries: task.maxRetries,
        timeout_ms: task.timeoutMs,
        createdAt: task.createdAt,
        startedAt: task.startedAt ?? null,
        suspendedAt: task.suspendedAt ?? null,
        completedAt: task.completedAt ?? null,
      },
    });
  }

  async updateTask(taskId: string, update: UpdateBackgroundTask): Promise<void> {
    const data: Record<string, any> = {};
    if ('status' in update) data.status = update.status;
    if ('result' in update) data.result = update.result ?? null;
    if ('error' in update) data.error = update.error ?? null;
    if ('suspendPayload' in update) data.suspend_payload = update.suspendPayload ?? null;
    if ('retryCount' in update) data.retry_count = update.retryCount;
    if ('startedAt' in update) data.startedAt = update.startedAt ?? null;
    if ('suspendedAt' in update) data.suspendedAt = update.suspendedAt ?? null;
    if ('completedAt' in update) data.completedAt = update.completedAt ?? null;
    if (Object.keys(data).length === 0) return;
    await this.db.update({ tableName: TABLE_BACKGROUND_TASKS, keys: { id: taskId }, data });
  }

  async getTask(taskId: string): Promise<BackgroundTask | null> {
    const [rows] = await this.database.run({
      sql: `SELECT * FROM ${this.tableName()} WHERE id = @id LIMIT 1`,
      params: { id: taskId },
      json: true,
    });
    const row = (rows as Array<Record<string, any>>)[0];
    if (!row) return null;
    return rowToTask(row);
  }

  async listTasks(filter: TaskFilter): Promise<TaskListResult> {
    if (filter.page !== undefined && filter.page < 0) {
      throw new MastraError({
        id: createStorageErrorId('SPANNER', 'LIST_TASKS', 'INVALID_PAGE'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'page must be >= 0',
        details: { page: filter.page },
      });
    }
    if (filter.perPage !== undefined && filter.perPage < 0) {
      throw new MastraError({
        id: createStorageErrorId('SPANNER', 'LIST_TASKS', 'INVALID_PER_PAGE'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'perPage must be >= 0',
        details: { perPage: filter.perPage },
      });
    }

    const conditions: string[] = [];
    const params: Record<string, any> = {};
    // Spanner needs an explicit `timestamp` type hint for date params bound as
    // ISO strings (otherwise the client infers `string` and the predicate
    // fails the STRING -> TIMESTAMP coercion).
    const types: Record<string, any> = {};
    let idx = 1;

    const statusCondition = buildStatusCondition(filter, params, idx);
    if (statusCondition.kind === 'empty') {
      // Explicit empty status array means "match nothing"  short-circuit
      // so we never emit invalid `status IN ()` SQL.
      return { tasks: [], total: 0 };
    }
    if (statusCondition.kind === 'sql') {
      conditions.push(statusCondition.sql);
      idx = statusCondition.nextIdx;
    }
    if (filter.agentId) {
      const name = `p${idx++}`;
      params[name] = filter.agentId;
      conditions.push(`${quoteIdent('agent_id', 'column name')} = @${name}`);
    }
    if (filter.threadId) {
      const name = `p${idx++}`;
      params[name] = filter.threadId;
      conditions.push(`${quoteIdent('thread_id', 'column name')} = @${name}`);
    }
    if (filter.resourceId) {
      const name = `p${idx++}`;
      params[name] = filter.resourceId;
      conditions.push(`${quoteIdent('resource_id', 'column name')} = @${name}`);
    }
    if (filter.runId) {
      const name = `p${idx++}`;
      params[name] = filter.runId;
      conditions.push(`${quoteIdent('run_id', 'column name')} = @${name}`);
    }
    if (filter.toolName) {
      const name = `p${idx++}`;
      params[name] = filter.toolName;
      conditions.push(`${quoteIdent('tool_name', 'column name')} = @${name}`);
    }
    if (filter.toolCallId) {
      const name = `p${idx++}`;
      params[name] = filter.toolCallId;
      conditions.push(`${quoteIdent('tool_call_id', 'column name')} = @${name}`);
    }
    const dateCol =
      filter.dateFilterBy === 'startedAt'
        ? quoteIdent('startedAt', 'column name')
        : filter.dateFilterBy === 'suspendedAt'
          ? quoteIdent('suspendedAt', 'column name')
          : filter.dateFilterBy === 'completedAt'
            ? quoteIdent('completedAt', 'column name')
            : quoteIdent('createdAt', 'column name');
    if (filter.fromDate) {
      const name = `p${idx++}`;
      params[name] = filter.fromDate.toISOString();
      types[name] = 'timestamp';
      conditions.push(`${dateCol} >= @${name}`);
    }
    if (filter.toDate) {
      const name = `p${idx++}`;
      params[name] = filter.toDate.toISOString();
      types[name] = 'timestamp';
      conditions.push(`${dateCol} < @${name}`);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const usePagination = filter.perPage != null;

    let total = 0;
    if (usePagination) {
      const [countRows] = await this.database.run({
        sql: `SELECT COUNT(*) AS count FROM ${this.tableName()} ${whereSql}`,
        params,
        types,
        json: true,
      });
      total = Number((countRows as Array<{ count: number | string }>)[0]?.count ?? 0);
    }

    const orderCol =
      filter.orderBy === 'startedAt'
        ? quoteIdent('startedAt', 'column name')
        : filter.orderBy === 'suspendedAt'
          ? quoteIdent('suspendedAt', 'column name')
          : filter.orderBy === 'completedAt'
            ? quoteIdent('completedAt', 'column name')
            : quoteIdent('createdAt', 'column name');
    const direction = filter.orderDirection === 'desc' ? 'DESC' : 'ASC';

    let sql = `SELECT * FROM ${this.tableName()} ${whereSql} ORDER BY ${orderCol} ${direction}, id ${direction}`;
    if (usePagination) {
      const offset = filter.page != null ? filter.page * filter.perPage! : 0;
      const limitName = `p${idx++}`;
      const offsetName = `p${idx++}`;
      params[limitName] = filter.perPage!;
      params[offsetName] = offset;
      sql += ` LIMIT @${limitName} OFFSET @${offsetName}`;
    }

    const [rows] = await this.database.run({ sql, params, types, json: true });
    const tasks = (rows as Array<Record<string, any>>).map(rowToTask);
    return { tasks, total: usePagination ? total : tasks.length };
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.db.runDml({
      sql: `DELETE FROM ${this.tableName()} WHERE id = @id`,
      params: { id: taskId },
    });
  }

  async deleteTasks(filter: TaskFilter): Promise<void> {
    const conditions: string[] = [];
    const params: Record<string, any> = {};
    // Spanner needs an explicit `timestamp` type hint for date params bound as
    // ISO strings (see listTasks for the full rationale).
    const types: Record<string, any> = {};
    let idx = 1;

    const statusCondition = buildStatusCondition(filter, params, idx);
    if (statusCondition.kind === 'empty') {
      return;
    }
    if (statusCondition.kind === 'sql') {
      conditions.push(statusCondition.sql);
      idx = statusCondition.nextIdx;
    }
    const dateCol =
      filter.dateFilterBy === 'startedAt'
        ? quoteIdent('startedAt', 'column name')
        : filter.dateFilterBy === 'completedAt'
          ? quoteIdent('completedAt', 'column name')
          : quoteIdent('createdAt', 'column name');
    if (filter.fromDate) {
      const name = `p${idx++}`;
      params[name] = filter.fromDate.toISOString();
      types[name] = 'timestamp';
      conditions.push(`${dateCol} >= @${name}`);
    }
    if (filter.toDate) {
      const name = `p${idx++}`;
      params[name] = filter.toDate.toISOString();
      types[name] = 'timestamp';
      conditions.push(`${dateCol} < @${name}`);
    }
    if (filter.agentId) {
      const name = `p${idx++}`;
      params[name] = filter.agentId;
      conditions.push(`${quoteIdent('agent_id', 'column name')} = @${name}`);
    }
    if (filter.threadId) {
      const name = `p${idx++}`;
      params[name] = filter.threadId;
      conditions.push(`${quoteIdent('thread_id', 'column name')} = @${name}`);
    }
    if (filter.resourceId) {
      const name = `p${idx++}`;
      params[name] = filter.resourceId;
      conditions.push(`${quoteIdent('resource_id', 'column name')} = @${name}`);
    }
    if (filter.runId) {
      const name = `p${idx++}`;
      params[name] = filter.runId;
      conditions.push(`${quoteIdent('run_id', 'column name')} = @${name}`);
    }
    if (filter.toolName) {
      const name = `p${idx++}`;
      params[name] = filter.toolName;
      conditions.push(`${quoteIdent('tool_name', 'column name')} = @${name}`);
    }

    // Refuse to issue an unscoped DELETE  callers that really want to wipe
    // the table should reach for `dangerouslyClearAll()`.
    if (conditions.length === 0) return;
    await this.db.runDml({
      sql: `DELETE FROM ${this.tableName()} WHERE ${conditions.join(' AND ')}`,
      params,
      types,
    });
  }

  async getRunningCount(): Promise<number> {
    const [rows] = await this.database.run({
      sql: `SELECT COUNT(*) AS count FROM ${this.tableName()} WHERE ${quoteIdent('status', 'column name')} = 'running'`,
      json: true,
    });
    return Number((rows as Array<{ count: number | string }>)[0]?.count ?? 0);
  }

  async getRunningCountByAgent(agentId: string): Promise<number> {
    const [rows] = await this.database.run({
      sql: `SELECT COUNT(*) AS count FROM ${this.tableName()} WHERE ${quoteIdent('status', 'column name')} = 'running' AND ${quoteIdent('agent_id', 'column name')} = @agentId`,
      params: { agentId },
      json: true,
    });
    return Number((rows as Array<{ count: number | string }>)[0]?.count ?? 0);
  }
}
