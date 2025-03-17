import type { StorageThreadType, MessageType } from '@mastra/core/memory';
import {
  MastraStorage,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_EVALS,
  TABLE_TRACES,
} from '@mastra/core/storage';
import type { TABLE_NAMES, StorageColumn, StorageGetMessagesArg, EvalRow } from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import type { KVNamespace } from '@cloudflare/workers-types';
import Cloudflare from 'cloudflare';
import { type CloudflareStoreConfig, isWorkersConfig, type RecordTypes } from './types';

export class CloudflareStore extends MastraStorage {
  private client?: Cloudflare;
  private accountId?: string;
  private namespacePrefix: string;
  private bindings?: Record<TABLE_NAMES, KVNamespace>;

  private validateWorkersConfig(
    config: CloudflareStoreConfig,
  ): asserts config is { bindings: Record<TABLE_NAMES, KVNamespace>; keyPrefix?: string } {
    if (!isWorkersConfig(config)) {
      throw new Error('Invalid Workers API configuration');
    }
    if (!config.bindings) {
      throw new Error('KV bindings are required when using Workers Binding API');
    }

    // Validate all required table bindings exist
    const requiredTables = [TABLE_THREADS, TABLE_MESSAGES, TABLE_WORKFLOW_SNAPSHOT, TABLE_EVALS, TABLE_TRACES] as const;

    for (const table of requiredTables) {
      if (!(table in config.bindings)) {
        throw new Error(`Missing KV binding for table: ${table}`);
      }
    }
  }

  private validateRestConfig(
    config: CloudflareStoreConfig,
  ): asserts config is { accountId: string; apiToken: string; namespacePrefix?: string } {
    if (isWorkersConfig(config)) {
      throw new Error('Invalid REST API configuration');
    }
    if (!config.accountId?.trim()) {
      throw new Error('accountId is required for REST API');
    }
    if (!config.apiToken?.trim()) {
      throw new Error('apiToken is required for REST API');
    }
  }

  constructor(config: CloudflareStoreConfig) {
    super({ name: 'Cloudflare' });

    try {
      if (isWorkersConfig(config)) {
        this.validateWorkersConfig(config);
        this.bindings = config.bindings;
        this.namespacePrefix = config.keyPrefix?.trim() || '';
        this.logger.info('Using Cloudflare KV Workers Binding API');
      } else {
        this.validateRestConfig(config);
        this.accountId = config.accountId.trim();
        this.namespacePrefix = config.namespacePrefix?.trim() || '';
        this.client = new Cloudflare({
          apiToken: config.apiToken.trim(),
        });
        this.logger.info('Using Cloudflare KV REST API');
      }
    } catch (error) {
      this.logger.error('Failed to initialize CloudflareStore:', { error });
      throw error;
    }
  }

  private getBinding(tableName: TABLE_NAMES) {
    if (!this.bindings) {
      throw new Error(`Cannot use Workers API binding for ${tableName}: Store initialized with REST API configuration`);
    }
    const binding = this.bindings[tableName];
    if (!binding) throw new Error(`No binding found for namespace ${tableName}`);
    return binding;
  }

  private async listNamespaces(): Promise<{
    result: Array<{ id: string; title: string; supports_url_encoding?: boolean }>;
  }> {
    if (this.bindings) {
      return {
        result: Object.keys(this.bindings).map(name => ({
          id: name,
          title: name,
          supports_url_encoding: true,
        })),
      };
    }
    return await this.client!.kv.namespaces.list({ account_id: this.accountId! });
  }

  private async getNamespaceValue(tableName: TABLE_NAMES, key: string) {
    try {
      if (this.bindings) {
        const binding = this.getBinding(tableName);
        const result = await binding.getWithMetadata(key, 'text');
        if (!result) return null;
        return JSON.stringify(result);
      } else {
        const namespaceId = await this.getNamespaceId(tableName);
        const response = await this.client!.kv.namespaces.values.get(namespaceId, key, {
          account_id: this.accountId!,
        });
        return await response.text();
      }
    } catch (error: any) {
      if (error.message && error.message.includes('key not found')) {
        return null;
      }
      this.logger.error(`Failed to get value for ${tableName} ${key}:`, { error });
      throw error;
    }
  }

