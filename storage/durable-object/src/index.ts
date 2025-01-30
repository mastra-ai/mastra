import { DurableObjectId, DurableObjectNamespace, Request } from '@cloudflare/workers-types';
import { MastraStorage, StorageColumn, TABLE_NAMES, MessageType, StorageThreadType } from '@mastra/core';

export interface DurableObjectConfig {
  durableObjectId: DurableObjectId;
  durableObjectNamespace: DurableObjectNamespace;
}

export class DurableObjectStorage extends MastraStorage {
  private objectId: DurableObjectId;
  private objectNamespace: DurableObjectNamespace;

  constructor(config: DurableObjectConfig) {
    super({ name: 'DURABLE_OBJECT' });
    this.objectId = config.durableObjectId;
    this.objectNamespace = config.durableObjectNamespace;
  }

  private getKey(tableName: string, keys: Record<string, any>): string {
    const keyParts = Object.entries(keys)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_, value]) => value);
    return `${tableName}:${keyParts.join(':')}`;
  }

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    // No need to create tables for Durable Objects as it's a key-value store
    // But we'll store the schema for reference
    const schemaKey = `schema:${tableName}`;
    const obj = this.objectNamespace.get(this.objectId);
    await obj.fetch(
      new Request(`https://dummy/schema/${schemaKey}`, {
        method: 'PUT',
        body: JSON.stringify(schema),
      }),
    );
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    const obj = this.objectNamespace.get(this.objectId);
    const stub = await obj.fetch(
      new Request(`https://dummy/clear/${tableName}`, {
        method: 'DELETE',
      }),
    );

    if (!stub.ok) {
      throw new Error(`Failed to clear table: ${await stub.text()}`);
    }
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    const keys = this.getPrimaryKeys(tableName, record);
    const key = this.getKey(tableName, keys);

    const obj = this.objectNamespace.get(this.objectId);
    const stub = await obj.fetch(
      new Request(`https://dummy/data/${key}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...record,
          _metadata: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      }),
    );

    if (!stub.ok) {
      throw new Error(`Failed to insert record: ${await stub.text()}`);
    }
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    const key = this.getKey(tableName, keys);
    const obj = this.objectNamespace.get(this.objectId);
    const stub = await obj.fetch(
      new Request(`https://dummy/data/${key}`, {
        method: 'GET',
      }),
    );

    if (!stub.ok) {
      if (stub.status === 404) {
        return null;
      }
      throw new Error(`Failed to load record: ${await stub.text()}`);
    }

    const data = await stub.json();
    // Remove metadata before returning
    const { _metadata, ...record } = data as { _metadata: unknown } & Record<string, unknown>;
    return record as R;
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    return this.load<StorageThreadType>({
      tableName: MastraStorage.TABLE_THREADS,
      keys: { id: threadId },
    });
  }

  async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
    const obj = this.objectNamespace.get(this.objectId);
    const stub = await obj.fetch(
      new Request(`https://dummy/query/${MastraStorage.TABLE_THREADS}/${resourceId}`, {
        method: 'GET',
      }),
    );

    if (!stub.ok) {
      throw new Error(`Failed to get threads: ${await stub.text()}`);
    }

    const threads = (await stub.json()) as StorageThreadType[];
    return threads;
  }

  async getMessages({ threadId }: { threadId: string }): Promise<MessageType[]> {
    const obj = this.objectNamespace.get(this.objectId);
    const stub = await obj.fetch(
      new Request(`https://dummy/query/${MastraStorage.TABLE_MESSAGES}/${threadId}`, {
        method: 'GET',
      }),
    );

    if (!stub.ok) {
      throw new Error(`Failed to get messages: ${await stub.text()}`);
    }

    const messages = (await stub.json()) as MessageType[];
    return messages.map(message => {
      const content = typeof message.content === 'string' ? JSON.parse(message.content) : message.content;
      return { ...message, content };
    });
  }

  async saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]> {
    const obj = this.objectNamespace.get(this.objectId);

    await Promise.all(
      messages.map(async message => {
        const key = this.getKey(MastraStorage.TABLE_MESSAGES, { id: message.id });
        await obj.fetch(
          new Request(`https://dummy/data/${key}`, {
            method: 'PUT',
            body: JSON.stringify({
              ...message,
              content: JSON.stringify(message.content),
              _metadata: {
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            }),
          }),
        );
      }),
    );

    return messages;
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    const key = this.getKey(MastraStorage.TABLE_THREADS, { id: thread.id });
    const obj = this.objectNamespace.get(this.objectId);

    await obj.fetch(
      new Request(`https://dummy/data/${key}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...thread,
          _metadata: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      }),
    );

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
      throw new Error(`Thread not found: ${id}`);
    }

    const updatedThread: StorageThreadType = {
      ...thread,
      title,
      metadata,
    };

    return this.saveThread({ thread: updatedThread });
  }

  async deleteThread({ id }: { id: string }): Promise<void> {
    const key = this.getKey(MastraStorage.TABLE_THREADS, { id });
    const obj = this.objectNamespace.get(this.objectId);

    // Delete the thread
    await obj.fetch(
      new Request(`https://dummy/data/${key}`, {
        method: 'DELETE',
      }),
    );

    // Delete associated messages
    const messages = await this.getMessages({ threadId: id });
    await Promise.all(
      messages.map(async message => {
        const messageKey = this.getKey(MastraStorage.TABLE_MESSAGES, { id: message.id });
        await obj.fetch(
          new Request(`https://dummy/data/${messageKey}`, {
            method: 'DELETE',
          }),
        );
      }),
    );
  }

  private getPrimaryKeys(tableName: TABLE_NAMES, record: Record<string, any>): Record<string, any> {
    // For simplicity, we'll use these primary key mappings
    const primaryKeyMap: Record<string, string[]> = {
      [MastraStorage.TABLE_WORKFLOW_SNAPSHOT]: ['workflow_name', 'run_id'],
      [MastraStorage.TABLE_THREADS]: ['id'],
      [MastraStorage.TABLE_MESSAGES]: ['id'],
      [MastraStorage.TABLE_EVALS]: ['id'],
    };

    const keys = primaryKeyMap[tableName];
    if (!keys) {
      throw new Error(`Unknown table: ${tableName}`);
    }

    return keys.reduce(
      (acc, key) => {
        if (!(key in record)) {
          throw new Error(`Missing primary key ${key} for table ${tableName}`);
        }
        acc[key] = record[key];
        return acc;
      },
      {} as Record<string, any>,
    );
  }
}
