import type { KVNamespace } from '@cloudflare/workers-types';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  ensureDate,
  serializeDate,
  StoreOperations,
  TABLE_EVALS,
  TABLE_MESSAGES,
  TABLE_SCORERS,
  TABLE_THREADS,
  TABLE_TRACES,
  TABLE_WORKFLOW_SNAPSHOT,
} from '@mastra/core/storage';
import type { StorageColumn, TABLE_NAMES } from '@mastra/core/storage';
import type Cloudflare from 'cloudflare';
import type { ListOptions, RecordTypes } from '../../types';

export class StoreOperationsCloudflare extends StoreOperations {
  private bindings?: Record<TABLE_NAMES, KVNamespace>;
  client?: Cloudflare;
  accountId?: string;
  namespacePrefix: string;
  constructor({
    namespacePrefix,
    bindings,
    client,
    accountId,
  }: {
    bindings?: Record<TABLE_NAMES, KVNamespace>;
    namespacePrefix: string;
    client?: Cloudflare;
    accountId?: string;
  }) {
    super();
    this.bindings = bindings;
    this.namespacePrefix = namespacePrefix;
    this.client = client;
    this.accountId = accountId;
  }

  async hasColumn() {
    return true;
  }

  async alterTable(_args: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void> {
    // Nothing to do here, Cloudflare KV is schemaless
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      const keys = await this.listKV(tableName);
      if (keys.length > 0) {
        await Promise.all(keys.map(keyObj => this.deleteKV(tableName, keyObj.name)));
      }
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_CLEAR_TABLE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
          },
        },
        error,
      );

      throw error;
    }
  }

  async dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      const keys = await this.listKV(tableName);
      if (keys.length > 0) {
        await Promise.all(keys.map(keyObj => this.deleteKV(tableName, keyObj.name)));
      }
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_DROP_TABLE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
          },
        },
        error,
      );

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

  getKey<T extends TABLE_NAMES>(tableName: T, record: Record<string, string>): string {
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
        if (!record.workflow_name || !record.run_id) {
          throw new Error('Workflow name, and run ID are required');
        }
        let key = `${prefix}${tableName}:${record.workflow_name}:${record.run_id}`;
        if (record.resourceId) {
          key = `${key}:${record.resourceId}`;
        }
        return key;
      case TABLE_TRACES:
        if (!record.id) throw new Error('Trace ID is required');
        return `${prefix}${tableName}:${record.id}`;
      case TABLE_EVALS:
        const evalId = record.id || record.run_id;
        if (!evalId) throw new Error('Eval ID or run_id is required');
        return `${prefix}${tableName}:${evalId}`;
      case TABLE_SCORERS:
        if (!record.id) throw new Error('Score ID is required');
        return `${prefix}${tableName}:${record.id}`;
      default:
        throw new Error(`Unsupported table: ${tableName}`);
    }
  }

  private getSchemaKey(tableName: TABLE_NAMES): string {
    // Add namespace prefix if configured
    const prefix = this.namespacePrefix ? `${this.namespacePrefix}:` : '';
    return `${prefix}schema:${tableName}`;
  }

  /**
   * Helper to safely parse data from KV storage
   */
  private safeParse(text: string | null): any {
    if (!text) return null;
    try {
      const data = JSON.parse(text);
      // If we got an object with a value property that's a string, try to parse that too
      if (data && typeof data === 'object' && 'value' in data) {
        if (typeof data.value === 'string') {
          try {
            return JSON.parse(data.value);
          } catch {
            // If value is a string but not JSON, return as is
            return data.value;
          }
        }
        return null;
      }
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to parse text:', { message, text });
      return null;
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

    let allNamespaces: Array<Cloudflare.KV.Namespace> = [];
    let currentPage = 1;
    const perPage = 50; // Using 50, max is 100 for namespaces.list
    let morePagesExist = true;

    while (morePagesExist) {
      const response = await this.client!.kv.namespaces.list({
        account_id: this.accountId!,
        page: currentPage,
        per_page: perPage,
      });

      if (response.result) {
        allNamespaces = allNamespaces.concat(response.result);
      }

      morePagesExist = response.result ? response.result.length === perPage : false;

      if (morePagesExist) {
        currentPage++;
      }
    }
    return { result: allNamespaces };
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
      return await this.getOrCreateNamespaceId(`${prefix}${tableName}`);
    } catch (error: any) {
      this.logger.error('Error fetching namespace ID:', error);
      throw new Error(`Failed to fetch namespace ID for table ${tableName}: ${error.message}`);
    }
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
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get value for ${tableName} ${key}:`, { message });
      throw error;
    }
  }

  async getKV(tableName: TABLE_NAMES, key: string): Promise<any> {
    try {
      const text = await this.getNamespaceValue(tableName, key);
      return this.safeParse(text);
    } catch (error: any) {
      this.logger.error(`Failed to get KV value for ${tableName}:${key}:`, error);
      throw new Error(`Failed to get KV value: ${error.message}`);
    }
  }

  private async getTableSchema(tableName: TABLE_NAMES): Promise<Record<string, StorageColumn> | null> {
    try {
      const schemaKey = this.getSchemaKey(tableName);
      return await this.getKV(tableName, schemaKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get schema for ${tableName}:`, { message });
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
      if (!schema || typeof schema !== 'object' || schema.value === null) {
        throw new Error('Invalid schema format');
      }
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
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error validating record against schema:`, { message, record, schema });
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
          if (!('workflow_name' in recordTyped) || !('run_id' in recordTyped)) {
            throw new Error('Workflow record missing required fields');
          }
          break;
        case TABLE_TRACES:
          if (!('id' in recordTyped)) {
            throw new Error('Trace record missing required fields');
          }
          break;
        case TABLE_EVALS:
          if (!('agent_name' in recordTyped) || !('run_id' in recordTyped)) {
            throw new Error('Eval record missing required fields');
          }
          break;
        case TABLE_SCORERS:
          if (!('id' in recordTyped) || !('scorerId' in recordTyped)) {
            throw new Error('Score record missing required fields');
          }
          break;
        default:
          throw new Error(`Unknown table type: ${tableName}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to validate record for ${tableName}:`, { message, record });
      throw error;
    }
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    try {
      const key = this.getKey(tableName, record);

      // Process dates and metadata
      const processedRecord = {
        ...record,
        createdAt: record.createdAt ? serializeDate(record.createdAt) : undefined,
        updatedAt: record.updatedAt ? serializeDate(record.updatedAt) : undefined,
        metadata: record.metadata ? JSON.stringify(record.metadata) : '',
      } as RecordTypes[TABLE_NAMES];

      // Validate record type
      await this.validateRecord(processedRecord, tableName);
      await this.putKV({ tableName, key, value: processedRecord });
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_INSERT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
          },
        },
        error,
      );
    }
  }

  private ensureMetadata(metadata: Record<string, unknown> | string | undefined): Record<string, unknown> | undefined {
    if (!metadata) return {};
    return typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
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
        createdAt: ensureDate(data.createdAt),
        updatedAt: ensureDate(data.updatedAt),
        metadata: this.ensureMetadata(data.metadata),
      };

      return processed as R;
    } catch (error: any) {
      const mastraError = new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_LOAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
          },
        },
        error,
      );
      this.logger?.trackException(mastraError);
      this.logger?.error(mastraError.toString());
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
            createdAt: record.createdAt ? serializeDate(record.createdAt as Date) : undefined,
            updatedAt: record.updatedAt ? serializeDate(record.updatedAt as Date) : undefined,
            metadata: record.metadata ? JSON.stringify(record.metadata) : undefined,
          } as RecordTypes[T];

          await this.putKV({ tableName: input.tableName, key, value: processedRecord });
        }),
      );
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_BATCH_INSERT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Error in batch insert for table ${input.tableName}`,
          details: {
            tableName: input.tableName,
          },
        },
        error,
      );
    }
  }

  /**
   * Helper to safely serialize data for KV storage
   */
  private safeSerialize(data: any): string {
    return typeof data === 'string' ? data : JSON.stringify(data);
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
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to put value for ${tableName} ${key}:`, { message });
      throw error;
    }
  }

  async putKV({
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
      throw new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_CREATE_TABLE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
          },
        },
        error,
      );

      throw error;
    }
  }

  async listNamespaceKeys(tableName: TABLE_NAMES, options?: ListOptions) {
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
      throw new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_LIST_NAMESPACE_KEYS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
          },
        },
        error,
      );

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

  async deleteKV(tableName: TABLE_NAMES, key: string): Promise<void> {
    try {
      await this.deleteNamespaceValue(tableName, key);
    } catch (error: any) {
      this.logger.error(`Failed to delete KV value for ${tableName}:${key}:`, error);
      throw new Error(`Failed to delete KV value: ${error.message}`);
    }
  }

  async listKV(tableName: TABLE_NAMES, options?: ListOptions): Promise<Array<{ name: string }>> {
    try {
      return await this.listNamespaceKeys(tableName, options);
    } catch (error: any) {
      this.logger.error(`Failed to list KV for ${tableName}:`, error);
      throw new Error(`Failed to list KV: ${error.message}`);
    }
  }
}
