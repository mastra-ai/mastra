import type {
  BackgroundTask,
  BackgroundTaskStatus,
  TaskFilter,
  TaskListResult,
  UpdateBackgroundTask,
} from '@mastra/core/background-tasks';
import { BackgroundTasksStorage, TABLE_BACKGROUND_TASKS } from '@mastra/core/storage';
import { CloudflareKVDB, resolveCloudflareConfig } from '../../db';
import type { CloudflareDomainConfig } from '../../types';

function toRecord(task: BackgroundTask): Record<string, any> {
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

function fromRecord(record: Record<string, any>): BackgroundTask {
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

export class BackgroundTasksStorageCloudflare extends BackgroundTasksStorage {
  #db: CloudflareKVDB;

  constructor(config: CloudflareDomainConfig) {
    super();
    this.#db = new CloudflareKVDB(resolveCloudflareConfig(config));
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_BACKGROUND_TASKS });
  }

  async createTask(task: BackgroundTask): Promise<void> {
    await this.#db.putKV({ tableName: TABLE_BACKGROUND_TASKS, key: task.id, value: toRecord(task) });
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
    await this.#db.putKV({ tableName: TABLE_BACKGROUND_TASKS, key: taskId, value: toRecord(merged) });
  }

  async getTask(taskId: string): Promise<BackgroundTask | null> {
    const data = await this.#db.getKV(TABLE_BACKGROUND_TASKS, taskId);
    return data ? fromRecord(data) : null;
  }

  async listTasks(filter: TaskFilter): Promise<TaskListResult> {
    const keys = await this.#db.listKV(TABLE_BACKGROUND_TASKS);
    if (keys.length === 0) return { tasks: [], total: 0 };

    const records = await Promise.all(keys.map(k => this.#db.getKV(TABLE_BACKGROUND_TASKS, k.name)));
    let tasks = records.filter(Boolean).map(r => fromRecord(r!));

    if (filter.status) {
      const s = Array.isArray(filter.status) ? filter.status : [filter.status];
      tasks = tasks.filter(t => s.includes(t.status));
    }
    if (filter.agentId) tasks = tasks.filter(t => t.agentId === filter.agentId);
    if (filter.threadId) tasks = tasks.filter(t => t.threadId === filter.threadId);
    if (filter.toolName) tasks = tasks.filter(t => t.toolName === filter.toolName);
    if (filter.runId) tasks = tasks.filter(t => t.runId === filter.runId);
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

    const orderBy = filter.orderBy ?? 'createdAt';
    const dir = filter.orderDirection === 'desc' ? -1 : 1;
    tasks.sort((a, b) => ((a[orderBy]?.getTime() ?? 0) - (b[orderBy]?.getTime() ?? 0)) * dir);

    // Capture total before pagination
    const total = tasks.length;

    if (filter.page != null && filter.perPage != null) {
      const start = filter.page * filter.perPage;
      tasks = tasks.slice(start, start + filter.perPage);
    } else if (filter.perPage != null) {
      tasks = tasks.slice(0, filter.perPage);
    }
    return { tasks, total };
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.#db.deleteKV(TABLE_BACKGROUND_TASKS, taskId);
  }

  async deleteTasks(filter: TaskFilter): Promise<void> {
    const { tasks } = await this.listTasks(filter);
    await Promise.all(tasks.map(t => this.#db.deleteKV(TABLE_BACKGROUND_TASKS, t.id)));
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
