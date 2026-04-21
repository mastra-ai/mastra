import type { BackgroundTask, BackgroundTaskStatus, TaskFilter, TaskListResult } from '@mastra/core/background-tasks';
import { BackgroundTasksStorage, TABLE_BACKGROUND_TASKS } from '@mastra/core/storage';
import type { Redis } from '@upstash/redis';
import { UpstashDB, resolveUpstashConfig } from '../../db';
import type { UpstashDomainConfig } from '../../db';
import { getKey, processRecord } from '../utils';

function toStorageRecord(task: BackgroundTask): Record<string, any> {
  return {
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
  };
}

function fromStorageRecord(record: Record<string, any>): BackgroundTask {
  return {
    id: record.id,
    status: record.status as BackgroundTaskStatus,
    toolName: record.tool_name,
    toolCallId: record.tool_call_id,
    args: record.args ?? {},
    agentId: record.agent_id,
    threadId: record.thread_id ?? undefined,
    resourceId: record.resource_id ?? undefined,
    runId: record.run_id ?? '',
    result: record.result ?? undefined,
    error: record.error ?? undefined,
    retryCount: Number(record.retry_count ?? 0),
    maxRetries: Number(record.max_retries ?? 0),
    timeoutMs: Number(record.timeout_ms ?? 300_000),
    createdAt: new Date(record.createdAt),
    startedAt: record.startedAt ? new Date(record.startedAt) : undefined,
    completedAt: record.completedAt ? new Date(record.completedAt) : undefined,
  };
}

export class BackgroundTasksUpstash extends BackgroundTasksStorage {
  private client: Redis;
  #db: UpstashDB;

  constructor(config: UpstashDomainConfig) {
    super();
    const client = resolveUpstashConfig(config);
    this.client = client;
    this.#db = new UpstashDB({ client });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_BACKGROUND_TASKS });
  }

  async createTask(task: BackgroundTask): Promise<void> {
    const record = toStorageRecord(task);
    const { key, processedRecord } = processRecord(TABLE_BACKGROUND_TASKS, record);
    await this.client.set(key, processedRecord);
  }

  async updateTask(taskId: string, update: Partial<BackgroundTask>): Promise<void> {
    const existing = await this.getTask(taskId);
    if (!existing) return;

    const merged = { ...existing };

    if ('status' in update) merged.status = update.status!;
    if ('result' in update) merged.result = update.result;
    if ('error' in update) merged.error = update.error;
    if ('retryCount' in update) merged.retryCount = update.retryCount!;
    if ('startedAt' in update) merged.startedAt = update.startedAt;
    if ('completedAt' in update) merged.completedAt = update.completedAt;

    const record = toStorageRecord(merged);
    const { key, processedRecord } = processRecord(TABLE_BACKGROUND_TASKS, record);
    await this.client.set(key, processedRecord);
  }

  async getTask(taskId: string): Promise<BackgroundTask | null> {
    const key = getKey(TABLE_BACKGROUND_TASKS, { id: taskId });
    const data = await this.client.get<Record<string, any>>(key);
    if (!data) return null;
    return fromStorageRecord(data);
  }

  async listTasks(filter: TaskFilter): Promise<TaskListResult> {
    // Scan all background task keys
    const keys = await this.#db.scanKeys(`${TABLE_BACKGROUND_TASKS}:*`);
    if (keys.length === 0) return { tasks: [], total: 0 };

    // Fetch all records
    const pipeline = this.client.pipeline();
    for (const key of keys) {
      pipeline.get(key);
    }
    const results = await pipeline.exec<Record<string, any>[]>();

    let tasks = results.filter(Boolean).map(r => fromStorageRecord(r));

    // Apply filters
    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      tasks = tasks.filter(t => statuses.includes(t.status));
    }
    if (filter.agentId) {
      tasks = tasks.filter(t => t.agentId === filter.agentId);
    }
    if (filter.threadId) {
      tasks = tasks.filter(t => t.threadId === filter.threadId);
    }
    if (filter.resourceId) {
      tasks = tasks.filter(t => t.resourceId === filter.resourceId);
    }
    if (filter.runId) {
      tasks = tasks.filter(t => t.runId === filter.runId);
    }
    if (filter.toolName) {
      tasks = tasks.filter(t => t.toolName === filter.toolName);
    }
    // Date range filtering
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
  }

  async deleteTask(taskId: string): Promise<void> {
    const key = getKey(TABLE_BACKGROUND_TASKS, { id: taskId });
    await this.client.del(key);
  }

  async deleteTasks(filter: TaskFilter): Promise<void> {
    // Get tasks matching filter, then delete by key
    const { tasks } = await this.listTasks(filter);
    if (tasks.length === 0) return;

    const keys = tasks.map(t => getKey(TABLE_BACKGROUND_TASKS, { id: t.id }));
    if (keys.length > 0) {
      await this.client.del(...keys);
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
