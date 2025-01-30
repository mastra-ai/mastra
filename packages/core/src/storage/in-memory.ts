import { MessageType, ThreadType } from '../memory';

import { MastraStorage, TABLE_NAMES } from './base';
import { StorageColumn } from './types';

export class MastraStorageInMemory extends MastraStorage {
  // In-memory storage
  private tables: Map<TABLE_NAMES, Map<string, any>>;
  private threads: Map<string, ThreadType>;
  private messages: Map<string, MessageType[]>;

  constructor() {
    super({ name: 'in-memory' });
    // Initialize in-memory storage
    this.tables = new Map();
    this.threads = new Map();
    this.messages = new Map();
  }

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    if (!this.tables.has(tableName)) {
      this.tables.set(tableName, new Map());
    }
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    this.tables.get(tableName)?.clear();
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    const table = this.tables.get(tableName);
    if (!table) {
      throw new Error(`Table ${tableName} not found`);
    }

    if (tableName === MastraStorage.TABLE_WORKFLOWS) {
      const key = `${record.workflow_name}:${record.run_id}`;
      table.set(key, record);
    } else {
      const key = record.global_run_id || record.id;
      table.set(key, record);
    }
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    const table = this.tables.get(tableName);
    if (!table) {
      throw new Error(`Table ${tableName} not found`);
    }

    if (tableName === MastraStorage.TABLE_WORKFLOWS) {
      const key = `${keys.workflow_name}:${keys.run_id}`;
      return (table.get(key) as R) || null;
    }

    const firstKey = Object.values(keys)[0];
    return (table.get(firstKey!) as R) || null;
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<ThreadType | null> {
    return this.threads.get(threadId) || null;
  }

  async getThreadsByResourceId({ resource_id }: { resource_id: string }): Promise<ThreadType[]> {
    return Array.from(this.threads.values()).filter(thread => thread.resource_id === resource_id);
  }

  async saveThread({ thread }: { thread: ThreadType }): Promise<ThreadType> {
    this.threads.set(thread.id, thread);
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
  }): Promise<ThreadType> {
    const thread = this.threads.get(id);
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
    this.threads.set(id, updatedThread);
    return updatedThread;
  }

  async deleteThread({ id }: { id: string }): Promise<void> {
    this.threads.delete(id);
    this.messages.delete(id);
  }

  async getMessages<T = unknown>({ threadId }: { threadId: string }): Promise<T> {
    return (this.messages.get(threadId) || []) as T;
  }

  async saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]> {
    if (messages.length === 0) return messages;

    const threadId = messages?.[0]?.threadId;

    if (!threadId) {
      throw new Error('Thread ID is required');
    }

    const existingMessages = this.messages.get(threadId) || [];
    const updatedMessages = [...existingMessages, ...messages];

    this.messages.set(threadId, updatedMessages);
    return messages;
  }
}
