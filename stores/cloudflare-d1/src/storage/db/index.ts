import type { D1Database } from '@cloudflare/workers-types';
import { MastraBase } from '@mastra/core/base';
import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import { createStorageErrorId, getDefaultValue, getSqlType, TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import type { TABLE_NAMES, StorageColumn } from '@mastra/core/storage';
import Cloudflare from 'cloudflare';
import { deserializeValue } from '../domains/utils';
import { createSqlBuilder } from '../sql-builder';
import type { SqlParam, SqlQueryOptions } from '../sql-builder';

export type D1QueryResult = Awaited<ReturnType<Cloudflare['d1']['database']['query']>>['result'];

export interface D1Client {
  query(args: { sql: string; params: string[] }): Promise<{ result: D1QueryResult }>;
}

export interface D1DBConfig {
  client?: D1Client;
  binding?: D1Database;
  tablePrefix?: string;
}

/**
 * Configuration for standalone domain usage.
 * Accepts either:
 * 1. An existing D1 client or binding
 * 2. Config to create a new client internally
 */
export type D1DomainConfig = D1DomainClientConfig | D1DomainBindingConfig | D1DomainRestConfig;

/**
 * Pass an existing D1 client (REST API)
 */
export interface D1DomainClientConfig {
  client: D1Client;
  tablePrefix?: string;
}

/**
 * Pass an existing D1 binding (Workers API)
 */
export interface D1DomainBindingConfig {
  binding: D1Database;
  tablePrefix?: string;
}

/**
 * Pass config to create a new D1 client internally (REST API)
 */
export interface D1DomainRestConfig {
  accountId: string;
  apiToken: string;
  databaseId: string;
  tablePrefix?: string;
}

/**
 * Resolves D1DomainConfig to D1DBConfig.
 * Handles creating a new D1 client if apiToken is provided.
 */
export function resolveD1Config(config: D1DomainConfig): D1DBConfig {
  // Existing client
  if ('client' in config) {
    return {
      client: config.client,
      tablePrefix: config.tablePrefix,
    };
  }

  // Existing binding
  if ('binding' in config) {
    return {
      binding: config.binding,
      tablePrefix: config.tablePrefix,
    };
  }

  // Config to create new client (REST API)
  const cfClient = new Cloudflare({ apiToken: config.apiToken });
  return {
    client: {
      query: ({ sql, params }) => {
        return cfClient.d1.database.query(config.databaseId, {
          account_id: config.accountId,
          sql,
          params,
        });
      },
    },
    tablePrefix: config.tablePrefix,
  };
}

export class D1DB extends MastraBase {
  private client?: D1Client;
  private binding?: D1Database;
  private tablePrefix: string;

  /** Cache of actual table columns: tableName -> Promise<Set<columnName>> (stores in-flight promise to coalesce concurrent calls) */
  private tableColumnsCache = new Map<string, Promise<Set<string>>>();

  constructor(config: D1DBConfig) {
    super({
      component: 'STORAGE',
      name: 'D1_DB',
    });
    this.client = config.client;
    this.binding = config.binding;
    this.tablePrefix = config.tablePrefix || '';
  }

  async hasColumn(table: string, column: string): Promise<boolean> {
    // For D1/SQLite, use PRAGMA table_info to get column info
    // Handle both prefixed and non-prefixed table names
    const fullTableName = table.startsWith(this.tablePrefix) ? table : `${this.tablePrefix}${table}`;
    const sql = `PRAGMA table_info(${fullTableName});`;
    const result = await this.executeQuery({ sql, params: [] });
    if (!result || !Array.isArray(result)) return false;
    return result.some((col: any) => col.name === column || col.name === column.toLowerCase());
  }

  getTableName(tableName: TABLE_NAMES): string {
    return `${this.tablePrefix}${tableName}`;
  }

  private formatSqlParams(params: SqlParam[]): string[] {
    return params.map(p => (p === undefined || p === null ? null : p) as string);
  }

  private async executeWorkersBindingQuery({
    sql,
    params = [],
    first = false,
  }: SqlQueryOptions): Promise<Record<string, any>[] | Record<string, any> | null> {
    if (!this.binding) {
      throw new Error('Workers binding is not configured');
    }

    try {
      const statement = this.binding.prepare(sql);
      const formattedParams = this.formatSqlParams(params);

      let result;
      if (formattedParams.length > 0) {
        if (first) {
          result = await statement.bind(...formattedParams).first();
          if (!result) return null;
          return result;
        } else {
          result = await statement.bind(...formattedParams).all();
          const results = result.results || [];
          return results;
        }
      } else {
        if (first) {
          result = await statement.first();
          if (!result) return null;
          return result;
        } else {
          result = await statement.all();
          const results = result.results || [];
          return results;
        }
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_D1', 'WORKERS_BINDING_QUERY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { sql },
        },
        error,
      );
    }
  }

  private async executeRestQuery({
    sql,
    params = [],
    first = false,
  }: SqlQueryOptions): Promise<Record<string, any>[] | Record<string, any> | null> {
    if (!this.client) {
      throw new Error('D1 client is not configured');
    }

    try {
      const formattedParams = this.formatSqlParams(params);
      const response = await this.client.query({
        sql,
        params: formattedParams,
      });
      const result = response.result || [];
      const results = result.flatMap(r => r.results || []);

      if (first) {
        return results[0] || null;
      }

      return results;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_D1', 'REST_QUERY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { sql },
        },
        error,
      );
    }
  }

  async executeQuery(options: SqlQueryOptions): Promise<Record<string, any>[] | Record<string, any> | null> {
    if (this.binding) {
      return this.executeWorkersBindingQuery(options);
    } else if (this.client) {
      return this.executeRestQuery(options);
    } else {
      throw new Error('Neither binding nor client is configured');
    }
  }

  /**
   * Gets the set of column names that actually exist in the database table.
   * Results are cached; the cache is invalidated when alterTable() adds new columns.
   */
  private async getKnownColumnNames(tableName: string): Promise<Set<string>> {
    const cached = this.tableColumnsCache.get(tableName);
    if (cached) return cached;

    // Store the in-flight promise so concurrent callers (e.g. Promise.all in batch ops) await the same query
    const promise = this.getTableColumns(tableName).then(columns => {
      const names = new Set(columns.map(c => c.name));
      // If the query returned no columns, remove the cached promise so we retry next time
      if (names.size === 0) {
        this.tableColumnsCache.delete(tableName);
      }
      return names;
    });
    this.tableColumnsCache.set(tableName, promise);

    return promise;
  }

  /**
   * Filters a record to only include columns that exist in the actual database table.
   * Unknown columns are silently dropped to ensure forward compatibility.
   */
  private async filterRecordToKnownColumns(
    tableName: string,
    record: Record<string, any>,
  ): Promise<Record<string, any>> {
    const knownColumns = await this.getKnownColumnNames(tableName);
    if (knownColumns.size === 0) return record;

    const filtered: Record<string, any> = {};
    for (const [key, value] of Object.entries(record)) {
      if (knownColumns.has(key)) {
        filtered[key] = value;
      }
    }
    return filtered;
  }

  private async getTableColumns(tableName: string): Promise<{ name: string; type: string }[]> {
    try {
      const sql = `PRAGMA table_info(${tableName})`;
      const result = await this.executeQuery({ sql });

      if (!result || !Array.isArray(result)) {
        return [];
      }

      return result.map(row => ({
        name: row.name as string,
        type: row.type as string,
      }));
    } catch (error) {
      this.logger.warn(`Failed to get table columns for ${tableName}:`, error);
      return [];
    }
  }

  private serializeValue(value: any): any {
    if (value === null || value === undefined) {
      return null;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return value;
  }

  protected getSqlType(type: StorageColumn['type']): string {
    switch (type) {
      case 'bigint':
        return 'INTEGER'; // SQLite uses INTEGER for all integer sizes
      case 'jsonb':
        return 'TEXT'; // Store JSON as TEXT in SQLite
      case 'boolean':
        return 'INTEGER'; // SQLite uses 0/1 for booleans
      default:
        return getSqlType(type);
    }
  }

  protected getDefaultValue(type: StorageColumn['type']): string {
    return getDefaultValue(type);
  }

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    try {
      const fullTableName = this.getTableName(tableName);

      // Build SQL columns from schema
      const columnDefinitions = Object.entries(schema).map(([colName, colDef]) => {
        const type = this.getSqlType(colDef.type);
        const nullable = colDef.nullable === false ? 'NOT NULL' : '';
        const primaryKey = colDef.primaryKey ? 'PRIMARY KEY' : '';
        return `${colName} ${type} ${nullable} ${primaryKey}`.trim();
      });

      // Add table-level constraints if needed
      const tableConstraints: string[] = [];
      if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
        tableConstraints.push('UNIQUE (workflow_name, run_id)');
      }

      const query = createSqlBuilder().createTable(fullTableName, columnDefinitions, tableConstraints);
      const { sql, params } = query.build();
      await this.executeQuery({ sql, params });
      this.logger.debug(`Created table ${fullTableName}`);
      this.tableColumnsCache.delete(fullTableName);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_D1', 'CREATE_TABLE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      const fullTableName = this.getTableName(tableName);
      const query = createSqlBuilder().delete(fullTableName);
      const { sql, params } = query.build();
      await this.executeQuery({ sql, params });
      this.logger.debug(`Cleared table ${fullTableName}`);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_D1', 'CLEAR_TABLE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    const fullTableName = this.getTableName(tableName);
    try {
      const sql = `DROP TABLE IF EXISTS ${fullTableName}`;
      await this.executeQuery({ sql });
      this.logger.debug(`Dropped table ${fullTableName}`);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_D1', 'DROP_TABLE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    } finally {
      this.tableColumnsCache.delete(fullTableName);
    }
  }

  async alterTable(args: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void> {
    const fullTableName = this.getTableName(args.tableName);

    try {
      const existingColumns = await this.getTableColumns(fullTableName);
      const existingColumnNames = new Set(existingColumns.map(col => col.name));

      for (const [columnName, column] of Object.entries(args.schema)) {
        if (!existingColumnNames.has(columnName) && args.ifNotExists.includes(columnName)) {
          const sqlType = this.getSqlType(column.type);
          const defaultValue = this.getDefaultValue(column.type);
          const sql = `ALTER TABLE ${fullTableName} ADD COLUMN ${columnName} ${sqlType} ${defaultValue}`;
          await this.executeQuery({ sql });
          this.logger.debug(`Added column ${columnName} to table ${fullTableName}`);
        }
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_D1', 'ALTER_TABLE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName: args.tableName },
        },
        error,
      );
    } finally {
      // Invalidate cached columns after DDL completes so concurrent writers see the new schema
      this.tableColumnsCache.delete(fullTableName);
    }
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    try {
      const fullTableName = this.getTableName(tableName);
      const processedRecord = await this.processRecord(record);
      // Filter out columns that don't exist in the actual database table
      const filteredRecord = await this.filterRecordToKnownColumns(fullTableName, processedRecord);
      const columns = Object.keys(filteredRecord);
      if (columns.length === 0) return; // No known columns after filtering - skip insert
      const values = Object.values(filteredRecord);

      const query = createSqlBuilder().insert(fullTableName, columns, values);
      const { sql, params } = query.build();

      await this.executeQuery({ sql, params });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_D1', 'INSERT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    try {
      if (records.length === 0) return;

      const fullTableName = this.getTableName(tableName);
      const processedRecords = await Promise.all(records.map(record => this.processRecord(record)));
      // Filter out columns that don't exist in the actual database table
      const filteredRecords = await Promise.all(
        processedRecords.map(r => this.filterRecordToKnownColumns(fullTableName, r)),
      );

      // For batch insert, we need to create multiple INSERT statements
      // Derive columns per-record and skip empty records
      for (const record of filteredRecords) {
        const columns = Object.keys(record);
        if (columns.length === 0) continue; // Skip records with no known columns
        const values = Object.values(record);
        const query = createSqlBuilder().insert(fullTableName, columns, values);
        const { sql, params } = query.build();
        await this.executeQuery({ sql, params });
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_D1', 'BATCH_INSERT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    try {
      const fullTableName = this.getTableName(tableName);
      const query = createSqlBuilder().select('*').from(fullTableName);

      // Add WHERE conditions for each key
      let firstKey = true;
      for (const [key, value] of Object.entries(keys)) {
        if (firstKey) {
          query.where(`${key} = ?`, value);
          firstKey = false;
        } else {
          query.andWhere(`${key} = ?`, value);
        }
      }

      query.orderBy('createdAt', 'DESC');

      query.limit(1);
      const { sql, params } = query.build();

      const result = await this.executeQuery({ sql, params, first: true });

      if (!result) {
        return null;
      }

      // Deserialize JSON fields
      const deserializedResult: Record<string, any> = {};
      for (const [key, value] of Object.entries(result)) {
        deserializedResult[key] = deserializeValue(value);
      }

      return deserializedResult as R;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_D1', 'LOAD', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async processRecord(record: Record<string, any>): Promise<Record<string, any>> {
    const processed: Record<string, any> = {};
    for (const [key, value] of Object.entries(record)) {
      processed[key] = this.serializeValue(value);
    }
    return processed;
  }

  /**
   * Upsert multiple records in a batch operation
   * @param tableName The table to insert into
   * @param records The records to insert
   */
  async batchUpsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    if (records.length === 0) return;

    const fullTableName = this.getTableName(tableName);

    try {
      // Process records in batches for better performance
      const batchSize = 50; // Adjust based on performance testing

      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);

        const recordsToInsert = batch;

        // Filter out columns that don't exist in the actual database table
        if (recordsToInsert.length > 0) {
          const filteredRecords = await Promise.all(
            recordsToInsert.map(r => this.filterRecordToKnownColumns(fullTableName, r || {})),
          );

          // Create a bulk insert statement - derive columns per-record and skip empties
          for (const record of filteredRecords) {
            const columns = Object.keys(record);
            if (columns.length === 0) continue; // Skip records with no known columns

            const values = columns.map(col => {
              const value = record[col];
              return this.serializeValue(value);
            });

            const recordToUpsert = columns.reduce(
              (acc, col) => {
                if (col !== 'createdAt') acc[col] = `excluded.${col}`;
                return acc;
              },
              {} as Record<string, any>,
            );

            const query = createSqlBuilder().insert(fullTableName, columns, values, ['id'], recordToUpsert);

            const { sql, params } = query.build();
            await this.executeQuery({ sql, params });
          }
        }

        this.logger.debug(
          `Processed batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(records.length / batchSize)}`,
        );
      }

      this.logger.debug(`Successfully batch upserted ${records.length} records into ${tableName}`);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_D1', 'BATCH_UPSERT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to batch upsert into ${tableName}: ${error instanceof Error ? error.message : String(error)}`,
          details: { tableName },
        },
        error,
      );
    }
  }
}
