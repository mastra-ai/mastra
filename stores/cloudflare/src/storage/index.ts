import type { StorageThreadType, MessageType } from '@mastra/core/memory';
import { MastraStorage, TABLE_MESSAGES, TABLE_THREADS, TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import type { TABLE_NAMES, StorageColumn, StorageGetMessagesArg, EvalRow } from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import Cloudflare from 'cloudflare';

export interface CloudflareConfig {
  accountId: string;
  apiToken: string;
  namespacePrefix: string;
}

export class CloudflareStore extends MastraStorage {
  private client: Cloudflare;
  private accountId: string;
  private namespacePrefix: string;

  constructor(config: CloudflareConfig) {
    super({ name: 'Cloudflare' });
    this.accountId = config.accountId;
    this.namespacePrefix = config.namespacePrefix;

    this.client = new Cloudflare({
      apiToken: config.apiToken,
    });
  }

  private async getNamespaceIdByName(namespaceName: string): Promise<string | null> {
    try {
      const response = await this.client.kv.namespaces.list({ account_id: this.accountId });
      const namespace = response.result.find(ns => ns.title === namespaceName);
      return namespace ? namespace.id : null;
    } catch (error: any) {
      console.error('Error fetching namespace ID:', error);
      try {
        // List all namespaces and log them to help debug
        const allNamespaces = await this.client.kv.namespaces.list({ account_id: this.accountId });
        console.log(
          'Available namespaces:',
          allNamespaces.result.map(ns => ({ title: ns.title, id: ns.id })),
        );
        return null;
      } catch {
        return null;
      }
    }
  }

  private async createNamespace(namespaceName: string): Promise<string> {
    try {
      const response = await this.client.kv.namespaces.create({
        account_id: this.accountId,
        title: namespaceName,
      });
      return response.id;
    } catch (error: any) {
      // Check if the error is because it already exists
      if (error.message && error.message.includes('already exists')) {
        // Try to get it again since we know it exists
        const namespaces = await this.client.kv.namespaces.list({ account_id: this.accountId });
        const namespace = namespaces.result.find(ns => ns.title === namespaceName);
        if (namespace) return namespace.id;
      }
      console.error('Error creating namespace:', error);
      throw new Error(`Failed to create namespace ${namespaceName}: ${error.message}`);
    }
  }

  private async getOrCreateNamespaceId(namespaceName: string): Promise<string> {
    let namespaceId = await this.getNamespaceIdByName(namespaceName);
    if (!namespaceId) {
      namespaceId = await this.createNamespace(namespaceName);
    }
    return namespaceId;
  }

  private async getNamespaceId(tableName: TABLE_NAMES): Promise<string> {
    const prefix = this.namespacePrefix;

    try {
      if (tableName === TABLE_MESSAGES || tableName === TABLE_THREADS) {
        return await this.getOrCreateNamespaceId(`${prefix}_mastra_threads`);
      } else if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
        return await this.getOrCreateNamespaceId(`${prefix}_mastra_workflows`);
      } else {
        return await this.getOrCreateNamespaceId(`${prefix}_mastra_evals`);
      }
    } catch (error: any) {
      console.error('Error fetching namespace ID:', error);
      throw new Error(`Failed to fetch namespace ID for table ${tableName}: ${error.message}`);
    }
  }

  private async putKV(tableName: TABLE_NAMES, key: string, value: any): Promise<void> {
    try {
      const namespaceId = await this.getNamespaceId(tableName);
      await this.client.kv.namespaces.values.update(namespaceId, key, {
        account_id: this.accountId,
        value: JSON.stringify(value),
        metadata: '',
      });
    } catch (error: any) {
      console.error('Error putting KV:', error);
      throw new Error(`Failed to put KV for table ${tableName}, key ${key}: ${error.message}`);
    }
  }

  private async getKV(tableName: TABLE_NAMES, key: string): Promise<string | null> {
    try {
      console.log('getKV', tableName, key);
      const namespaceId = await this.getNamespaceId(tableName);
      console.log('namespaceId', namespaceId);

      try {
        const response = await this.client.kv.namespaces.values.get(namespaceId, key, {
          account_id: this.accountId,
        });
        const text = await response.text();
        return text === '' ? null : text;
      } catch (error: any) {
        // Handle "key not found" error gracefully
        if (error.message && error.message.includes('key not found')) {
          console.log(`Key not found: ${key}`);
          return null;
        }
        throw error; // Rethrow other errors
      }
    } catch (error: any) {
      console.error('Error getting KV:', error);
      throw new Error(`Failed to get KV for table ${tableName}, key ${key}: ${error.message}`);
    }
  }

  private async deleteKV(tableName: TABLE_NAMES, key: string): Promise<void> {
    try {
      const namespaceId = await this.getNamespaceId(tableName);
      await this.client.kv.namespaces.values.delete(namespaceId, key, {
        account_id: this.accountId,
      });
    } catch (error: any) {
      console.error('Error deleting KV:', error);
      throw new Error(`Failed to delete KV for table ${tableName}, key ${key}: ${error.message}`);
    }
  }

  private async listKV(tableName: TABLE_NAMES): Promise<Array<{ name: string }>> {
    try {
      const namespaceId = await this.getNamespaceId(tableName);
      const response = await this.client.kv.namespaces.keys.list(namespaceId, {
        account_id: this.accountId,
        limit: 1000,
      });
      return response.result.map(item => ({ name: item.name }));
    } catch (error: any) {
      console.error('Error listing KV:', error);
      throw new Error(`Failed to list KV for table ${tableName}: ${error.message}`);
    }
  }

  /*---------------------------------------------------------------------------
    Sorted set simulation helpers for message ordering.
    We store an array of objects { id, score } as JSON under a dedicated key.
  ---------------------------------------------------------------------------*/

  private async getSortedOrder(
    tableName: TABLE_NAMES,
    orderKey: string,
  ): Promise<Array<{ id: string; score: number }>> {
    const raw = await this.getKV(tableName, orderKey);
    if (!raw) return [];
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  private async updateSortedOrder(
    tableName: TABLE_NAMES,
    orderKey: string,
    newEntries: Array<{ id: string; score: number }>,
  ): Promise<void> {
    const currentOrder = await this.getSortedOrder(tableName, orderKey);
    // Merge new entries without duplicates.
    for (const entry of newEntries) {
      if (!currentOrder.find(e => e.id === entry.id)) {
        currentOrder.push(entry);
      }
    }
    currentOrder.sort((a, b) => a.score - b.score);
    await this.putKV(tableName, orderKey, JSON.stringify(currentOrder));
  }

  private async getRank(tableName: TABLE_NAMES, orderKey: string, id: string): Promise<number | null> {
    const order = await this.getSortedOrder(tableName, orderKey);
    const index = order.findIndex(item => item.id === id);
    return index >= 0 ? index : null;
  }

  private async getRange(tableName: TABLE_NAMES, orderKey: string, start: number, end: number): Promise<string[]> {
    const order = await this.getSortedOrder(tableName, orderKey);
    const sliced = order.slice(start, end + 1);
    return sliced.map(item => item.id);
  }

  private async getLastN(tableName: TABLE_NAMES, orderKey: string, n: number): Promise<string[]> {
    const order = await this.getSortedOrder(tableName, orderKey);
    const sliced = order.slice(-n);
    return sliced.map(item => item.id);
  }

  private async getFullOrder(tableName: TABLE_NAMES, orderKey: string): Promise<string[]> {
    const order = await this.getSortedOrder(tableName, orderKey);
    return order.map(item => item.id);
  }

  //////////////////////////////////////////

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
    await this.putKV(tableName, `schema:${tableName}`, schema);
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    const keys = await this.listKV(tableName);
    if (keys.length > 0) {
      await Promise.all(keys.map(keyObj => this.deleteKV(tableName, keyObj.name)));
    }
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    let key: string;
    if (tableName === TABLE_MESSAGES) {
      key = this.getKey(tableName, { threadId: record.threadId, id: record.id });
    } else {
      key = this.getKey(tableName, { id: record.id });
    }

    const processedRecord = {
      ...record,
      createdAt: this.serializeDate(record.createdAt),
      updatedAt: this.serializeDate(record.updatedAt),
    };

    await this.putKV(tableName, key, processedRecord);
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    const key = this.getKey(tableName, keys);
    const data = await this.getKV(tableName, key);

    if (!data) return null;

    try {
      return JSON.parse(data) as R;
    } catch (error) {
      console.error(`Failed to parse JSON data for key ${key}:`, error);
      console.debug('Raw data:', data);
      return null;
    }
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    const thread = await this.load<StorageThreadType>({ tableName: TABLE_THREADS, keys: { id: threadId } });
    if (!thread) return null;

    try {
      return {
        ...thread,
        createdAt: this.ensureDate(thread.createdAt)!,
        updatedAt: this.ensureDate(thread.updatedAt)!,
        metadata:
          typeof thread.metadata === 'string'
            ? thread.metadata
              ? JSON.parse(thread.metadata)
              : {}
            : thread.metadata || {},
      };
    } catch (error) {
      console.error(`Error processing thread ${threadId}:`, error);
      return null;
    }
  }

  async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
    const keyList = await this.listKV(TABLE_THREADS);
    const threads = await Promise.all(
      keyList.map(async keyObj => {
        const data = await this.getKV(TABLE_THREADS, keyObj.name);
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
      tableName: TABLE_THREADS,
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
      tableName: TABLE_THREADS,
      record: updatedThread,
    });
    return updatedThread;
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    const key = this.getKey(TABLE_THREADS, { id: threadId });
    await this.deleteKV(TABLE_THREADS, key);
  }

  private getMessageKey(threadId: string, messageId: string): string {
    return this.getKey(TABLE_MESSAGES, { threadId, id: messageId });
  }
  private getThreadMessagesKey(threadId: string): string {
    return `thread:${threadId}:messages`;
  }

  async saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]> {
    if (messages.length === 0) return [];

    await Promise.all(
      messages.map(async (message, index) => {
        const typedMessage = message as MessageType & { _index?: number };
        if (typedMessage._index === undefined) {
          typedMessage._index = index;
        }
        const key = this.getMessageKey(message.threadId, message.id);
        await this.putKV(TABLE_MESSAGES, key, JSON.stringify(typedMessage));
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
        await this.updateSortedOrder(TABLE_MESSAGES, orderKey, entries);
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

    // Get specifically included messages and their context
    if (selectBy?.include?.length) {
      for (const item of selectBy.include) {
        messageIds.add(item.id);
        if (item.withPreviousMessages || item.withNextMessages) {
          const rank = await this.getRank(TABLE_MESSAGES, threadMessagesKey, item.id);
          if (rank === null) continue;
          if (item.withPreviousMessages) {
            const start = Math.max(0, rank - item.withPreviousMessages);
            const prevIds = await this.getRange(TABLE_MESSAGES, threadMessagesKey, start, rank - 1);
            prevIds.forEach(id => messageIds.add(id));
          }
          if (item.withNextMessages) {
            const nextIds = await this.getRange(
              TABLE_MESSAGES,
              threadMessagesKey,
              rank + 1,
              rank + item.withNextMessages,
            );
            nextIds.forEach(id => messageIds.add(id));
          }
        }
      }
    }

    // Then get the most recent messages
    const latestIds = limit === 0 ? [] : await this.getLastN(TABLE_MESSAGES, threadMessagesKey, limit);
    latestIds.forEach(id => messageIds.add(id));

    // Fetch all needed messages
    const messages = (
      await Promise.all(
        Array.from(messageIds).map(async id => {
          const key = this.getMessageKey(threadId, id);
          const data = await this.getKV(TABLE_MESSAGES, key);
          return data ? (JSON.parse(data) as MessageType & { _index?: number }) : null;
        }),
      )
    ).filter(msg => msg !== null) as (MessageType & { _index?: number })[];

    // Sort messages by their stored order
    const messageOrder = await this.getFullOrder(TABLE_MESSAGES, threadMessagesKey);
    messages.sort((a, b) => messageOrder.indexOf(a.id) - messageOrder.indexOf(b.id));

    // Remove _index before returning
    return messages.map(({ _index, ...message }) => message as unknown as T);
  }

  async persistWorkflowSnapshot(params: {
    namespace: string;
    workflowName: string;
    runId: string;
    snapshot: WorkflowRunState;
  }): Promise<void> {
    const { namespace, workflowName, runId, snapshot } = params;
    const key = this.getKey(TABLE_WORKFLOW_SNAPSHOT, {
      namespace,
      workflow_name: workflowName,
      run_id: runId,
    });
    await this.putKV(TABLE_WORKFLOW_SNAPSHOT, key, snapshot);
  }

  async loadWorkflowSnapshot(params: {
    namespace: string;
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    const { namespace, workflowName, runId } = params;
    const key = this.getKey(TABLE_WORKFLOW_SNAPSHOT, {
      namespace,
      workflow_name: workflowName,
      run_id: runId,
    });
    const data = await this.getKV(TABLE_WORKFLOW_SNAPSHOT, key);
    return data ? (JSON.parse(data) as WorkflowRunState) : null;
  }

  batchInsert(_input: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
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

  getEvalsByAgentName(_agentName: string, _type?: 'test' | 'live'): Promise<EvalRow[]> {
    throw new Error('Method not implemented.');
  }

  async close(): Promise<void> {
    // No explicit cleanup needed
  }
}
