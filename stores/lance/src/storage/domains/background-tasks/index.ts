import type { Connection } from '@lancedb/lancedb';
import type {
  BackgroundTask,
  BackgroundTaskStatus,
  TaskFilter,
  TaskListResult,
  UpdateBackgroundTask,
} from '@mastra/core/background-tasks';
import { BackgroundTasksStorage, TABLE_BACKGROUND_TASKS, TABLE_SCHEMAS } from '@mastra/core/storage';
import { LanceDB, resolveLanceConfig } from '../../db';
import type { LanceDomainConfig } from '../../db';

function serializeJson(v: unknown): any {
  if (typeof v === 'object' && v != null) return JSON.stringify(v);
  return v ?? undefined;
}

function toRecord(task: BackgroundTask): Record<string, any> {
  return {
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
    createdAt: task.createdAt,
    startedAt: task.startedAt ?? new Date(0),
    completedAt: task.completedAt ?? new Date(0),
  };
}

function fromRecord(row: Record<string, any>): BackgroundTask {
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

  const startedAt = row.startedAt instanceof Date ? row.startedAt : row.startedAt ? new Date(row.startedAt) : undefined;
  const completedAt =
    row.completedAt instanceof Date ? row.completedAt : row.completedAt ? new Date(row.completedAt) : undefined;

  return {
    id: String(row.id),
    status: String(row.status) as BackgroundTaskStatus,
    toolName: String(row.tool_name),
    toolCallId: String(row.tool_call_id),
    args: parseJson(row.args) ?? {},
    agentId: String(row.agent_id),
    threadId: row.thread_id && row.thread_id !== '' ? String(row.thread_id) : undefined,
    resourceId: row.resource_id && row.resource_id !== '' ? String(row.resource_id) : undefined,
    runId: row.run_id ?? '',
    result: parseJson(row.result),
    error: parseJson(row.error),
    retryCount: Number(row.retry_count ?? 0),
    maxRetries: Number(row.max_retries ?? 0),
    timeoutMs: Number(row.timeout_ms ?? 300_000),
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    startedAt: startedAt && startedAt.getTime() > 0 ? startedAt : undefined,
    completedAt: completedAt && completedAt.getTime() > 0 ? completedAt : undefined,
  };
}

function escapeStr(val: string): string {
  return val.replace(/'/g, "''");
}

export class StoreBackgroundTasksLance extends BackgroundTasksStorage {
  private client: Connection;
  #db: LanceDB;

  constructor(config: LanceDomainConfig) {
    super();
    const client = resolveLanceConfig(config);
    this.client = client;
    this.#db = new LanceDB({ client });
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
    const table = await this.client.openTable(TABLE_BACKGROUND_TASKS);
    await table.add([toRecord(task)], { mode: 'append' });
  }

  async updateTask(taskId: string, update: UpdateBackgroundTask): Promise<void> {
    const existing = await this.getTask(taskId);
    if (!existing) return;

    const merged = { ...existing };
    if ('status' in update) merged.status = update.status!;
    // Keep `result`/`error` raw — `toRecord(merged)` below serializes once.
    // Serializing twice would double-encode (e.g. `"\"value\""`).
    if ('result' in update) merged.result = update.result;
    if ('error' in update) merged.error = update.error;
    if ('retryCount' in update) merged.retryCount = update.retryCount!;
    if ('startedAt' in update) merged.startedAt = update.startedAt;
    if ('completedAt' in update) merged.completedAt = update.completedAt;

    // LanceDB doesn't have a native partial update — delete and re-add
    const table = await this.client.openTable(TABLE_BACKGROUND_TASKS);
    await table.delete(`id = '${escapeStr(taskId)}'`);
    await table.add([toRecord(merged)], { mode: 'append' });
  }

  async getTask(taskId: string): Promise<BackgroundTask | null> {
    try {
      const table = await this.client.openTable(TABLE_BACKGROUND_TASKS);
      const records = await table
        .query()
        .where(`id = '${escapeStr(taskId)}'`)
        .limit(1)
        .toArray();
      if (records.length === 0) return null;
      return fromRecord(records[0]);
    } catch {
      return null;
    }
  }

  async listTasks(filter: TaskFilter): Promise<TaskListResult> {
    try {
      const table = await this.client.openTable(TABLE_BACKGROUND_TASKS);
      const conditions: string[] = [];

      if (filter.status) {
        const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
        const inList = statuses.map(s => `'${escapeStr(s)}'`).join(', ');
        conditions.push(`status IN (${inList})`);
      }
      if (filter.agentId) conditions.push(`agent_id = '${escapeStr(filter.agentId)}'`);
      if (filter.threadId) conditions.push(`thread_id = '${escapeStr(filter.threadId)}'`);
      if (filter.resourceId) conditions.push(`resource_id = '${escapeStr(filter.resourceId)}'`);
      if (filter.runId) conditions.push(`run_id = '${escapeStr(filter.runId)}'`);
      if (filter.toolName) conditions.push(`tool_name = '${escapeStr(filter.toolName)}'`);

      let query = table.query();
      if (conditions.length > 0) {
        query = query.where(conditions.join(' AND '));
      }

      const records = await query.toArray();
      let tasks = records.map(fromRecord);

      // Date range filters — apply in-memory since Lance doesn't support timestamp comparisons well in WHERE
      const dateCol = filter.dateFilterBy ?? 'createdAt';
      if (filter.fromDate) {
        tasks = tasks.filter(t => {
          const val = t[dateCol];
          return val != null && val >= filter.fromDate!;
        });
      }
      if (filter.toDate) {
        tasks = tasks.filter(t => {
          const val = t[dateCol];
          return val != null && val < filter.toDate!;
        });
      }

      // Sort
      const orderBy = filter.orderBy ?? 'createdAt';
      const direction = filter.orderDirection ?? 'asc';
      tasks.sort((a, b) => {
        const aVal = a[orderBy]?.getTime() ?? 0;
        const bVal = b[orderBy]?.getTime() ?? 0;
        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      });

      // Capture total before pagination
      const total = tasks.length;

      // Pagination
      if (filter.page != null && filter.perPage != null) {
        const start = filter.page * filter.perPage;
        tasks = tasks.slice(start, start + filter.perPage);
      } else if (filter.perPage != null) {
        tasks = tasks.slice(0, filter.perPage);
      }

      return { tasks, total };
    } catch {
      return { tasks: [], total: 0 };
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    const table = await this.client.openTable(TABLE_BACKGROUND_TASKS);
    await table.delete(`id = '${escapeStr(taskId)}'`);
  }

  async deleteTasks(filter: TaskFilter): Promise<void> {
    const { tasks } = await this.listTasks(filter);
    if (tasks.length === 0) return;

    const table = await this.client.openTable(TABLE_BACKGROUND_TASKS);
    for (const task of tasks) {
      await table.delete(`id = '${escapeStr(task.id)}'`);
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
