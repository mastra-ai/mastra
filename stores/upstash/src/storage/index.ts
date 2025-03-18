import type { StorageThreadType, MessageType } from '@mastra/core/memory';
import { MastraStorage } from '@mastra/core/storage';
import type { TABLE_NAMES, StorageColumn, StorageGetMessagesArg, EvalRow } from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { Redis } from '@upstash/redis';

export interface UpstashConfig {
  url: string;
  token: string;
}

export class UpstashStore extends MastraStorage {
  batchInsert(_input: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    throw new Error('Method not implemented.');
  }
  getEvalsByAgentName(_agentName: string, _type?: 'test' | 'live'): Promise<EvalRow[]> {
    throw new Error('Method not implemented.');
  }
  getTraces(_input: {
    name?: string;
    scope?: string;
    page: number;
    perPage: number;
    attributes?: Record<string, string>;
  }): Promise<any[]> {
    throw new Error('Method not implemented.');
  }
  private redis: Redis;

  constructor(config: UpstashConfig) {
    super({ name: 'Upstash' });
    this.redis = new Redis({
      url: config.url,
      token: config.token,
    });
  }

  private getKey(tableName: TABLE_NAMES, keys: Record<string, any>): string {
    const keyParts = Object.entries(keys).map(([key, value]) => `${key}:${value}`);
    return `${tableName}:${keyParts.join(':')}`;
  }

  private ensureDate(date: Date | string | undefined): Date | undefined {
    if (!date) return undefined;
    return date instanceof Date ? date : new Date(date);
  }

