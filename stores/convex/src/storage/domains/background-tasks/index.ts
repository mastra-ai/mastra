import type { BackgroundTask, TaskFilter, TaskListResult, UpdateBackgroundTask } from '@mastra/core/background-tasks';
import { BackgroundTasksStorage, TABLE_BACKGROUND_TASKS } from '@mastra/core/storage';
import { ConvexDB, resolveConvexConfig } from '../../db';
import type { ConvexDomainConfig } from '../../db';

type StoredTask = {
  id: string;
  status: BackgroundTask['status'];
  tool_call_id: string;
  tool_name: string;
  agent_id: string;
  run_id: string;
  thread_id: string | null;
  resource_id: string | null;
  args: string;
  result: string | null;
  error: string | null;
  suspend_payload: string | null;
  retry_count: number;
  max_retries: number;
  timeout_ms: number;
  createdAt: string;
  startedAt: string | null;
  suspendedAt: string | null;
  completedAt: string | null;
};

type StoredTaskPatch = Partial<Omit<StoredTask, 'id' | 'createdAt'>>;

function serializeJson(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  return JSON.stringify(v);
}

function serializeRequiredJson(v: unknown): string {
  return JSON.stringify(v ?? {});
}

function toStored(task: BackgroundTask): StoredTask {
  return {
    id: task.id,
    status: task.status,
    tool_call_id: task.toolCallId,
    tool_name: task.toolName,
    agent_id: task.agentId,
    run_id: task.runId,
    thread_id: task.threadId ?? null,
    resource_id: task.resourceId ?? null,
    args: serializeRequiredJson(task.args),
    result: serializeJson(task.result),
    error: serializeJson(task.error),
    suspend_payload: serializeJson(task.suspendPayload),
    retry_count: task.retryCount,
    max_retries: task.maxRetries,
    timeout_ms: task.timeoutMs,
    createdAt: task.createdAt.toISOString(),
    startedAt: task.startedAt?.toISOString() ?? null,
    suspendedAt: task.suspendedAt?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
  };
}

function toStoredPatch(update: UpdateBackgroundTask): StoredTaskPatch {
  const patch: StoredTaskPatch = {};
  if (update.status !== undefined) patch.status = update.status;
  if ('result' in update) patch.result = serializeJson(update.result);
  if ('error' in update) patch.error = serializeJson(update.error);
  if ('suspendPayload' in update) patch.suspend_payload = serializeJson(update.suspendPayload);
  if (update.retryCount !== undefined) patch.retry_count = update.retryCount;
  if (update.maxRetries !== undefined) patch.max_retries = update.maxRetries;
  if (update.timeoutMs !== undefined) patch.timeout_ms = update.timeoutMs;
  if ('startedAt' in update) patch.startedAt = update.startedAt?.toISOString() ?? null;
  if ('suspendedAt' in update) patch.suspendedAt = update.suspendedAt?.toISOString() ?? null;
  if ('completedAt' in update) patch.completedAt = update.completedAt?.toISOString() ?? null;
  return patch;
}

function legacyOrCurrent<TValue>(stored: Record<string, any>, currentKey: string, legacyKey: string): TValue {
  return currentKey in stored ? stored[currentKey] : stored[legacyKey];
}

