import { type StorageThreadType, type MessageType } from '@mastra/core/memory';
import {
  MastraStorage,
  type TABLE_NAMES,
  type StorageColumn,
  type StorageGetMessagesArg,
  type EvalRow,
} from '@mastra/core/storage';
import { TABLE_THREADS } from '@mastra/core/storage';
import { type WorkflowRunState } from '@mastra/core/workflows';

export interface CloudflareConfig {
  accountId: string;
  namespaceId: string;
  apiToken: string;
}

export class CloudflareStore extends MastraStorage {
  private accountId: string;
  private namespaceId: string;
  private apiToken: string;
  private baseUrl: string;

  constructor(config: CloudflareConfig) {
    super({ name: 'Cloudflare' });
    this.accountId = config.accountId;
    this.namespaceId = config.namespaceId;
    this.apiToken = config.apiToken;
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/storage/kv/namespaces/${this.namespaceId}`;
  }

  private async getKV(key: string): Promise<string | null> {
    const url = `${this.baseUrl}/values/${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
      },
    });
    if (res.status === 200) {
      return await res.text();
    } else if (res.status === 404) {
      return null;
    } else {
      const err = await res.text();
      throw new Error(`Error getting key ${key}: ${err}`);
    }
  }

  private async putKV(key: string, value: any): Promise<void> {
    const url = `${this.baseUrl}/values/${encodeURIComponent(key)}`;
    const body = typeof value === 'string' ? value : JSON.stringify(value);
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Error putting key ${key}: ${err}`);
    }
  }

  private async deleteKV(key: string): Promise<void> {
    const url = `${this.baseUrl}/values/${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
      },
    });
    if (!res.ok && res.status !== 404) {
      const err = await res.text();
      throw new Error(`Error deleting key ${key}: ${err}`);
    }
  }

  private async listKV(prefix: string): Promise<Array<{ name: string }>> {
    const url = `${this.baseUrl}/keys?prefix=${encodeURIComponent(prefix)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
      },
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Error listing keys with prefix ${prefix}: ${err}`);
    }
    const data = (await res.json()) as { result: Array<{ name: string }> };
    return data.result;
  }

  /*---------------------------------------------------------------------------
    Sorted set simulation helpers for message ordering.
    We store an array of objects { id, score } as JSON under a dedicated key.
  ---------------------------------------------------------------------------*/

  private async getSortedOrder(orderKey: string): Promise<Array<{ id: string; score: number }>> {
    const raw = await this.getKV(orderKey);
    if (!raw) return [];
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  private async updateSortedOrder(orderKey: string, newEntries: Array<{ id: string; score: number }>): Promise<void> {
    const currentOrder = await this.getSortedOrder(orderKey);
    // Merge new entries without duplicates.
    for (const entry of newEntries) {
      if (!currentOrder.find(e => e.id === entry.id)) {
        currentOrder.push(entry);
      }
    }
    currentOrder.sort((a, b) => a.score - b.score);
    await this.putKV(orderKey, JSON.stringify(currentOrder));
  }

  private async getRank(orderKey: string, id: string): Promise<number | null> {
    const order = await this.getSortedOrder(orderKey);
    const index = order.findIndex(item => item.id === id);
    return index >= 0 ? index : null;
  }

  private async getRange(orderKey: string, start: number, end: number): Promise<string[]> {
    const order = await this.getSortedOrder(orderKey);
    const sliced = order.slice(start, end + 1);
    return sliced.map(item => item.id);
  }

  private async getLastN(orderKey: string, n: number): Promise<string[]> {
    const order = await this.getSortedOrder(orderKey);
    const sliced = order.slice(-n);
    return sliced.map(item => item.id);
  }

  private async getFullOrder(orderKey: string): Promise<string[]> {
    const order = await this.getSortedOrder(orderKey);
    return order.map(item => item.id);
  }

  /*---------------------------------------------------------------------------
    Utility functions for key construction and date handling.
  ---------------------------------------------------------------------------*/

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

  /*---------------------------------------------------------------------------
    Methods that mirror the Upstash Redis implementation.
  ---------------------------------------------------------------------------*/

  batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    throw new Error('Method not implemented.');
  }

  getTraces({
    name,
    scope,
    page,
    perPage,
    attributes,
  }: {
    name?: string;
    scope?: string;
    page: number;
    perPage: number;
    attributes?: Record<string, string>;
  }): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    // KV is schemaless but we can store the schema for reference.
    await this.putKV(`schema:${tableName}`, JSON.stringify(schema));
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    const prefix = `${tableName}:`;
    const keys = await this.listKV(prefix);
    if (keys.length > 0) {
      await Promise.all(keys.map(keyObj => this.deleteKV(keyObj.name)));
    }
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    let key: string;
    if (tableName === MastraStorage.TABLE_MESSAGES) {
      // For messages, use threadId and id
      key = this.getKey(tableName, { threadId: record.threadId, id: record.id });
    } else {
      key = this.getKey(tableName, { id: record.id });
    }

    const processedRecord = {
      ...record,
      createdAt: this.serializeDate(record.createdAt),
      updatedAt: this.serializeDate(record.updatedAt),
    };

    await this.putKV(key, JSON.stringify(processedRecord));
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    const key = this.getKey(tableName, keys);
    const data = await this.getKV(key);
    return data ? (JSON.parse(data) as R) : null;
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    const thread = await this.load<StorageThreadType>({
      tableName: TABLE_THREADS,
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
    const prefix = `${MastraStorage.TABLE_THREADS}:`;
    const keyList = await this.listKV(prefix);
    const threads = await Promise.all(
      keyList.map(async keyObj => {
        const data = await this.getKV(keyObj.name);
        return data ? (JSON.parse(data) as StorageThreadType) : null;
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
    await this.insert({
      tableName: MastraStorage.TABLE_THREADS,
      record: updatedThread,
    });
    return updatedThread;
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    const key = this.getKey(MastraStorage.TABLE_THREADS, { id: threadId });
    await this.deleteKV(key);
  }

  private getMessageKey(threadId: string, messageId: string): string {
    return this.getKey(MastraStorage.TABLE_MESSAGES, { threadId, id: messageId });
  }

  private getThreadMessagesKey(threadId: string): string {
    return `thread:${threadId}:messages`;
  }

  async saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]> {
    if (messages.length === 0) return [];
    // Save individual messages.
    await Promise.all(
      messages.map(async (message, index) => {
        // Create a type-safe way to handle _index
        const typedMessage = message as MessageType & { _index?: number };
        if (typedMessage._index === undefined) {
          typedMessage._index = index;
        }
        const key = this.getMessageKey(message.threadId, message.id);
        await this.putKV(key, JSON.stringify(typedMessage));
      }),
    );

    // Update sorted order for each thread.
    const threadsMap = new Map<string, Array<{ id: string; score: number }>>();
    for (const message of messages) {
      const typedMessage = message as MessageType & { _index?: number };
      const score = typedMessage._index !== undefined ? typedMessage._index : new Date(message.createdAt).getTime();
      if (!threadsMap.has(message.threadId)) {
        threadsMap.set(message.threadId, []);
      }
      threadsMap.get(message.threadId)!.push({ id: message.id, score });
    }
    await Promise.all(
      Array.from(threadsMap.entries()).map(async ([threadId, entries]) => {
        const orderKey = this.getThreadMessagesKey(threadId);
        await this.updateSortedOrder(orderKey, entries);
      }),
    );
    return messages;
  }

  async getMessages<T = unknown>({ threadId, selectBy }: StorageGetMessagesArg): Promise<T[]> {
    const limit = typeof selectBy?.last === 'number' ? selectBy.last : 40;
    const messageIds = new Set<string>();
    const threadMessagesKey = this.getThreadMessagesKey(threadId);

    if (limit === 0 && !selectBy?.include) {
      return [];
    }

    // Get specifically included messages and their context.
    if (selectBy?.include?.length) {
      for (const item of selectBy.include) {
        messageIds.add(item.id);
        if (item.withPreviousMessages || item.withNextMessages) {
          const rank = await this.getRank(threadMessagesKey, item.id);
          if (rank === null) continue;
          if (item.withPreviousMessages) {
            const start = Math.max(0, rank - item.withPreviousMessages);
            const prevIds = await this.getRange(threadMessagesKey, start, rank - 1);
            prevIds.forEach(id => messageIds.add(id));
          }
          if (item.withNextMessages) {
            const nextIds = await this.getRange(threadMessagesKey, rank + 1, rank + item.withNextMessages);
            nextIds.forEach(id => messageIds.add(id));
          }
        }
      }
    }

    // Then get the most recent messages.
    const latestIds = limit === 0 ? [] : await this.getLastN(threadMessagesKey, limit);
    latestIds.forEach(id => messageIds.add(id));

    // Fetch all needed messages.
    const messages = (
      await Promise.all(
        Array.from(messageIds).map(async id => {
          const key = this.getMessageKey(threadId, id);
          const data = await this.getKV(key);
          return data ? (JSON.parse(data) as MessageType & { _index?: number }) : null;
        }),
      )
    ).filter(msg => msg !== null) as (MessageType & { _index?: number })[];

    // Sort messages by their stored order.
    const messageOrder = await this.getFullOrder(threadMessagesKey);
    messages.sort((a, b) => messageOrder.indexOf(a.id) - messageOrder.indexOf(b.id));

    // Remove _index before returning.
    return messages.map(({ _index, ...message }) => message as unknown as T);
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
    await this.putKV(key, JSON.stringify(snapshot));
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
    const data = await this.getKV(key);
    return data ? (JSON.parse(data) as WorkflowRunState) : null;
  }

  async close(): Promise<void> {
    // No explicit cleanup required for Cloudflare KV.
  }
}
