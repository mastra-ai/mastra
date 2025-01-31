import { MastraStorage, StorageThreadType, MessageType, TABLE_NAMES, StorageColumn } from '@mastra/core';
import { Redis } from '@upstash/redis';

export interface UpstashConfig {
  url: string;
  token: string;
}

export class UpstashStore extends MastraStorage {
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

  async init(): Promise<void> {
    // Initialize all required tables
    await Promise.all([
      this.createTable({ tableName: MastraStorage.TABLE_THREADS, schema: MastraStorage.THREADS_SCHEMA }),
      this.createTable({ tableName: MastraStorage.TABLE_MESSAGES, schema: MastraStorage.MESSAGES_SCHEMA }),
      this.createTable({
        tableName: MastraStorage.TABLE_WORKFLOW_SNAPSHOT,
        schema: MastraStorage.WORKFLOW_SNAPSHOT_SCHEMA,
      }),
      this.createTable({ tableName: MastraStorage.TABLE_EVALS, schema: MastraStorage.EVALS_SCHEMA }),
    ]);
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

    await this.saveThread({ thread: updatedThread });
    return updatedThread;
  }

  async deleteThread({ id }: { id: string }): Promise<void> {
    const key = this.getKey(MastraStorage.TABLE_THREADS, { id });
    await this.redis.del(key);
  }

  async saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]> {
    if (messages.length === 0) return [];

    // Add an index to each message to maintain order
    const messagesWithIndex = messages.map((message, index) => ({
      ...message,
      _index: index,
    }));

    await Promise.all(
      messagesWithIndex.map(message =>
        this.insert({
          tableName: MastraStorage.TABLE_MESSAGES,
          record: message,
        }),
      ),
    );

    return messages;
  }

  async getMessages({ threadId }: { threadId: string }): Promise<MessageType[]> {
    // Use a more specific key pattern that includes the threadId in the correct position
    const pattern = this.getKey(MastraStorage.TABLE_MESSAGES, { threadId: '*' });
    const keys = await this.redis.keys(pattern);
    const messages = await Promise.all(
      keys.map(async key => {
        const data = await this.redis.get<MessageType & { _index?: number }>(key);
        return data;
      }),
    );

    return messages
      .filter(message => message && message.threadId === threadId)
      .sort((a, b) => {
        // First try to sort by _index if available
        if (a!._index !== undefined && b!._index !== undefined) {
          return a!._index - b!._index;
        }
        // Fall back to createdAt if _index is not available
        return new Date(a!.createdAt).getTime() - new Date(b!.createdAt).getTime();
      })
      .map(({ _index, ...message }) => message as MessageType); // Remove _index before returning
  }

  async persistWorkflowSnapshot(params: {
    namespace: string;
    workflowName: string;
    runId: string;
    snapshot: WorkflowRunState;
  }): Promise<void> {
    const { namespace, workflowName, runId, snapshot } = params;
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
    const { namespace, workflowName, runId } = params;
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
