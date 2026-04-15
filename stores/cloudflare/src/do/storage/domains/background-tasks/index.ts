import type {
  BackgroundTask,
  BackgroundTaskStatus,
  TaskFilter,
  TaskListResult,
  UpdateBackgroundTask,
} from '@mastra/core/background-tasks';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  BackgroundTasksStorage,
  createStorageErrorId,
  TABLE_BACKGROUND_TASKS,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';

import { DODB } from '../../db';
import type { DODomainConfig } from '../../db';
import { createSqlBuilder } from '../../sql-builder';
import type { SqlParam } from '../../sql-builder';
import { deserializeValue } from '../utils';

function serializeJson(v: unknown): any {
  if (typeof v === 'object' && v != null) return JSON.stringify(v);
  return v ?? undefined;
}

function rowToTask(row: Record<string, unknown>): BackgroundTask {
  const parseJson = (v: unknown): any => {
    if (v == null) return undefined;
    if (typeof v === 'string') {
      try {
        return JSON.parse(v);
      } catch {
        return v;
      }
    }
    return v;
  };
  const asDate = (v: unknown): Date | undefined => (v ? new Date(String(v)) : undefined);
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
    retryCount: Number(row.retry_count ?? 0),
    maxRetries: Number(row.max_retries ?? 0),
    timeoutMs: Number(row.timeout_ms ?? 300_000),
    createdAt: asDate(row.createdAt) ?? new Date(),
    startedAt: asDate(row.startedAt),
    completedAt: asDate(row.completedAt),
  };
}

function dateColumnName(col: 'createdAt' | 'startedAt' | 'completedAt'): string {
  return col;
}

export class BackgroundTasksStorageDO extends BackgroundTasksStorage {
  #db: DODB;

  constructor(config: DODomainConfig) {
    super();
    this.#db = new DODB(config);
  }

