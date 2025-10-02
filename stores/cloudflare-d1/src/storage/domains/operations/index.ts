import type { D1Database } from '@cloudflare/workers-types';
import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import { StoreOperations, TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import type { TABLE_NAMES, StorageColumn } from '@mastra/core/storage';
import type Cloudflare from 'cloudflare';
import { createSqlBuilder } from '../../sql-builder';
import type { SqlParam, SqlQueryOptions } from '../../sql-builder';
import { deserializeValue } from '../utils';

export type D1QueryResult = Awaited<ReturnType<Cloudflare['d1']['database']['query']>>['result'];

export interface D1Client {
  query(args: { sql: string; params: string[] }): Promise<{ result: D1QueryResult }>;
}

export interface StoreOperationsD1Config {
  client?: D1Client;
  binding?: D1Database;
  tablePrefix?: string;
}

export class StoreOperationsD1 extends StoreOperations {
  private client?: D1Client;
  private binding?: D1Database;
  private tablePrefix: string;

  constructor(config: StoreOperationsD1Config) {
    super();
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
          id: 'CLOUDFLARE_D1_STORE_OPERATIONS_WORKERS_BINDING_QUERY_FAILED',
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
          id: 'CLOUDFLARE_D1_STORE_OPERATIONS_REST_QUERY_FAILED',
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
      default:
        return super.getSqlType(type);
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
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORE_OPERATIONS_CREATE_TABLE_FAILED',
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
          id: 'CLOUDFLARE_D1_STORE_OPERATIONS_CLEAR_TABLE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      const fullTableName = this.getTableName(tableName);
      const sql = `DROP TABLE IF EXISTS ${fullTableName}`;
      await this.executeQuery({ sql });
      this.logger.debug(`Dropped table ${fullTableName}`);
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORE_OPERATIONS_DROP_TABLE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async alterTable(args: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void> {
    try {
      const fullTableName = this.getTableName(args.tableName);
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
          id: 'CLOUDFLARE_D1_STORE_OPERATIONS_ALTER_TABLE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName: args.tableName },
        },
        error,
      );
    }
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    try {
      const fullTableName = this.getTableName(tableName);
      const processedRecord = await this.processRecord(record);
      const columns = Object.keys(processedRecord);
      const values = Object.values(processedRecord);

      const query = createSqlBuilder().insert(fullTableName, columns, values);
      const { sql, params } = query.build();

      await this.executeQuery({ sql, params });
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORE_OPERATIONS_INSERT_FAILED',
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
      const columns = Object.keys(processedRecords[0] || {});

      // For batch insert, we need to create multiple INSERT statements
      for (const record of processedRecords) {
        const values = Object.values(record);
        const query = createSqlBuilder().insert(fullTableName, columns, values);
        const { sql, params } = query.build();
        await this.executeQuery({ sql, params });
      }
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORE_OPERATIONS_BATCH_INSERT_FAILED',
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
          id: 'CLOUDFLARE_D1_STORE_OPERATIONS_LOAD_FAILED',
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

        // For bulk insert, we need to determine the columns from the first record
        if (recordsToInsert.length > 0) {
          const firstRecord = recordsToInsert[0];
          // Ensure firstRecord is not undefined before calling Object.keys
          const columns = Object.keys(firstRecord || {});

          // Create a bulk insert statement
          for (const record of recordsToInsert) {
            // Use type-safe approach to extract values
            const values = columns.map(col => {
              if (!record) return null;
              // Safely access the record properties
              const value = typeof col === 'string' ? record[col as keyof typeof record] : null;
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
          id: 'CLOUDFLARE_D1_STORAGE_BATCH_UPSERT_ERROR',
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