function fromStored(stored: StoredTask | Record<string, any>): BackgroundTask {
  const record = stored as Record<string, any>;
  const parseJson = (val: string | null | undefined): any => {
    if (val == null) return undefined;
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  };
  return {
    id: record.id,
    status: record.status,
    toolName: legacyOrCurrent<string>(record, 'tool_name', 'toolName'),
    toolCallId: legacyOrCurrent<string>(record, 'tool_call_id', 'toolCallId'),
    args: parseJson(record.args) ?? {},
    agentId: legacyOrCurrent<string>(record, 'agent_id', 'agentId'),
    threadId: legacyOrCurrent<string | null>(record, 'thread_id', 'threadId') ?? undefined,
    resourceId: legacyOrCurrent<string | null>(record, 'resource_id', 'resourceId') ?? undefined,
    runId: legacyOrCurrent<string>(record, 'run_id', 'runId'),
    result: parseJson(record.result),
    error: parseJson(record.error),
    suspendPayload: parseJson(legacyOrCurrent<string | null>(record, 'suspend_payload', 'suspendPayload')),
    retryCount: legacyOrCurrent<number>(record, 'retry_count', 'retryCount'),
    maxRetries: legacyOrCurrent<number>(record, 'max_retries', 'maxRetries'),
    timeoutMs: legacyOrCurrent<number>(record, 'timeout_ms', 'timeoutMs'),
    createdAt: new Date(record.createdAt),
    startedAt: record.startedAt ? new Date(record.startedAt) : undefined,
    suspendedAt: record.suspendedAt ? new Date(record.suspendedAt) : undefined,
    completedAt: record.completedAt ? new Date(record.completedAt) : undefined,
  };
}

function hasDeleteFilter(filter: TaskFilter): boolean {
  return Boolean(
    (Array.isArray(filter.status) ? filter.status.length > 0 : filter.status) ||
    filter.agentId ||
    filter.threadId ||
    filter.resourceId ||
    filter.toolName ||
    filter.toolCallId ||
    filter.runId ||
    filter.fromDate ||
    filter.toDate,
  );
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
    const patch = toStoredPatch(update);
    if (Object.keys(patch).length === 0) return;

    await this.#db.patch({
      tableName: TABLE_BACKGROUND_TASKS,
      id: taskId,
      record: patch,
    });
  }

  async getTask(taskId: string): Promise<BackgroundTask | null> {
    const data = await this.#db.load<StoredTask>({ tableName: TABLE_BACKGROUND_TASKS, keys: { id: taskId } });
    return data ? fromStored(data) : null;
  }

  async listTasks(filter: TaskFilter): Promise<TaskListResult> {
    const queryFilters: Array<{ field: string; value: string }> = [];

    if (typeof filter.status === 'string') queryFilters.push({ field: 'status', value: filter.status });
    // Convex only supports equality indexes here; multi-status lists still need the in-memory filter below.
    if (Array.isArray(filter.status) && filter.status.length === 1) {
      queryFilters.push({ field: 'status', value: filter.status[0]! });
    }
    if (filter.agentId) queryFilters.push({ field: 'agent_id', value: filter.agentId });
    if (filter.threadId) queryFilters.push({ field: 'thread_id', value: filter.threadId });
    if (filter.resourceId) queryFilters.push({ field: 'resource_id', value: filter.resourceId });
    if (filter.toolName) queryFilters.push({ field: 'tool_name', value: filter.toolName });
    if (filter.toolCallId) queryFilters.push({ field: 'tool_call_id', value: filter.toolCallId });
    if (filter.runId) queryFilters.push({ field: 'run_id', value: filter.runId });

    const all = await this.#db.queryTable<StoredTask>(
      TABLE_BACKGROUND_TASKS,
      queryFilters.length > 0 ? queryFilters : undefined,
    );
    let tasks = all.map(fromStored);

    if (filter.status) {
      const s = Array.isArray(filter.status) ? filter.status : [filter.status];
      tasks = tasks.filter(t => s.includes(t.status));
    }
    if (filter.agentId) tasks = tasks.filter(t => t.agentId === filter.agentId);
    if (filter.threadId) tasks = tasks.filter(t => t.threadId === filter.threadId);
    if (filter.resourceId) tasks = tasks.filter(t => t.resourceId === filter.resourceId);
    if (filter.toolName) tasks = tasks.filter(t => t.toolName === filter.toolName);
    if (filter.toolCallId) tasks = tasks.filter(t => t.toolCallId === filter.toolCallId);
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
    if (!hasDeleteFilter(filter)) return;

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
