import type { SqlStorage } from '@cloudflare/workers-types';
import { MastraBase } from '@mastra/core/base';
import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import { createStorageErrorId, getDefaultValue, getSqlType, TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import type { TABLE_NAMES, StorageColumn } from '@mastra/core/storage';

import { deserializeValue } from '../domains/utils';
import { createSqlBuilder } from '../sql-builder';
import type { SqlParam, SqlQueryOptions } from '../sql-builder';

export interface DODBConfig {
  sql: SqlStorage;
  tablePrefix?: string;
}

/**
 * Configuration for standalone domain usage with Durable Objects.
 */
export interface DODomainConfig {
  sql: SqlStorage;
  tablePrefix?: string;
}

export class DODB extends MastraBase {
  private sql: SqlStorage;
  private tablePrefix: string;

  constructor(config: DODBConfig) {
    super({
      component: 'STORAGE',
      name: 'DO_DB',
    });
    this.sql = config.sql;
    this.tablePrefix = config.tablePrefix || '';
  }

  async hasColumn(table: string, column: string): Promise<boolean> {
    // Handle both prefixed and non-prefixed table names
    const fullTableName = table.startsWith(this.tablePrefix) ? table : `${this.tablePrefix}${table}`;
    const sql = `PRAGMA table_info(${fullTableName});`;
    const result = await this.executeQuery({ sql, params: [] });
    if (!result || !Array.isArray(result)) return false;
    return result.some((col: Record<string, unknown>) => col.name === column || col.name === column.toLowerCase());
  }

  getTableName(tableName: TABLE_NAMES): string {
    return `${this.tablePrefix}${tableName}`;
  }

  private formatSqlParams(params: SqlParam[]): (string | number | null)[] {
    return params.map(p => (p === undefined || p === null ? null : p) as string | number | null);
  }

  /**
   * Execute a SQL query using Durable Objects SqlStorage.
   * SqlStorage.exec() is synchronous but we wrap in Promise for interface compatibility.
   */
  async executeQuery(options: SqlQueryOptions): Promise<Record<string, unknown>[] | Record<string, unknown> | null> {
    const { sql, params = [], first = false } = options;

    try {
      const formattedParams = this.formatSqlParams(params);
      // SqlStorage.exec() is synchronous and returns a SqlStorageCursor
      const cursor = this.sql.exec(sql, ...formattedParams);

      if (first) {
        const rows = cursor.toArray();
        return rows[0] || null;
      }

      return cursor.toArray();
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_DO', 'QUERY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { sql },
        },
        error,
      );
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

  private serializeValue(value: unknown): unknown {
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
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_DO', 'CREATE_TABLE', 'FAILED'),
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
          id: createStorageErrorId('CLOUDFLARE_DO', 'CLEAR_TABLE', 'FAILED'),
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
          id: createStorageErrorId('CLOUDFLARE_DO', 'DROP_TABLE', 'FAILED'),
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
          id: createStorageErrorId('CLOUDFLARE_DO', 'ALTER_TABLE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName: args.tableName },
        },
        error,
      );
    }
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, unknown> }): Promise<void> {
    try {
      const fullTableName = this.getTableName(tableName);
      const processedRecord = await this.processRecord(record);
      const columns = Object.keys(processedRecord);
      const values = Object.values(processedRecord);

      const query = createSqlBuilder().insert(fullTableName, columns, values as SqlParam[]);
      const { sql, params } = query.build();

      await this.executeQuery({ sql, params });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_DO', 'INSERT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async batchInsert({
    tableName,
    records,
  }: {
    tableName: TABLE_NAMES;
    records: Record<string, unknown>[];
  }): Promise<void> {
    try {
      if (records.length === 0) return;

      const fullTableName = this.getTableName(tableName);
      const processedRecords = await Promise.all(records.map(record => this.processRecord(record)));
      const columns = Object.keys(processedRecords[0] || {});

      // For batch insert, we need to create multiple INSERT statements
      for (const record of processedRecords) {
        const values = Object.values(record);
        const query = createSqlBuilder().insert(fullTableName, columns, values as SqlParam[]);
        const { sql, params } = query.build();
        await this.executeQuery({ sql, params });
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_DO', 'BATCH_INSERT', 'FAILED'),
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
      const deserializedResult: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(result)) {
        deserializedResult[key] = deserializeValue(value);
      }

      return deserializedResult as R;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_DO', 'LOAD', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async processRecord(record: Record<string, unknown>): Promise<Record<string, unknown>> {
    const processed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      processed[key] = this.serializeValue(value);
    }
    return processed;
  }

  /**
   * Upsert multiple records in a batch operation
   * @param tableName The table to insert into
   * @param records The records to insert
   * @param conflictKeys The columns to use for conflict detection (defaults to ['id'])
   */
  async batchUpsert({
    tableName,
    records,
    conflictKeys = ['id'],
  }: {
    tableName: TABLE_NAMES;
    records: Record<string, unknown>[];
    conflictKeys?: string[];
  }): Promise<void> {
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
                // Don't update conflict keys or createdAt on conflict
                if (col !== 'createdAt' && !conflictKeys.includes(col)) {
                  acc[col] = `excluded.${col}`;
                }
                return acc;
              },
              {} as Record<string, string>,
            );

            const query = createSqlBuilder().insert(
              fullTableName,
              columns,
              values as SqlParam[],
              conflictKeys,
              recordToUpsert,
            );

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
          id: createStorageErrorId('CLOUDFLARE_DO', 'BATCH_UPSERT', 'FAILED'),
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
