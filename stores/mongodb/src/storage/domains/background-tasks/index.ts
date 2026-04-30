import type {
  BackgroundTask,
  BackgroundTaskStatus,
  TaskFilter,
  TaskListResult,
  UpdateBackgroundTask,
} from '@mastra/core/background-tasks';
import { BackgroundTasksStorage, TABLE_BACKGROUND_TASKS } from '@mastra/core/storage';
import type { MongoDBConnector } from '../../connectors/MongoDBConnector';
import { resolveMongoDBConfig } from '../../db';
import type { MongoDBDomainConfig, MongoDBIndexConfig } from '../../types';

function toDoc(task: BackgroundTask): Record<string, any> {
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

function fromDoc(doc: Record<string, any>): BackgroundTask {
  return {
    id: doc.id,
    status: doc.status as BackgroundTaskStatus,
    toolName: doc.tool_name,
    toolCallId: doc.tool_call_id,
    args: doc.args ?? {},
    agentId: doc.agent_id,
    threadId: doc.thread_id ?? undefined,
    resourceId: doc.resource_id ?? undefined,
    runId: doc.run_id ?? '',
    result: doc.result ?? undefined,
    error: doc.error ?? undefined,
    retryCount: Number(doc.retry_count ?? 0),
    maxRetries: Number(doc.max_retries ?? 0),
    timeoutMs: Number(doc.timeout_ms ?? 300_000),
    createdAt: new Date(doc.createdAt),
    startedAt: doc.startedAt ? new Date(doc.startedAt) : undefined,
    completedAt: doc.completedAt ? new Date(doc.completedAt) : undefined,
  };
}

export class BackgroundTasksStorageMongoDB extends BackgroundTasksStorage {
  #connector: MongoDBConnector;
  #skipDefaultIndexes?: boolean;
  #indexes?: MongoDBIndexConfig[];

  static readonly MANAGED_COLLECTIONS = [TABLE_BACKGROUND_TASKS] as const;

  constructor(config: MongoDBDomainConfig) {
    super();
    this.#connector = resolveMongoDBConfig(config);
    this.#skipDefaultIndexes = config.skipDefaultIndexes;
    this.#indexes = config.indexes?.filter(idx =>
      (BackgroundTasksStorageMongoDB.MANAGED_COLLECTIONS as readonly string[]).includes(idx.collection),
    );
  }

  private async getCollection() {
    return this.#connector.getCollection(TABLE_BACKGROUND_TASKS);
  }

  getDefaultIndexDefinitions(): MongoDBIndexConfig[] {
    return [
      { collection: TABLE_BACKGROUND_TASKS, keys: { id: 1 }, options: { unique: true } },
      { collection: TABLE_BACKGROUND_TASKS, keys: { status: 1, createdAt: 1 } },
      { collection: TABLE_BACKGROUND_TASKS, keys: { agent_id: 1, status: 1 } },
      { collection: TABLE_BACKGROUND_TASKS, keys: { thread_id: 1, createdAt: 1 } },
      { collection: TABLE_BACKGROUND_TASKS, keys: { tool_call_id: 1 } },
    ];
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) return;
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        const collection = await this.getCollection();
        await collection.createIndex(indexDef.keys, indexDef.options);
      } catch (error) {
        this.logger?.warn?.(`Failed to create index on ${TABLE_BACKGROUND_TASKS}:`, error);
      }
    }
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) return;
    for (const indexDef of this.#indexes) {
      try {
        const collection = await this.getCollection();
        await collection.createIndex(indexDef.keys, indexDef.options);
      } catch (error) {
        this.logger?.warn?.(`Failed to create custom index on ${TABLE_BACKGROUND_TASKS}:`, error);
      }
    }
  }

  async init(): Promise<void> {
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  async dangerouslyClearAll(): Promise<void> {
    const collection = await this.getCollection();
    await collection.deleteMany({});
  }

  async createTask(task: BackgroundTask): Promise<void> {
    const collection = await this.getCollection();
    await collection.insertOne(toDoc(task));
  }

  async updateTask(taskId: string, update: UpdateBackgroundTask): Promise<void> {
    const $set: Record<string, any> = {};

    if ('status' in update) $set.status = update.status;
    if ('result' in update) $set.result = update.result ?? null;
    if ('error' in update) $set.error = update.error ?? null;
    if ('retryCount' in update) $set.retry_count = update.retryCount;
    if ('startedAt' in update) $set.startedAt = update.startedAt?.toISOString() ?? null;
    if ('completedAt' in update) $set.completedAt = update.completedAt?.toISOString() ?? null;

    if (Object.keys($set).length === 0) return;

    const collection = await this.getCollection();
    await collection.updateOne({ id: taskId }, { $set });
  }

  async getTask(taskId: string): Promise<BackgroundTask | null> {
    const collection = await this.getCollection();
    const doc = await collection.findOne({ id: taskId });
    return doc ? fromDoc(doc) : null;
  }

  async listTasks(filter: TaskFilter): Promise<TaskListResult> {
    const query: Record<string, any> = {};

    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      query.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
    }
    if (filter.agentId) query.agent_id = filter.agentId;
    if (filter.threadId) query.thread_id = filter.threadId;
    if (filter.resourceId) query.resource_id = filter.resourceId;
    if (filter.runId) query.run_id = filter.runId;
    if (filter.toolName) query.tool_name = filter.toolName;
    // Date range filtering
    const dateCol =
      filter.dateFilterBy === 'startedAt'
        ? 'startedAt'
        : filter.dateFilterBy === 'completedAt'
          ? 'completedAt'
          : 'createdAt';
    if (filter.fromDate) {
      query[dateCol] = { ...(query[dateCol] || {}), $gte: filter.fromDate.toISOString() };
    }
    if (filter.toDate) {
      query[dateCol] = { ...(query[dateCol] || {}), $lt: filter.toDate.toISOString() };
    }

    const orderCol =
      filter.orderBy === 'startedAt' ? 'startedAt' : filter.orderBy === 'completedAt' ? 'completedAt' : 'createdAt';
    const direction = filter.orderDirection === 'desc' ? -1 : 1;

    const collection = await this.getCollection();
    const total = await collection.countDocuments(query);

    let cursor = collection.find(query).sort({ [orderCol]: direction });

    if (filter.perPage != null) {
      if (filter.page != null) {
        cursor = cursor.skip(filter.page * filter.perPage);
      }
      cursor = cursor.limit(filter.perPage);
    }

    const docs = await cursor.toArray();
    return { tasks: docs.map(fromDoc), total };
  }

  async deleteTask(taskId: string): Promise<void> {
    const collection = await this.getCollection();
    await collection.deleteOne({ id: taskId });
  }

  async deleteTasks(filter: TaskFilter): Promise<void> {
    const query: Record<string, any> = {};

    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      query.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
    }
    // Date range filtering
    const dateCol =
      filter.dateFilterBy === 'startedAt'
        ? 'startedAt'
        : filter.dateFilterBy === 'completedAt'
          ? 'completedAt'
          : 'createdAt';
    if (filter.fromDate) {
      query[dateCol] = { ...(query[dateCol] || {}), $gte: filter.fromDate.toISOString() };
    }
    if (filter.toDate) {
      query[dateCol] = { ...(query[dateCol] || {}), $lt: filter.toDate.toISOString() };
    }
    if (filter.agentId) query.agent_id = filter.agentId;
    if (filter.threadId) query.thread_id = filter.threadId;
    if (filter.resourceId) query.resource_id = filter.resourceId;
    if (filter.runId) query.run_id = filter.runId;
    if (filter.toolName) query.tool_name = filter.toolName;

    if (Object.keys(query).length === 0) return; // Safety: don't delete everything

    const collection = await this.getCollection();
    await collection.deleteMany(query);
  }

  async getRunningCount(): Promise<number> {
    const collection = await this.getCollection();
    return collection.countDocuments({ status: 'running' });
  }

  async getRunningCountByAgent(agentId: string): Promise<number> {
    const collection = await this.getCollection();
    return collection.countDocuments({ status: 'running', agent_id: agentId });
  }
}
