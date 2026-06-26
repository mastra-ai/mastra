import type {
  BackgroundTask,
  BackgroundTaskStatus,
  TaskFilter,
  TaskListResult,
  UpdateBackgroundTask,
} from '@mastra/core/background-tasks';
import type { CreateIndexOptions } from '@mastra/core/storage';
import { BackgroundTasksStorage, TABLE_BACKGROUND_TASKS, TABLE_SCHEMAS } from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';
import { PgDB, resolvePgConfig, generateTableSQL, generateIndexSQL } from '../../db';
import type { PgDomainConfig } from '../../db';

function getSchemaName(schema?: string) {
  return schema ? `"${schema}"` : '"public"';
}

function getTableName(schemaName?: string) {
  const quoted = `"${TABLE_BACKGROUND_TASKS}"`;
  return schemaName ? `${schemaName}.${quoted}` : quoted;
}

function serializeJson(v: unknown): any {
  if (typeof v === 'object' && v != null) return JSON.stringify(v);
  return v ?? null;
}

function parseJson(v: unknown): any {
  if (typeof v === 'string') {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v ?? undefined;
}

/** Convert a DB row (snake_case) to a BackgroundTask object (camelCase). */
function rowToTask(row: Record<string, any>): BackgroundTask {
  const createdAt = row.createdAtZ || row.createdAt;
  const startedAt = row.startedAtZ || row.startedAt;
  const suspendedAt = row.suspendedAtZ || row.suspendedAt;
  const completedAt = row.completedAtZ || row.completedAt;
  return {
    id: row.id,
    status: row.status as BackgroundTaskStatus,
    toolName: row.tool_name,
    toolCallId: row.tool_call_id,
    args: parseJson(row.args),
    agentId: row.agent_id,
    threadId: row.thread_id ?? undefined,
    resourceId: row.resource_id ?? undefined,
    runId: row.run_id,
    result: parseJson(row.result),
    error: parseJson(row.error),
    suspendPayload: parseJson(row.suspend_payload),
    retryCount: Number(row.retry_count),
    maxRetries: Number(row.max_retries),
    timeoutMs: Number(row.timeout_ms),
    createdAt: createdAt instanceof Date ? createdAt : new Date(createdAt),
    startedAt: startedAt ? (startedAt instanceof Date ? startedAt : new Date(startedAt)) : undefined,
    suspendedAt: suspendedAt ? (suspendedAt instanceof Date ? suspendedAt : new Date(suspendedAt)) : undefined,
    completedAt: completedAt ? (completedAt instanceof Date ? completedAt : new Date(completedAt)) : undefined,
  };
}

export class BackgroundTasksPG extends BackgroundTasksStorage {
  #db: PgDB;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_BACKGROUND_TASKS] as const;

  constructor(config: PgDomainConfig) {
    super();
    const { client, schemaName, skipDefaultIndexes, indexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
    this.#skipDefaultIndexes = skipDefaultIndexes;
    this.#indexes = indexes?.filter(idx => (BackgroundTasksPG.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  async init(): Promise<void> {
    await this.#db.createTable({
      tableName: TABLE_BACKGROUND_TASKS,
      schema: TABLE_SCHEMAS[TABLE_BACKGROUND_TASKS],
    });
    // Backfill columns added after the initial schema shipped.
    await this.#db.alterTable({
      tableName: TABLE_BACKGROUND_TASKS,
      schema: TABLE_SCHEMAS[TABLE_BACKGROUND_TASKS],
      ifNotExists: ['suspend_payload', 'suspendedAt'],
    });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  static getDefaultIndexDefs(schemaPrefix: string): CreateIndexOptions[] {
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

  static getExportDDL(schemaName?: string): string[] {
    const statements: string[] = [];
    const parsedSchema = schemaName ? parseSqlIdentifier(schemaName, 'schema name') : '';
    const schemaPrefix = parsedSchema && parsedSchema !== 'public' ? `${parsedSchema}_` : '';

    statements.push(
      generateTableSQL({
        tableName: TABLE_BACKGROUND_TASKS,
        schema: TABLE_SCHEMAS[TABLE_BACKGROUND_TASKS],
        schemaName,
        includeAllConstraints: true,
      }),
    );

    for (const idx of BackgroundTasksPG.getDefaultIndexDefs(schemaPrefix)) {
      statements.push(generateIndexSQL(idx, schemaName));
    }

    return statements;
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    const schemaPrefix = this.#schema !== 'public' ? `${this.#schema}_` : '';
    return BackgroundTasksPG.getDefaultIndexDefs(schemaPrefix);
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) return;
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create index ${indexDef.name}:`, error);
      }
    }
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) return;
    for (const indexDef of this.#indexes) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_BACKGROUND_TASKS });
  }

  async createTask(task: BackgroundTask): Promise<void> {
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
        args: serializeJson(task.args),
        result: serializeJson(task.result),
        error: serializeJson(task.error),
        suspend_payload: serializeJson(task.suspendPayload),
        retry_count: task.retryCount,
        max_retries: task.maxRetries,
        timeout_ms: task.timeoutMs,
        createdAt: task.createdAt.toISOString(),
        createdAtZ: task.createdAt.toISOString(),
        startedAt: task.startedAt?.toISOString() ?? null,
        startedAtZ: task.startedAt?.toISOString() ?? null,
        suspendedAt: task.suspendedAt?.toISOString() ?? null,
        suspendedAtZ: task.suspendedAt?.toISOString() ?? null,
        completedAt: task.completedAt?.toISOString() ?? null,
        completedAtZ: task.completedAt?.toISOString() ?? null,
      },
    });
  }

  async updateTask(taskId: string, update: UpdateBackgroundTask): Promise<void> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if ('status' in update) {
      setClauses.push(`"status" = $${paramIdx++}`);
      params.push(update.status);
    }
    if ('result' in update) {
      setClauses.push(`"result" = $${paramIdx++}`);
      params.push(serializeJson(update.result));
    }
    if ('error' in update) {
      setClauses.push(`"error" = $${paramIdx++}`);
      params.push(serializeJson(update.error));
    }
    if ('suspendPayload' in update) {
      setClauses.push(`"suspend_payload" = $${paramIdx++}`);
      params.push(serializeJson(update.suspendPayload));
    }
    if ('retryCount' in update) {
      setClauses.push(`"retry_count" = $${paramIdx++}`);
      params.push(update.retryCount);
    }
    if ('startedAt' in update) {
      setClauses.push(`"startedAt" = $${paramIdx++}`);
      setClauses.push(`"startedAtZ" = $${paramIdx++}`);
      const val = update.startedAt?.toISOString() ?? null;
      params.push(val, val);
    }
    if ('suspendedAt' in update) {
      setClauses.push(`"suspendedAt" = $${paramIdx++}`);
      setClauses.push(`"suspendedAtZ" = $${paramIdx++}`);
      const val = update.suspendedAt?.toISOString() ?? null;
      params.push(val, val);
    }
    if ('completedAt' in update) {
      setClauses.push(`"completedAt" = $${paramIdx++}`);
      setClauses.push(`"completedAtZ" = $${paramIdx++}`);
      const val = update.completedAt?.toISOString() ?? null;
      params.push(val, val);
    }

    if (setClauses.length === 0) return;

    const table = getTableName(getSchemaName(this.#schema));
    params.push(taskId);
    await this.#db.client.none(`UPDATE ${table} SET ${setClauses.join(', ')} WHERE "id" = $${paramIdx}`, params);
  }

  async getTask(taskId: string): Promise<BackgroundTask | null> {
    const table = getTableName(getSchemaName(this.#schema));
    const row = await this.#db.client.oneOrNone(`SELECT * FROM ${table} WHERE "id" = $1`, [taskId]);
    return row ? rowToTask(row) : null;
  }

  async listTasks(filter: TaskFilter): Promise<TaskListResult> {
    const table = getTableName(getSchemaName(this.#schema));
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      const placeholders = statuses.map(() => `$${paramIdx++}`);
      conditions.push(`"status" IN (${placeholders.join(', ')})`);
      params.push(...statuses);
    }
    if (filter.agentId) {
      conditions.push(`"agent_id" = $${paramIdx++}`);
      params.push(filter.agentId);
    }
    if (filter.threadId) {
      conditions.push(`"thread_id" = $${paramIdx++}`);
      params.push(filter.threadId);
    }
    if (filter.resourceId) {
      conditions.push(`"resource_id" = $${paramIdx++}`);
      params.push(filter.resourceId);
    }
    if (filter.runId) {
      conditions.push(`"run_id" = $${paramIdx++}`);
      params.push(filter.runId);
    }
    if (filter.toolName) {
      conditions.push(`"tool_name" = $${paramIdx++}`);
      params.push(filter.toolName);
    }
    if (filter.toolCallId) {
      conditions.push(`"tool_call_id" = $${paramIdx++}`);
      params.push(filter.toolCallId);
    }
    // Date range filtering
    const dateCol =
      filter.dateFilterBy === 'startedAt'
        ? '"startedAt"'
        : filter.dateFilterBy === 'suspendedAt'
          ? '"suspendedAt"'
          : filter.dateFilterBy === 'completedAt'
            ? '"completedAt"'
            : '"createdAt"';
    if (filter.fromDate) {
      conditions.push(`${dateCol} >= $${paramIdx++}`);
      params.push(filter.fromDate.toISOString());
    }
    if (filter.toDate) {
      conditions.push(`${dateCol} < $${paramIdx++}`);
      params.push(filter.toDate.toISOString());
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total matching rows (before pagination)
    const countResult = await this.#db.client.oneOrNone<{ count: string }>(
      `SELECT COUNT(*) as count FROM ${table} ${where}`,
      params.slice(0, paramIdx - 1),
    );
    const total = Number(countResult?.count ?? 0);

    const orderCol =
      filter.orderBy === 'startedAt'
        ? '"startedAt"'
        : filter.orderBy === 'suspendedAt'
          ? '"suspendedAt"'
          : filter.orderBy === 'completedAt'
            ? '"completedAt"'
            : '"createdAt"';
    const direction = filter.orderDirection === 'desc' ? 'DESC' : 'ASC';

    let sql = `SELECT * FROM ${table} ${where} ORDER BY ${orderCol} ${direction}`;

    if (filter.perPage != null) {
      sql += ` LIMIT $${paramIdx++}`;
      params.push(filter.perPage);
      if (filter.page != null) {
        sql += ` OFFSET $${paramIdx++}`;
        params.push(filter.page * filter.perPage);
      }
    }

    const rows = await this.#db.client.manyOrNone(sql, params);
    return { tasks: rows.map(rowToTask), total };
  }

  async deleteTask(taskId: string): Promise<void> {
    const table = getTableName(getSchemaName(this.#schema));
    await this.#db.client.none(`DELETE FROM ${table} WHERE "id" = $1`, [taskId]);
  }

  async deleteTasks(filter: TaskFilter): Promise<void> {
    const table = getTableName(getSchemaName(this.#schema));
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      const placeholders = statuses.map(() => `$${paramIdx++}`);
      conditions.push(`"status" IN (${placeholders.join(', ')})`);
      params.push(...statuses);
    }
    // Date range filtering
    const dateCol =
      filter.dateFilterBy === 'startedAt'
        ? '"startedAt"'
        : filter.dateFilterBy === 'suspendedAt'
          ? '"suspendedAt"'
          : filter.dateFilterBy === 'completedAt'
            ? '"completedAt"'
            : '"createdAt"';
    if (filter.fromDate) {
      conditions.push(`${dateCol} >= $${paramIdx++}`);
      params.push(filter.fromDate.toISOString());
    }
    if (filter.toDate) {
      conditions.push(`${dateCol} < $${paramIdx++}`);
      params.push(filter.toDate.toISOString());
    }
    if (filter.agentId) {
      conditions.push(`"agent_id" = $${paramIdx++}`);
      params.push(filter.agentId);
    }

    if (conditions.length === 0) return; // Safety: don't delete everything

    await this.#db.client.none(`DELETE FROM ${table} WHERE ${conditions.join(' AND ')}`, params);
  }

  async getRunningCount(): Promise<number> {
    const table = getTableName(getSchemaName(this.#schema));
    const result = await this.#db.client.oneOrNone<{ count: string }>(
      `SELECT COUNT(*) FROM ${table} WHERE "status" = 'running'`,
    );
    return Number(result?.count ?? 0);
  }

  async getRunningCountByAgent(agentId: string): Promise<number> {
    const table = getTableName(getSchemaName(this.#schema));
    const result = await this.#db.client.oneOrNone<{ count: string }>(
      `SELECT COUNT(*) FROM ${table} WHERE "status" = 'running' AND "agent_id" = $1`,
      [agentId],
    );
    return Number(result?.count ?? 0);
  }
}