  async init(): Promise<void> {
    await this.#db.createTable({
      tableName: TABLE_BACKGROUND_TASKS,
      schema: TABLE_SCHEMAS[TABLE_BACKGROUND_TASKS],
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_BACKGROUND_TASKS });
  }

  async createTask(task: BackgroundTask): Promise<void> {
    try {
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
          retry_count: task.retryCount,
          max_retries: task.maxRetries,
          timeout_ms: task.timeoutMs,
          createdAt: task.createdAt.toISOString(),
          startedAt: task.startedAt?.toISOString() ?? null,
          completedAt: task.completedAt?.toISOString() ?? null,
        },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_DO', 'BACKGROUND_TASKS_CREATE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async updateTask(taskId: string, update: UpdateBackgroundTask): Promise<void> {
    const columns: string[] = [];
    const values: SqlParam[] = [];

    if ('status' in update) {
      columns.push('status');
      values.push(update.status as string);
    }
    if ('result' in update) {
      columns.push('result');
      values.push(serializeJson(update.result));
    }
    if ('error' in update) {
      columns.push('error');
      values.push(serializeJson(update.error));
    }
    if ('retryCount' in update) {
      columns.push('retry_count');
      values.push(update.retryCount as number);
    }
    if ('startedAt' in update) {
      columns.push('startedAt');
      values.push(update.startedAt?.toISOString() ?? null);
    }
    if ('completedAt' in update) {
      columns.push('completedAt');
      values.push(update.completedAt?.toISOString() ?? null);
    }

    if (columns.length === 0) return;

    try {
      const fullTableName = this.#db.getTableName(TABLE_BACKGROUND_TASKS);
      const query = createSqlBuilder().update(fullTableName, columns, values).where('id = ?', taskId);
      const { sql, params } = query.build();
      await this.#db.executeQuery({ sql, params });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_DO', 'BACKGROUND_TASKS_UPDATE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getTask(taskId: string): Promise<BackgroundTask | null> {
    try {
      const fullTableName = this.#db.getTableName(TABLE_BACKGROUND_TASKS);
      const query = createSqlBuilder().select('*').from(fullTableName).where('id = ?', taskId);
      const { sql, params } = query.build();
      const result = await this.#db.executeQuery({ sql, params, first: true });
      if (!result) return null;
      // Deserialize JSON fields
      const deserialized: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(result as Record<string, unknown>)) {
        deserialized[k] = deserializeValue(v);
      }
      return rowToTask(deserialized);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_DO', 'BACKGROUND_TASKS_GET', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listTasks(filter: TaskFilter): Promise<TaskListResult> {
    try {
      const fullTableName = this.#db.getTableName(TABLE_BACKGROUND_TASKS);

      const applyConditions = (builder: ReturnType<typeof createSqlBuilder>) => {
        if (filter.status) {
          const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
          const placeholders = statuses.map(() => '?').join(', ');
          builder.whereAnd(`status IN (${placeholders})`, ...(statuses as SqlParam[]));
        }
        if (filter.agentId) builder.whereAnd('agent_id = ?', filter.agentId);
        if (filter.threadId) builder.whereAnd('thread_id = ?', filter.threadId);
        if (filter.resourceId) builder.whereAnd('resource_id = ?', filter.resourceId);
        if (filter.toolName) builder.whereAnd('tool_name = ?', filter.toolName);
        if (filter.runId) builder.whereAnd('run_id = ?', filter.runId);

        const dateCol = dateColumnName(filter.dateFilterBy ?? 'createdAt');
        if (filter.fromDate) builder.whereAnd(`${dateCol} >= ?`, filter.fromDate.toISOString());
        if (filter.toDate) builder.whereAnd(`${dateCol} < ?`, filter.toDate.toISOString());
      };

      // Total count query
      const countQuery = createSqlBuilder().count().from(fullTableName);
      applyConditions(countQuery);
      const { sql: countSql, params: countParams } = countQuery.build();
      const countResult = (await this.#db.executeQuery({ sql: countSql, params: countParams, first: true })) as {
        count?: number;
      } | null;
      const total = Number(countResult?.count ?? 0);

      // Data query
      const dataQuery = createSqlBuilder().select('*').from(fullTableName);
      applyConditions(dataQuery);

      const orderBy = dateColumnName(filter.orderBy ?? 'createdAt');
      const direction = filter.orderDirection === 'desc' ? 'DESC' : 'ASC';
      dataQuery.orderBy(orderBy, direction);

      if (filter.perPage != null) {
        dataQuery.limit(filter.perPage);
        if (filter.page != null) {
          dataQuery.offset(filter.page * filter.perPage);
        }
      }

      const { sql, params } = dataQuery.build();
      const rows = (await this.#db.executeQuery({ sql, params })) as Record<string, unknown>[] | null;

      const tasks = (rows ?? []).map(row => {
        const deserialized: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(row)) {
          deserialized[k] = deserializeValue(v);
        }
        return rowToTask(deserialized);
      });

      return { tasks, total };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_DO', 'BACKGROUND_TASKS_LIST', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    try {
      const fullTableName = this.#db.getTableName(TABLE_BACKGROUND_TASKS);
      const query = createSqlBuilder().delete(fullTableName).where('id = ?', taskId);
      const { sql, params } = query.build();
      await this.#db.executeQuery({ sql, params });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_DO', 'BACKGROUND_TASKS_DELETE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteTasks(filter: TaskFilter): Promise<void> {
    try {
      const fullTableName = this.#db.getTableName(TABLE_BACKGROUND_TASKS);
      const query = createSqlBuilder().delete(fullTableName);

      if (filter.status) {
        const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
        const placeholders = statuses.map(() => '?').join(', ');
        query.whereAnd(`status IN (${placeholders})`, ...(statuses as SqlParam[]));
      }
      if (filter.agentId) query.whereAnd('agent_id = ?', filter.agentId);
      if (filter.threadId) query.whereAnd('thread_id = ?', filter.threadId);
      if (filter.resourceId) query.whereAnd('resource_id = ?', filter.resourceId);
      if (filter.toolName) query.whereAnd('tool_name = ?', filter.toolName);
      if (filter.runId) query.whereAnd('run_id = ?', filter.runId);

      const dateCol = dateColumnName(filter.dateFilterBy ?? 'createdAt');
      if (filter.fromDate) query.whereAnd(`${dateCol} >= ?`, filter.fromDate.toISOString());
      if (filter.toDate) query.whereAnd(`${dateCol} < ?`, filter.toDate.toISOString());

      const { sql, params } = query.build();
      await this.#db.executeQuery({ sql, params });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_DO', 'BACKGROUND_TASKS_DELETE_MANY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getRunningCount(): Promise<number> {
    const { total } = await this.listTasks({ status: 'running' });
    return total;
  }

  async getRunningCountByAgent(agentId: string): Promise<number> {
    const { total } = await this.listTasks({ status: 'running', agentId });
    return total;
  }
}