  private async deleteNamespace(tableName: TABLE_NAMES) {
    if (this.bindings) {
      // For Workers API, we can't delete the namespace as it's bound at deploy time
      // Instead, clear all keys in the namespace
      await this.clearTable({ tableName });
    } else {
      const namespaceId = await this.getNamespaceId(tableName);
      await this.client!.kv.namespaces.delete(namespaceId, {
        account_id: this.accountId!,
      });
    }
  }

  private async putNamespaceValue({
    tableName,
    key,
    value,
    metadata,
  }: {
    tableName: TABLE_NAMES;
    key: string;
    value: string;
    metadata?: any;
  }) {
    try {
      // Ensure consistent serialization
      const serializedValue = this.safeSerialize(value);
      const serializedMetadata = metadata ? this.safeSerialize(metadata) : '';

      if (this.bindings) {
        const binding = this.getBinding(tableName);
        await binding.put(key, serializedValue, { metadata: serializedMetadata });
      } else {
        const namespaceId = await this.getNamespaceId(tableName);
        await this.client!.kv.namespaces.values.update(namespaceId, key, {
          account_id: this.accountId!,
          value: serializedValue,
          metadata: serializedMetadata,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to put value for ${tableName} ${key}:`, { error });
      throw error;
    }
  }

  private async deleteNamespaceValue(tableName: TABLE_NAMES, key: string) {
    if (this.bindings) {
      const binding = this.getBinding(tableName);
      await binding.delete(key);
    } else {
      const namespaceId = await this.getNamespaceId(tableName);
      await this.client!.kv.namespaces.values.delete(namespaceId, key, {
        account_id: this.accountId!,
      });
    }
  }

  async listNamespaceKeys(tableName: TABLE_NAMES, options?: { limit?: number; prefix?: string }) {
    try {
      if (this.bindings) {
        const binding = this.getBinding(tableName);
        const response = await binding.list({
          limit: options?.limit || 1000,
          prefix: options?.prefix,
        });

        // Convert Workers API response to match REST API format
        return response.keys;
      } else {
        const namespaceId = await this.getNamespaceId(tableName);
        // Use REST API
        const response = await this.client!.kv.namespaces.keys.list(namespaceId, {
          account_id: this.accountId!,
          limit: options?.limit || 1000,
          prefix: options?.prefix,
        });
        return response.result;
      }
    } catch (error: any) {
      this.logger.error(`Failed to list keys for ${tableName}:`, error);
      throw new Error(`Failed to list keys: ${error.message}`);
    }
  }

  private async createNamespaceById(title: string) {
    if (this.bindings) {
      // For Workers API, namespaces are created at deploy time
      // Return a mock response matching REST API shape
      return {
        id: title, // Use title as ID since that's what we need
        title: title,
        supports_url_encoding: true,
      };
    }
    return await this.client!.kv.namespaces.create({
      account_id: this.accountId!,
      title,
    });
  }

  private async getNamespaceIdByName(namespaceName: string): Promise<string | null> {
    try {
      const response = await this.listNamespaces();
      const namespace = response.result.find(ns => ns.title === namespaceName);
      return namespace ? namespace.id : null;
    } catch (error: any) {
      this.logger.error(`Failed to get namespace ID for ${namespaceName}:`, error);
      return null;
    }
  }

  private async createNamespace(namespaceName: string): Promise<string> {
    try {
      const response = await this.createNamespaceById(namespaceName);
      return response.id;
    } catch (error: any) {
      // Check if the error is because it already exists
      if (error.message && error.message.includes('already exists')) {
        // Try to get it again since we know it exists
        const namespaces = await this.listNamespaces();
        const namespace = namespaces.result.find(ns => ns.title === namespaceName);
        if (namespace) return namespace.id;
      }
      this.logger.error('Error creating namespace:', error);
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
    const prefix = this.namespacePrefix ? `${this.namespacePrefix}_` : '';

    try {
      if (tableName === TABLE_MESSAGES || tableName === TABLE_THREADS) {
        return await this.getOrCreateNamespaceId(`${prefix}mastra_threads`);
      } else if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
        return await this.getOrCreateNamespaceId(`${prefix}mastra_workflows`);
      } else {
        return await this.getOrCreateNamespaceId(`${prefix}mastra_evals`);
      }
    } catch (error: any) {
      this.logger.error('Error fetching namespace ID:', error);
      throw new Error(`Failed to fetch namespace ID for table ${tableName}: ${error.message}`);
    }
  }

  /**
   * Helper to safely serialize data for KV storage
   */
  private safeSerialize(data: any): string {
    return typeof data === 'string' ? data : JSON.stringify(data);
  }

  /**
   * Helper to safely parse data from KV storage
   */
  private safeParse(text: string): any {
    try {
      const data = JSON.parse(text);
      // If we got an object with a value property that's a string, try to parse that too
      if (data && typeof data === 'object' && 'value' in data && typeof data.value === 'string') {
        return this.safeParse(data.value);
      }
      return data;
    } catch {
      return text;
    }
  }

  private async putKV({
    tableName,
    key,
    value,
    metadata,
  }: {
    tableName: TABLE_NAMES;
    key: string;
    value: any;
    metadata?: any;
  }): Promise<void> {
    try {
      await this.putNamespaceValue({ tableName, key, value, metadata });
    } catch (error: any) {
      this.logger.error(`Failed to put KV value for ${tableName}:${key}:`, error);
      throw new Error(`Failed to put KV value: ${error.message}`);
    }
  }

  private async getKV(tableName: TABLE_NAMES, key: string): Promise<any> {
    try {
      const text = await this.getNamespaceValue(tableName, key);
      if (!text) return null;
      return this.safeParse(text);
    } catch (error: any) {
      this.logger.error(`Failed to get KV value for ${tableName}:${key}:`, error);
      throw new Error(`Failed to get KV value: ${error.message}`);
    }
  }

  private async deleteKV(tableName: TABLE_NAMES, key: string): Promise<void> {
    try {
      await this.deleteNamespaceValue(tableName, key);
    } catch (error: any) {
      this.logger.error(`Failed to delete KV value for ${tableName}:${key}:`, error);
      throw new Error(`Failed to delete KV value: ${error.message}`);
    }
  }

  private async listKV(tableName: TABLE_NAMES): Promise<Array<{ name: string }>> {
    try {
      return await this.listNamespaceKeys(tableName);
    } catch (error: any) {
      this.logger.error(`Failed to list KV for ${tableName}:`, error);
      throw new Error(`Failed to list KV: ${error.message}`);
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
      const arr = JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw));
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      this.logger.error(`Error parsing order data for key ${orderKey}:`, { e });
      return [];
    }
  }

  private async updateSorting(threadMessages: (MessageType & { _index?: number })[]) {
    // Sort messages by index or timestamp
    return threadMessages
      .map(msg => ({
        message: msg,
        // Use _index if available, otherwise timestamp, matching Upstash
        score: msg._index !== undefined ? msg._index : msg.createdAt.getTime(),
      }))
      .sort((a, b) => a.score - b.score)
      .map(item => ({
        id: item.message.id,
        score: item.score,
      }));
  }

  private async getIncludedMessagesWithContext(
    threadId: string,
    include: { id: string; withPreviousMessages?: number; withNextMessages?: number }[],
    messageIds: Set<string>,
  ): Promise<void> {
    const threadMessagesKey = this.getThreadMessagesKey(threadId);
    await Promise.all(
      include.map(async item => {
        messageIds.add(item.id);
        if (!item.withPreviousMessages && !item.withNextMessages) return;

        const rank = await this.getRank(TABLE_MESSAGES, threadMessagesKey, item.id);
        if (rank === null) return;

        if (item.withPreviousMessages) {
          const prevIds = await this.getRange(
            TABLE_MESSAGES,
            threadMessagesKey,
            Math.max(0, rank - item.withPreviousMessages),
            rank - 1,
          );
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
      }),
    );
  }

  private async getRecentMessages(threadId: string, limit: number, messageIds: Set<string>): Promise<void> {
    if (limit <= 0) return;

    try {
      const threadMessagesKey = this.getThreadMessagesKey(threadId);
      const latestIds = await this.getLastN(TABLE_MESSAGES, threadMessagesKey, limit);
      latestIds.forEach(id => messageIds.add(id));
    } catch (error) {
      console.log(`No message order found for thread ${threadId}, skipping latest messages`);
    }
  }

  private async fetchAndParseMessages(
    threadId: string,
    messageIds: string[],
  ): Promise<(MessageType & { _index?: number })[]> {
    const messages = await Promise.all(
      messageIds.map(async id => {
        try {
          const key = this.getMessageKey(threadId, id);
          const data = await this.getKV(TABLE_MESSAGES, key);
          if (!data) return null;
          return typeof data === 'string' ? JSON.parse(data) : data;
        } catch (error) {
          this.logger.error(`Error retrieving message ${id}:`, { error });
          return null;
        }
      }),
    );
    return messages.filter((msg): msg is MessageType & { _index?: number } => msg !== null);
  }

  private async updateSortedOrder(
    tableName: TABLE_NAMES,
    orderKey: string,
    newEntries: Array<{ id: string; score: number }>,
  ): Promise<void> {
    try {
      const currentOrder = await this.getSortedOrder(tableName, orderKey);

      // Create a map for faster lookups
      const orderMap = new Map(currentOrder.map(entry => [entry.id, entry]));

      // Update or add new entries
      for (const entry of newEntries) {
        orderMap.set(entry.id, entry);
      }

      // Convert back to array and sort
      const updatedOrder = Array.from(orderMap.values()).sort((a, b) => a.score - b.score);

      // Store sorted order
      await this.putKV({ tableName, key: orderKey, value: JSON.stringify(updatedOrder) });
    } catch (error) {
      this.logger.error(`Error updating sorted order for key ${orderKey}:`, { error });
      // Create a new sorted order if it doesn't exist
      await this.putKV({ tableName, key: orderKey, value: JSON.stringify(newEntries) });
    }
  }

  private async getRank(tableName: TABLE_NAMES, orderKey: string, id: string): Promise<number | null> {
    const order = await this.getSortedOrder(tableName, orderKey);
    const index = order.findIndex(item => item.id === id);
    return index >= 0 ? index : null;
  }

  private async getRange(tableName: TABLE_NAMES, orderKey: string, start: number, end: number): Promise<string[]> {
    const order = await this.getSortedOrder(tableName, orderKey);
    const actualStart = start < 0 ? Math.max(0, order.length + start) : start;
    const actualEnd = end < 0 ? order.length + end : Math.min(end, order.length - 1);
    const sliced = order.slice(actualStart, actualEnd + 1);
    return sliced.map(item => item.id);
  }

  private async getLastN(tableName: TABLE_NAMES, orderKey: string, n: number): Promise<string[]> {
    // Reuse getRange with negative indexing
    return this.getRange(tableName, orderKey, -n, -1);
  }

  private async getFullOrder(tableName: TABLE_NAMES, orderKey: string): Promise<string[]> {
    // Get the full range in ascending order (oldest to newest)
    return this.getRange(tableName, orderKey, 0, -1);
  }

  private getKey<T extends TABLE_NAMES>(tableName: T, record: Record<string, string>): string {
    // Add namespace prefix if configured
    const prefix = this.namespacePrefix ? `${this.namespacePrefix}:` : '';
    switch (tableName) {
      case TABLE_THREADS:
        if (!record.id) throw new Error('Thread ID is required');
        return `${prefix}${tableName}:${record.id}`;
      case TABLE_MESSAGES:
        if (!record.threadId || !record.id) throw new Error('Thread ID and Message ID are required');
        return `${prefix}${tableName}:${record.threadId}:${record.id}`;
      case TABLE_WORKFLOW_SNAPSHOT:
        if (!record.namespace || !record.workflow_name || !record.run_id) {
          throw new Error('Namespace, workflow name, and run ID are required');
        }
        return `${prefix}${tableName}:${record.namespace}:${record.workflow_name}:${record.run_id}`;
      default:
        throw new Error(`Unsupported table: ${tableName}`);
    }
  }

  private getSchemaKey(tableName: TABLE_NAMES): string {
    // Add namespace prefix if configured
    const prefix = this.namespacePrefix ? `${this.namespacePrefix}:` : '';
    return `${prefix}schema:${tableName}`;
  }

  private async getTableSchema(tableName: TABLE_NAMES): Promise<Record<string, StorageColumn> | null> {
    try {
      const schemaKey = this.getSchemaKey(tableName);
      return await this.getKV(tableName, schemaKey);
    } catch (error) {
      this.logger.error(`Failed to get schema for ${tableName}:`, { error });
      return null;
    }
  }

  private validateColumnValue(value: unknown, column: StorageColumn): boolean {
    if (value === undefined || value === null) {
      return column.nullable ?? false;
    }

    switch (column.type) {
      case 'text':
      case 'uuid':
        return typeof value === 'string';
      case 'integer':
      case 'bigint':
        return typeof value === 'number';
      case 'timestamp':
        return value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)));
      case 'jsonb':
        if (typeof value !== 'object') return false;
        try {
          JSON.stringify(value);
          return true;
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  private async validateAgainstSchema(
    record: Record<string, unknown>,
    schema: Record<string, StorageColumn>,
  ): Promise<void> {
    try {
      for (const [columnName, column] of Object.entries(schema)) {
        const value = record[columnName];

        // Check primary key presence
        if (column.primaryKey && (value === undefined || value === null)) {
          throw new Error(`Missing primary key value for column ${columnName}`);
        }

        if (!this.validateColumnValue(value, column)) {
          const valueType = value === null ? 'null' : typeof value;
          throw new Error(`Invalid value for column ${columnName}: expected ${column.type}, got ${valueType}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error validating record against schema:`, { error, record, schema });
      throw error;
    }
  }

  private async validateRecord<T extends TABLE_NAMES>(record: unknown, tableName: T): Promise<void> {
    try {
      if (!record || typeof record !== 'object') {
        throw new Error('Record must be an object');
      }

      const recordTyped = record as Record<string, unknown>;
      const schema = await this.getTableSchema(tableName);

      // If schema exists, validate against it
      if (schema) {
        await this.validateAgainstSchema(recordTyped, schema);
        return;
      }

      // Fallback validation if no schema found
      switch (tableName) {
        case TABLE_THREADS:
          if (!('id' in recordTyped) || !('resourceId' in recordTyped) || !('title' in recordTyped)) {
            throw new Error('Thread record missing required fields');
          }
          break;
        case TABLE_MESSAGES:
          if (
            !('id' in recordTyped) ||
            !('threadId' in recordTyped) ||
            !('content' in recordTyped) ||
            !('role' in recordTyped)
          ) {
            throw new Error('Message record missing required fields');
          }
          break;
        case TABLE_WORKFLOW_SNAPSHOT:
          if (!('namespace' in recordTyped) || !('workflowName' in recordTyped) || !('runId' in recordTyped)) {
            throw new Error('Workflow record missing required fields');
          }
          break;
        default:
          throw new Error(`Unknown table type: ${tableName}`);
      }
    } catch (error) {
      this.logger.error(`Failed to validate record for ${tableName}:`, { error, record });
      throw error;
    }
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

  private ensureMetadata(metadata: Record<string, unknown> | string | undefined): Record<string, unknown> | undefined {
    if (!metadata) return {};
    return typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
  }

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    try {
      const schemaKey = this.getSchemaKey(tableName);
      const metadata = {
        type: 'table_schema',
        tableName,
        createdAt: new Date().toISOString(),
      };
      await this.putKV({ tableName, key: schemaKey, value: schema, metadata });
    } catch (error: any) {
      this.logger.error(`Failed to store schema for ${tableName}:`, error);
      throw new Error(`Failed to store schema: ${error.message}`);
    }
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    const keys = await this.listKV(tableName);
    if (keys.length > 0) {
      await Promise.all(keys.map(keyObj => this.deleteKV(tableName, keyObj.name)));
    }
  }

  async insert<T extends TABLE_NAMES>({ tableName, record }: { tableName: T; record: RecordTypes[T] }): Promise<void> {
    try {
      const key = this.getKey(tableName, record);

      // Process dates and metadata
      const processedRecord = {
        ...record,
        createdAt: record.createdAt ? this.serializeDate(record.createdAt) : undefined,
        updatedAt: record.updatedAt ? this.serializeDate(record.updatedAt) : undefined,
        metadata: record.metadata ? JSON.stringify(record.metadata) : '',
      } as RecordTypes[T];

      // Validate record type
      this.validateRecord(processedRecord, tableName);
      await this.putKV({ tableName, key, value: processedRecord });
    } catch (error) {
      this.logger.error(`Failed to insert record for ${tableName}:`, { error });
      throw error;
    }
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    try {
      // Generate key using simplified approach
      const key = this.getKey(tableName, keys as Partial<RecordTypes[typeof tableName]>);

      // Get data from KV store
      const data = await this.getKV(tableName, key);
      if (!data) return null;

      // Handle dates and metadata
      const processed = {
        ...data,
        createdAt: this.ensureDate(data.createdAt),
        updatedAt: this.ensureDate(data.updatedAt),
        metadata: this.ensureMetadata(data.metadata),
      };

      return processed as R;
    } catch (error) {
      this.logger.error(`Failed to load data for ${tableName}:`, { error });
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
        metadata: this.ensureMetadata(thread.metadata),
      };
    } catch (error) {
      this.logger.error(`Error processing thread ${threadId}:`, { error });
      return null;
    }
  }

  async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
    try {
      const keyList = await this.listKV(TABLE_THREADS);
      const threads = await Promise.all(
        keyList.map(async keyObj => {
          try {
            const data = await this.getKV(TABLE_THREADS, keyObj.name);
            if (!data) return null;

            const thread = typeof data === 'string' ? JSON.parse(data) : data;
            if (!thread || !thread.resourceId || thread.resourceId !== resourceId) return null;

            return {
              ...thread,
              createdAt: this.ensureDate(thread.createdAt)!,
              updatedAt: this.ensureDate(thread.updatedAt)!,
              metadata: this.ensureMetadata(thread.metadata),
            };
          } catch (error) {
            this.logger.error(`Error processing thread from key ${keyObj.name}:`, { error });
            return null;
          }
        }),
      );
      return threads.filter((thread): thread is StorageThreadType => thread !== null);
    } catch (error) {
      this.logger.error(`Error getting threads for resourceId ${resourceId}:`, { error });
      return [];
    }
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    try {
      await this.insert({ tableName: TABLE_THREADS, record: thread });
      return thread;
    } catch (error) {
      this.logger.error('Error saving thread:', { error });
      throw error;
    }
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
    try {
      const thread = await this.getThreadById({ threadId: id });
      if (!thread) {
        throw new Error(`Thread ${id} not found`);
      }

      const updatedThread = {
        ...thread,
        title,
        metadata: this.ensureMetadata({
          ...(thread.metadata ?? {}),
          ...metadata,
        }),
        updatedAt: new Date(),
      };

      // Insert with proper metadata handling
      await this.insert({ tableName: TABLE_THREADS, record: updatedThread });
      return updatedThread;
    } catch (error) {
      this.logger.error(`Error updating thread ${id}:`, { error });
      throw error;
    }
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    try {
      // Verify thread exists
      const thread = await this.getThreadById({ threadId });
      if (!thread) {
        throw new Error(`Thread ${threadId} not found`);
      }

      // Get all message keys for this thread first
      const messageKeys = await this.listKV(TABLE_MESSAGES);
      const threadMessageKeys = messageKeys.filter(key => key.name.startsWith(`${TABLE_MESSAGES}:${threadId}:`));

      // Delete all messages and their order atomically
      await Promise.all([
        // Delete message order
        this.deleteKV(TABLE_MESSAGES, this.getThreadMessagesKey(threadId)),
        // Delete all messages
        ...threadMessageKeys.map(key => this.deleteKV(TABLE_MESSAGES, key.name)),
        // Delete thread
        this.deleteKV(TABLE_THREADS, this.getKey(TABLE_THREADS, { id: threadId })),
      ]);
    } catch (error) {
      this.logger.error(`Error deleting thread ${threadId}:`, { error });
      throw error;
    }
  }

  private getMessageKey(threadId: string, messageId: string): string {
    try {
      return this.getKey(TABLE_MESSAGES, { threadId, id: messageId });
    } catch (error) {
      this.logger.error(`Error getting message key for thread ${threadId} and message ${messageId}:`, { error });
      throw error;
    }
  }
  private getThreadMessagesKey(threadId: string): string {
    try {
      return this.getKey(TABLE_MESSAGES, { threadId, id: 'messages' });
    } catch (error) {
      this.logger.error(`Error getting thread messages key for thread ${threadId}:`, { error });
      throw error;
    }
  }

  async saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]> {
    if (!Array.isArray(messages) || messages.length === 0) return [];

    try {
      // Validate message structure and ensure dates
      const validatedMessages = messages.map((message, index) => {
        const errors: string[] = [];
        if (!message.id) errors.push('id is required');
        if (!message.threadId) errors.push('threadId is required');
        if (!message.content) errors.push('content is required');
        if (!message.role) errors.push('role is required');
        if (!message.createdAt) errors.push('createdAt is required');

        if (errors.length > 0) {
          throw new Error(`Invalid message at index ${index}: ${errors.join(', ')}`);
        }

        return {
          ...message,
          createdAt: this.ensureDate(message.createdAt)!,
          type: message.type || 'text',
          _index: index,
        };
      });

      // Group messages by thread for batch processing
      const messagesByThread = validatedMessages.reduce((acc, message) => {
        if (!acc.has(message.threadId)) {
          acc.set(message.threadId, []);
        }
        acc.get(message.threadId)!.push(message as MessageType & { _index?: number });
        return acc;
      }, new Map<string, (MessageType & { _index?: number })[]>());

      // Process each thread's messages
      await Promise.all(
        Array.from(messagesByThread.entries()).map(async ([threadId, threadMessages]) => {
          try {
            // Verify thread exists
            const thread = await this.getThreadById({ threadId });
            if (!thread) {
              throw new Error(`Thread ${threadId} not found`);
            }

            // Save messages with serialized dates
            await Promise.all(
              threadMessages.map(async message => {
                const key = await this.getMessageKey(threadId, message.id);
                // Strip _index and serialize dates before saving
                const { _index, ...cleanMessage } = message;
                const serializedMessage = {
                  ...cleanMessage,
                  createdAt: this.serializeDate(cleanMessage.createdAt),
                };
                await this.putKV({ tableName: TABLE_MESSAGES, key, value: serializedMessage });
              }),
            );

            // Update message order using _index or timestamps
            const orderKey = this.getThreadMessagesKey(threadId);
            const entries = await this.updateSorting(threadMessages);
            await this.updateSortedOrder(TABLE_MESSAGES, orderKey, entries);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`Error processing messages for thread ${threadId}: ${errorMessage}`);
            throw error;
          }
        }),
      );

      // Remove _index from returned messages
      return validatedMessages.map(({ _index, ...message }) => message as MessageType);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error saving messages: ${errorMessage}`);
      throw error;
    }
  }

  async getMessages<T extends MessageType = MessageType>({ threadId, selectBy }: StorageGetMessagesArg): Promise<T[]> {
    if (!threadId) throw new Error('threadId is required');

    // Handle selectBy.last type safely - it can be number or false
    let limit = 40; // Default limit
    if (typeof selectBy?.last === 'number') {
      limit = Math.max(0, selectBy.last);
    } else if (selectBy?.last === false) {
      limit = 0;
    }

    const messageIds = new Set<string>();
    if (limit === 0 && !selectBy?.include?.length) return [];

    try {
      // Get included messages and recent messages in parallel
      await Promise.all([
        selectBy?.include?.length
          ? this.getIncludedMessagesWithContext(threadId, selectBy.include, messageIds)
          : Promise.resolve(),
        limit > 0 && !selectBy?.include?.length
          ? this.getRecentMessages(threadId, limit, messageIds)
          : Promise.resolve(),
      ]);

      // Fetch and parse all messages
      const messages = await this.fetchAndParseMessages(threadId, Array.from(messageIds));
      if (!messages.length) return [];

      // Sort messages
      try {
        const threadMessagesKey = this.getThreadMessagesKey(threadId);
        const messageOrder = await this.getFullOrder(TABLE_MESSAGES, threadMessagesKey);
        const orderMap = new Map(messageOrder.map((id, index) => [id, index]));

        messages.sort((a, b) => {
          const indexA = orderMap.get(a.id);
          const indexB = orderMap.get(b.id);

          if (indexA !== undefined && indexB !== undefined) return orderMap.get(a.id)! - orderMap.get(b.id)!;
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Error sorting messages, falling back to creation time: ${errorMessage}`);
        messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      }

      // Remove _index and ensure dates before returning, just like Upstash
      return messages.map(({ _index, ...message }) => ({
        ...message,
        createdAt: this.ensureDate(message.createdAt)!,
      })) as T[];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error retrieving messages for thread ${threadId}: ${errorMessage}`);
      return [];
    }
  }

  private validateWorkflowParams(params: { namespace: string; workflowName: string; runId: string }): void {
    const { namespace, workflowName, runId } = params;
    if (!namespace || !workflowName || !runId) {
      throw new Error('Invalid workflow snapshot parameters');
    }
  }

  private validateWorkflowState(state: any): void {
    if (
      !state?.runId ||
      !state?.value ||
      !state?.context?.steps ||
      !state?.context?.triggerData ||
      !state?.context?.attempts ||
      !state?.activePaths
    ) {
      throw new Error('Invalid workflow state structure');
    }
  }

  private normalizeSteps(steps: Record<string, any>): Record<
    string,
    {
      status: 'success' | 'waiting' | 'suspended' | 'skipped' | 'failed';
      payload?: any;
      error?: string;
    }
  > {
    const normalizedSteps: Record<
      string,
      {
        status: 'success' | 'waiting' | 'suspended' | 'skipped' | 'failed';
        payload?: any;
        error?: string;
      }
    > = {};

    for (const [stepId, step] of Object.entries(steps)) {
      normalizedSteps[stepId] = {
        status: step.status as 'success' | 'waiting' | 'suspended' | 'skipped' | 'failed',
        payload: step.payload || step.result,
        error: step.error,
      };
    }

    return normalizedSteps;
  }

  private normalizeWorkflowState(data: any): WorkflowRunState {
    const steps = data.context?.stepResults || data.context?.steps || {};
    return {
      runId: data.runId,
      value: data.value,
      context: {
        steps: this.normalizeSteps(steps),
        triggerData: data.context?.triggerData || {},
        attempts: data.context?.attempts || {},
      },
      activePaths: data.activePaths || [],
      timestamp: data.timestamp || Date.now(),
    };
  }

  async persistWorkflowSnapshot(params: {
    namespace: string;
    workflowName: string;
    runId: string;
    snapshot: WorkflowRunState;
  }): Promise<void> {
    try {
      this.validateWorkflowParams(params);
      const { namespace, workflowName, runId, snapshot } = params;

      const normalizedState = this.normalizeWorkflowState(snapshot);
      this.validateWorkflowState(normalizedState);

      const key = this.getKey(TABLE_WORKFLOW_SNAPSHOT, { namespace, workflow_name: workflowName, run_id: runId });
      await this.putKV({ tableName: TABLE_WORKFLOW_SNAPSHOT, key, value: normalizedState });
    } catch (error) {
      this.logger.error('Error persisting workflow snapshot:', { error });
      throw error;
    }
  }

  async loadWorkflowSnapshot(params: {
    namespace: string;
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    try {
      this.validateWorkflowParams(params);
      const { namespace, workflowName, runId } = params;

      const key = this.getKey(TABLE_WORKFLOW_SNAPSHOT, { namespace, workflow_name: workflowName, run_id: runId });
      const data = await this.getKV(TABLE_WORKFLOW_SNAPSHOT, key);
      if (!data) return null;

      const state = this.normalizeWorkflowState(data);
      this.validateWorkflowState(state);
      return state;
    } catch (error) {
      this.logger.error('Error loading workflow snapshot:', { error });
      return null;
    }
  }

  async batchInsert<T extends TABLE_NAMES>(input: { tableName: T; records: Partial<RecordTypes[T]>[] }): Promise<void> {
    if (!input.records || input.records.length === 0) return;

    try {
      await Promise.all(
        input.records.map(async record => {
          // Generate key using simplified approach
          const key = this.getKey(input.tableName, record as Record<string, string>);

          // Process dates and metadata
          const processedRecord = {
            ...record,
            createdAt: record.createdAt ? this.serializeDate(record.createdAt as Date) : undefined,
            updatedAt: record.updatedAt ? this.serializeDate(record.updatedAt as Date) : undefined,
            metadata: record.metadata ? JSON.stringify(record.metadata) : undefined,
          } as RecordTypes[T];

          await this.putKV({ tableName: input.tableName, key, value: processedRecord });
        }),
      );
    } catch (error) {
      this.logger.error('Error in batch insert:', { error });
      throw error;
    }
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
