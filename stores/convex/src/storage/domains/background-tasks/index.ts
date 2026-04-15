import type { BackgroundTask, TaskFilter, TaskListResult, UpdateBackgroundTask } from '@mastra/core/background-tasks';
import { BackgroundTasksStorage, TABLE_BACKGROUND_TASKS } from '@mastra/core/storage';
import { ConvexDB, resolveConvexConfig } from '../../db';
import type { ConvexDomainConfig } from '../../db';

type StoredTask = Omit<BackgroundTask, 'createdAt' | 'startedAt' | 'completedAt' | 'args' | 'result' | 'error'> & {
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  args: string;
  result?: string;
  error?: string;
};

function serializeJson(v: unknown): any {
  if (typeof v === 'object' && v != null) return JSON.stringify(v);
  return v ?? undefined;
}

function toStored(task: BackgroundTask): StoredTask {
  return {
    ...task,
    args: serializeJson(task.args),
    result: serializeJson(task.result),
    error: serializeJson(task.error),
    createdAt: task.createdAt.toISOString(),
    startedAt: task.startedAt?.toISOString(),
    completedAt: task.completedAt?.toISOString(),
  };
}

function fromStored(stored: StoredTask): BackgroundTask {
  const parseJson = (val?: string): any => {
    if (!val) return undefined;
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  };
  return {
    id: stored.id,
    status: stored.status,
    toolName: stored.toolName,
    toolCallId: stored.toolCallId,
    args: parseJson(stored.args) ?? {},
    agentId: stored.agentId,
    threadId: stored.threadId,
    resourceId: stored.resourceId,
    runId: stored.runId,
    result: parseJson(stored.result),
    error: parseJson(stored.error),
    retryCount: stored.retryCount,
    maxRetries: stored.maxRetries,
    timeoutMs: stored.timeoutMs,
    createdAt: new Date(stored.createdAt),
    startedAt: stored.startedAt ? new Date(stored.startedAt) : undefined,
    completedAt: stored.completedAt ? new Date(stored.completedAt) : undefined,
  };
}

export class BackgroundTasksConvex extends BackgroundTasksStorage {
  #db: ConvexDB;

  constructor(config: ConvexDomainConfig) {
    super();
    const client = resolveConvexConfig(config);
    this.#db = new ConvexDB(client);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_BACKGROUND_TASKS });
  }

  async createTask(task: BackgroundTask): Promise<void> {
    await this.#db.insert({ tableName: TABLE_BACKGROUND_TASKS, record: toStored(task) });
  }

  async updateTask(taskId: string, update: UpdateBackgroundTask): Promise<void> {
    const existing = await this.getTask(taskId);
    if (!existing) return;
    const merged = { ...existing };
    if ('status' in update) merged.status = update.status!;
    // Keep `result`/`error` raw here — `toStored(merged)` below serializes them
    // exactly once. Serializing twice would double-encode (e.g. `"\"value\""`).
    if ('result' in update) merged.result = update.result;
    if ('error' in update) merged.error = update.error;
    if ('retryCount' in update) merged.retryCount = update.retryCount!;
    if ('startedAt' in update) merged.startedAt = update.startedAt;
    if ('completedAt' in update) merged.completedAt = update.completedAt;
    // Convex has no update — delete and re-insert
    await this.#db.deleteMany(TABLE_BACKGROUND_TASKS, [taskId]);
    await this.#db.insert({ tableName: TABLE_BACKGROUND_TASKS, record: toStored(merged) });
  }

  async getTask(taskId: string): Promise<BackgroundTask | null> {
    const data = await this.#db.load<StoredTask>({ tableName: TABLE_BACKGROUND_TASKS, keys: { id: taskId } });
    return data ? fromStored(data) : null;
  }

  async listTasks(filter: TaskFilter): Promise<TaskListResult> {
    const all = await this.#db.queryTable<StoredTask>(TABLE_BACKGROUND_TASKS);
    let tasks = all.map(fromStored);

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
    await this.#db.deleteMany(TABLE_BACKGROUND_TASKS, [taskId]);
  }

  async deleteTasks(filter: TaskFilter): Promise<void> {
    const { tasks } = await this.listTasks(filter);
    const taskIds = tasks.map(t => t.id);
    await this.#db.deleteMany(TABLE_BACKGROUND_TASKS, taskIds);
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