  private serializeDate(date: Date | string | undefined): string | undefined {
    if (!date) return undefined;
    const dateObj = this.ensureDate(date);
    return dateObj?.toISOString();
  }

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    // Redis is schemaless, so we don't need to create tables
    // But we can store the schema for reference
    await this.redis.set(`schema:${tableName}`, schema);
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    const pattern = `${tableName}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    let key: string;

    if (tableName === MastraStorage.TABLE_MESSAGES) {
      // For messages, use threadId as the primary key component
      key = this.getKey(tableName, { threadId: record.threadId, id: record.id });
    } else {
      key = this.getKey(tableName, { id: record.id });
    }

    // Convert dates to ISO strings before storing
    const processedRecord = {
      ...record,
      createdAt: this.serializeDate(record.createdAt),
      updatedAt: this.serializeDate(record.updatedAt),
    };

    await this.redis.set(key, processedRecord);
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    const key = this.getKey(tableName, keys);
    const data = await this.redis.get<R>(key);
    return data || null;
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    const thread = await this.load<StorageThreadType>({
      tableName: MastraStorage.TABLE_THREADS,
      keys: { id: threadId },
    });

    if (!thread) return null;

    return {
      ...thread,
      createdAt: this.ensureDate(thread.createdAt)!,
      updatedAt: this.ensureDate(thread.updatedAt)!,
      metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
    };
  }

  async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
    const pattern = `${MastraStorage.TABLE_THREADS}:*`;
    const keys = await this.redis.keys(pattern);
    const threads = await Promise.all(
      keys.map(async key => {
        const data = await this.redis.get<StorageThreadType>(key);
        return data;
      }),
    );

    return threads
      .filter(thread => thread && thread.resourceId === resourceId)
      .map(thread => ({
        ...thread!,
        createdAt: this.ensureDate(thread!.createdAt)!,
        updatedAt: this.ensureDate(thread!.updatedAt)!,
        metadata: typeof thread!.metadata === 'string' ? JSON.parse(thread!.metadata) : thread!.metadata,
      }));
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    await this.insert({
      tableName: MastraStorage.TABLE_THREADS,
      record: thread,
    });
    return thread;
  }

  async updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    const thread = await this.getThreadById({ threadId: id });
    if (!thread) {
      throw new Error(`Thread ${id} not found`);
    }

    const updatedThread = {
      ...thread,
      title,
      metadata: {
        ...thread.metadata,
        ...metadata,
      },
    };

    await this.__saveThread({ thread: updatedThread });
    return updatedThread;
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    const key = this.getKey(MastraStorage.TABLE_THREADS, { id: threadId });
    await this.redis.del(key);
  }

  private getMessageKey(threadId: string, messageId: string): string {
    return this.getKey(MastraStorage.TABLE_MESSAGES, { threadId, id: messageId });
  }

  private getThreadMessagesKey(threadId: string): string {
    return `thread:${threadId}:messages`;
  }

  async saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]> {
    if (messages.length === 0) return [];

    const pipeline = this.redis.pipeline();

    // Add an index to each message to maintain order
    const messagesWithIndex = messages.map((message, index) => ({
      ...message,
      _index: index,
    }));

    for (const message of messagesWithIndex) {
      const key = this.getMessageKey(message.threadId, message.id);
      const score = message._index !== undefined ? message._index : new Date(message.createdAt).getTime();

      // Store the message data
      pipeline.set(key, message);

      // Add to sorted set for this thread
      pipeline.zadd(this.getThreadMessagesKey(message.threadId), {
        score,
        member: message.id,
      });
    }

    await pipeline.exec();
    return messages;
  }

  async getMessages<T = unknown>({ threadId, selectBy }: StorageGetMessagesArg): Promise<T[]> {
    const limit = typeof selectBy?.last === `number` ? selectBy.last : 40;
    const messageIds = new Set<string>();
    const threadMessagesKey = this.getThreadMessagesKey(threadId);

    if (limit === 0 && !selectBy?.include) {
      return [];
    }

    // First, get specifically included messages and their context
    if (selectBy?.include?.length) {
      for (const item of selectBy.include) {
        messageIds.add(item.id);

        if (item.withPreviousMessages || item.withNextMessages) {
          // Get the rank of this message in the sorted set
          const rank = await this.redis.zrank(threadMessagesKey, item.id);
          if (rank === null) continue;

          // Get previous messages if requested
          if (item.withPreviousMessages) {
            const start = Math.max(0, rank - item.withPreviousMessages);
            const prevIds = rank === 0 ? [] : await this.redis.zrange(threadMessagesKey, start, rank - 1);
            prevIds.forEach(id => messageIds.add(id as string));
          }

          // Get next messages if requested
          if (item.withNextMessages) {
            const nextIds = await this.redis.zrange(threadMessagesKey, rank + 1, rank + item.withNextMessages);
            nextIds.forEach(id => messageIds.add(id as string));
          }
        }
      }
    }

    // Then get the most recent messages
    const latestIds = limit === 0 ? [] : await this.redis.zrange(threadMessagesKey, -limit, -1);
    latestIds.forEach(id => messageIds.add(id as string));

    // Fetch all needed messages in parallel
    const messages = (
      await Promise.all(
        Array.from(messageIds).map(async id =>
          this.redis.get<MessageType & { _index?: number }>(this.getMessageKey(threadId, id)),
        ),
      )
    ).filter(msg => msg !== null) as (MessageType & { _index?: number })[];

    // Sort messages by their position in the sorted set
    const messageOrder = await this.redis.zrange(threadMessagesKey, 0, -1);
    messages.sort((a, b) => messageOrder.indexOf(a!.id) - messageOrder.indexOf(b!.id));

    // Remove _index before returning
    return messages.map(({ _index, ...message }) => message as unknown as T);
  }

  async persistWorkflowSnapshot(params: {
    namespace: string;
    workflowName: string;
    runId: string;
    snapshot: WorkflowRunState;
  }): Promise<void> {
    const { namespace = 'workflows', workflowName, runId, snapshot } = params;
    const key = this.getKey(MastraStorage.TABLE_WORKFLOW_SNAPSHOT, {
      namespace,
      workflow_name: workflowName,
      run_id: runId,
    });
    await this.redis.set(key, snapshot); // Store snapshot directly without wrapping
  }

  async loadWorkflowSnapshot(params: {
    namespace: string;
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    const { namespace = 'workflows', workflowName, runId } = params;
    const key = this.getKey(MastraStorage.TABLE_WORKFLOW_SNAPSHOT, {
      namespace,
      workflow_name: workflowName,
      run_id: runId,
    });
    const data = await this.redis.get<WorkflowRunState>(key);
    return data || null;
  }

  async close(): Promise<void> {
    // No explicit cleanup needed for Upstash Redis
  }
}
