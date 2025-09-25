import type { Client, InValue } from '@libsql/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  TABLE_WORKFLOW_SNAPSHOT,
  StoreOperations,
  TABLE_AI_SPANS,
  TABLE_THREADS,
  TABLE_MESSAGES,
  TABLE_TRACES,
  TABLE_EVALS,
  TABLE_SCORERS,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type {
  StorageColumn,
  TABLE_NAMES,
  CreateIndexOptions,
  IndexInfo,
  StorageIndexStats,
} from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';
import {
  createExecuteWriteOperationWithRetry,
  prepareDeleteStatement,
  prepareStatement,
  prepareUpdateStatement,
} from '../utils';

export class StoreOperationsLibSQL extends StoreOperations {
  private client: Client;
  public schemaName?: string;
  /**
   * Maximum number of retries for write operations if an SQLITE_BUSY error occurs.
   * @default 5
   */
  maxRetries: number;
  /**
   * Initial backoff time in milliseconds for retrying write operations on SQLITE_BUSY.
   * The backoff time will double with each retry (exponential backoff).
   * @default 100
   */
  initialBackoffMs: number;

  constructor({
    client,
    maxRetries,
    initialBackoffMs,
    schemaName,
  }: {
    client: Client;
    maxRetries?: number;
    initialBackoffMs?: number;
    schemaName?: string;
  }) {
    super();
    this.client = client;
    this.schemaName = schemaName;

    this.maxRetries = maxRetries ?? 5;
    this.initialBackoffMs = initialBackoffMs ?? 100;
  }

  async hasColumn(table: string, column: string): Promise<boolean> {
    const result = await this.client.execute({
      sql: `PRAGMA table_info(${table})`,
    });
    return (await result.rows)?.some((row: any) => row.name === column);
  }

  private getCreateTableSQL(tableName: TABLE_NAMES, schema: Record<string, StorageColumn>): string {
    const parsedTableName = parseSqlIdentifier(tableName, 'table name');
    const columns = Object.entries(schema).map(([name, col]) => {
      const parsedColumnName = parseSqlIdentifier(name, 'column name');
      let type = col.type.toUpperCase();
      if (type === 'TEXT') type = 'TEXT';
      if (type === 'TIMESTAMP') type = 'TEXT'; // Store timestamps as ISO strings
      // if (type === 'BIGINT') type = 'INTEGER';

      const nullable = col.nullable ? '' : 'NOT NULL';
      const primaryKey = col.primaryKey ? 'PRIMARY KEY' : '';

      return `${parsedColumnName} ${type} ${nullable} ${primaryKey}`.trim();
    });

    // For workflow_snapshot table, create a composite primary key
    if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
      const stmnt = `CREATE TABLE IF NOT EXISTS ${parsedTableName} (
                    ${columns.join(',\n')},
                    PRIMARY KEY (workflow_name, run_id)
                )`;
      return stmnt;
    }

    if (tableName === TABLE_AI_SPANS) {
      const stmnt = `CREATE TABLE IF NOT EXISTS ${parsedTableName} (
                    ${columns.join(',\n')},
                    PRIMARY KEY (traceId, spanId)
                )`;
      return stmnt;
    }

    return `CREATE TABLE IF NOT EXISTS ${parsedTableName} (${columns.join(', ')})`;
  }

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    try {
      this.logger.debug(`Creating database table`, { tableName, operation: 'schema init' });
      const sql = this.getCreateTableSQL(tableName, schema);
      await this.client.execute(sql);
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_CREATE_TABLE_FAILED',
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

  private async doInsert({
    tableName,
    record,
  }: {
    tableName: TABLE_NAMES;
    record: Record<string, any>;
  }): Promise<void> {
    await this.client.execute(
      prepareStatement({
        tableName,
        record,
      }),
    );
  }

  public insert(args: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    const executeWriteOperationWithRetry = createExecuteWriteOperationWithRetry({
      logger: this.logger,
      maxRetries: this.maxRetries,
      initialBackoffMs: this.initialBackoffMs,
    });
    return executeWriteOperationWithRetry(() => this.doInsert(args), `insert into table ${args.tableName}`);
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    const parsedTableName = parseSqlIdentifier(tableName, 'table name');

    const parsedKeys = Object.keys(keys).map(key => parseSqlIdentifier(key, 'column name'));

    const conditions = parsedKeys.map(key => `${key} = ?`).join(' AND ');
    const values = Object.values(keys);

    const result = await this.client.execute({
      sql: `SELECT * FROM ${parsedTableName} WHERE ${conditions} ORDER BY createdAt DESC LIMIT 1`,
      args: values,
    });

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    // Checks whether the string looks like a JSON object ({}) or array ([])
    // If the string starts with { or [, it assumes it's JSON and parses it
    // Otherwise, it just returns, preventing unintended number conversions
    const parsed = Object.fromEntries(
      Object.entries(row || {}).map(([k, v]) => {
        try {
          return [k, typeof v === 'string' ? (v.startsWith('{') || v.startsWith('[') ? JSON.parse(v) : v) : v];
        } catch {
          return [k, v];
        }
      }),
    );

    return parsed as R;
  }

  async loadMany<R>({
    tableName,
    whereClause,
    orderBy,
    offset,
    limit,
    args,
  }: {
    tableName: TABLE_NAMES;
    whereClause?: { sql: string; args: InValue[] };
    orderBy?: string;
    offset?: number;
    limit?: number;
    args?: any[];
  }): Promise<R[]> {
    const parsedTableName = parseSqlIdentifier(tableName, 'table name');

    let statement = `SELECT * FROM ${parsedTableName}`;

    if (whereClause?.sql) {
      statement += `${whereClause.sql}`;
    }

    if (orderBy) {
      statement += ` ORDER BY ${orderBy}`;
    }

    if (limit) {
      statement += ` LIMIT ${limit}`;
    }

    if (offset) {
      statement += ` OFFSET ${offset}`;
    }

    const result = await this.client.execute({
      sql: statement,
      args: [...(whereClause?.args ?? []), ...(args ?? [])],
    });

    return result.rows as R[];
  }

  async loadTotalCount({
    tableName,
    whereClause,
  }: {
    tableName: TABLE_NAMES;
    whereClause?: { sql: string; args: InValue[] };
  }): Promise<number> {
    const parsedTableName = parseSqlIdentifier(tableName, 'table name');

    const statement = `SELECT COUNT(*) as count FROM ${parsedTableName} ${whereClause ? `${whereClause.sql}` : ''}`;

    const result = await this.client.execute({
      sql: statement,
      args: whereClause?.args ?? [],
    });

    if (!result.rows || result.rows.length === 0) {
      return 0;
    }

    return (result.rows[0]?.count as number) ?? 0;
  }

  public update(args: { tableName: TABLE_NAMES; keys: Record<string, any>; data: Record<string, any> }): Promise<void> {
    const executeWriteOperationWithRetry = createExecuteWriteOperationWithRetry({
      logger: this.logger,
      maxRetries: this.maxRetries,
      initialBackoffMs: this.initialBackoffMs,
    });
    return executeWriteOperationWithRetry(() => this.executeUpdate(args), `update table ${args.tableName}`);
  }

  private async executeUpdate({
    tableName,
    keys,
    data,
  }: {
    tableName: TABLE_NAMES;
    keys: Record<string, any>;
    data: Record<string, any>;
  }): Promise<void> {
    await this.client.execute(prepareUpdateStatement({ tableName, updates: data, keys }));
  }

  private async doBatchInsert({
    tableName,
    records,
  }: {
    tableName: TABLE_NAMES;
    records: Record<string, any>[];
  }): Promise<void> {
    if (records.length === 0) return;
    const batchStatements = records.map(r => prepareStatement({ tableName, record: r }));
    await this.client.batch(batchStatements, 'write');
  }

  public batchInsert(args: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    const executeWriteOperationWithRetry = createExecuteWriteOperationWithRetry({
      logger: this.logger,
      maxRetries: this.maxRetries,
      initialBackoffMs: this.initialBackoffMs,
    });

    return executeWriteOperationWithRetry(
      () => this.doBatchInsert(args),
      `batch insert into table ${args.tableName}`,
    ).catch(error => {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_BATCH_INSERT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName: args.tableName,
          },
        },
        error,
      );
    });
  }

  /**
   * Public batch update method with retry logic
   */
  public batchUpdate(args: {
    tableName: TABLE_NAMES;
    updates: Array<{
      keys: Record<string, any>;
      data: Record<string, any>;
    }>;
  }): Promise<void> {
    const executeWriteOperationWithRetry = createExecuteWriteOperationWithRetry({
      logger: this.logger,
      maxRetries: this.maxRetries,
      initialBackoffMs: this.initialBackoffMs,
    });

    return executeWriteOperationWithRetry(
      () => this.executeBatchUpdate(args),
      `batch update in table ${args.tableName}`,
    ).catch(error => {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_BATCH_UPDATE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName: args.tableName,
          },
        },
        error,
      );
    });
  }

  /**
   * Updates multiple records in batch. Each record can be updated based on single or composite keys.
   */
  private async executeBatchUpdate({
    tableName,
    updates,
  }: {
    tableName: TABLE_NAMES;
    updates: Array<{
      keys: Record<string, any>;
      data: Record<string, any>;
    }>;
  }): Promise<void> {
    if (updates.length === 0) return;

    const batchStatements = updates.map(({ keys, data }) =>
      prepareUpdateStatement({
        tableName,
        updates: data,
        keys,
      }),
    );

    await this.client.batch(batchStatements, 'write');
  }

  /**
   * Public batch delete method with retry logic
   */
  public batchDelete({ tableName, keys }: { tableName: TABLE_NAMES; keys: Array<Record<string, any>> }): Promise<void> {
    const executeWriteOperationWithRetry = createExecuteWriteOperationWithRetry({
      logger: this.logger,
      maxRetries: this.maxRetries,
      initialBackoffMs: this.initialBackoffMs,
    });

    return executeWriteOperationWithRetry(
      () => this.executeBatchDelete({ tableName, keys }),
      `batch delete from table ${tableName}`,
    ).catch(error => {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_BATCH_DELETE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
          },
        },
        error,
      );
    });
  }

  /**
   * Deletes multiple records in batch. Each record can be deleted based on single or composite keys.
   */
  private async executeBatchDelete({
    tableName,
    keys,
  }: {
    tableName: TABLE_NAMES;
    keys: Array<Record<string, any>>;
  }): Promise<void> {
    if (keys.length === 0) return;

    const batchStatements = keys.map(keyObj =>
      prepareDeleteStatement({
        tableName,
        keys: keyObj,
      }),
    );

    await this.client.batch(batchStatements, 'write');
  }

  /**
   * Alters table schema to add columns if they don't exist
   * @param tableName Name of the table
   * @param schema Schema of the table
   * @param ifNotExists Array of column names to add if they don't exist
   */
  async alterTable({
    tableName,
    schema,
    ifNotExists,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void> {
    const parsedTableName = parseSqlIdentifier(tableName, 'table name');

    try {
      // 1. Get existing columns using PRAGMA
      const pragmaQuery = `PRAGMA table_info(${parsedTableName})`;
      const result = await this.client.execute(pragmaQuery);
      const existingColumnNames = new Set(result.rows.map((row: any) => row.name.toLowerCase()));

      // 2. Add missing columns
      for (const columnName of ifNotExists) {
        if (!existingColumnNames.has(columnName.toLowerCase()) && schema[columnName]) {
          const columnDef = schema[columnName];
          const sqlType = this.getSqlType(columnDef.type); // ensure this exists or implement
          const nullable = columnDef.nullable === false ? 'NOT NULL' : '';
          // In SQLite, you must provide a DEFAULT if adding a NOT NULL column to a non-empty table
          const defaultValue = columnDef.nullable === false ? this.getDefaultValue(columnDef.type) : '';
          const alterSql =
            `ALTER TABLE ${parsedTableName} ADD COLUMN "${columnName}" ${sqlType} ${nullable} ${defaultValue}`.trim();

          await this.client.execute(alterSql);
          this.logger?.debug?.(`Added column ${columnName} to table ${parsedTableName}`);
        }
      }
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_ALTER_TABLE_FAILED',
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

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    const parsedTableName = parseSqlIdentifier(tableName, 'table name');
    try {
      await this.client.execute(`DELETE FROM ${parsedTableName}`);
    } catch (e) {
      const mastraError = new MastraError(
        {
          id: 'LIBSQL_STORE_CLEAR_TABLE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
          },
        },
        e,
      );
      this.logger?.trackException?.(mastraError);
      this.logger?.error?.(mastraError.toString());
    }
  }

  async dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    const parsedTableName = parseSqlIdentifier(tableName, 'table name');
    try {
      await this.client.execute(`DROP TABLE IF EXISTS ${parsedTableName}`);
    } catch (e) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_DROP_TABLE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
          },
        },
        e,
      );
    }
  }

  /**
   * Create a new index on a table
   */
  async createIndex(options: CreateIndexOptions): Promise<void> {
    const { name, table, columns, unique = false, where, opclass, tablespace, method, concurrent } = options;

    if (opclass || tablespace || method || concurrent) {
      throw new MastraError({
        id: 'MASTRA_STORAGE_LIBSQL_CREATE_INDEX_OPTION_NOT_SUPPORTED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        details: {
          opclass: opclass ?? '',
          tablespace: tablespace ?? '',
          method: method ?? '',
          concurrent: concurrent ?? '',
        },
      });
    }

    try {
      // Check if index already exists
      const indexExists = await this.client.execute({
        sql: `SELECT name FROM sqlite_master WHERE type='index' AND name=?`,
        args: [name],
      });

      if (indexExists.rows && indexExists.rows.length > 0) {
        // Index already exists, skip creation
        return;
      }

      // Build index creation SQL
      const uniqueStr = unique ? 'UNIQUE ' : '';

      // Handle columns with optional DESC/ASC modifiers
      const columnsStr = columns
        .map(col => {
          // Handle columns with DESC/ASC modifiers
          if (col.includes(' DESC') || col.includes(' ASC')) {
            const [colName, ...modifiers] = col.split(' ');
            if (!colName) {
              throw new Error(`Invalid column specification: ${col}`);
            }
            return `"${parseSqlIdentifier(colName, 'column name')}" ${modifiers.join(' ')}`;
          }
          return `"${parseSqlIdentifier(col, 'column name')}"`;
        })
        .join(', ');

      const whereStr = where ? ` WHERE ${where}` : '';
      const tableName = parseSqlIdentifier(table, 'table name');

      const sql = `CREATE ${uniqueStr}INDEX "${name}" ON ${tableName} (${columnsStr})${whereStr}`;

      await this.client.execute(sql);
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_LIBSQL_INDEX_CREATE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName: options.name,
            tableName: options.table,
          },
        },
        error,
      );
    }
  }

  /**
   * Drop an existing index
   */
  async dropIndex(indexName: string): Promise<void> {
    try {
      const indexExists = await this.client.execute({
        sql: `SELECT name FROM sqlite_master WHERE type='index' AND name=?`,
        args: [indexName],
      });

      if (!indexExists.rows || indexExists.rows.length === 0) {
        return;
      }

      const sql = `DROP INDEX IF EXISTS "${indexName}"`;
      await this.client.execute(sql);
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_LIBSQL_INDEX_DROP_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
          },
        },
        error,
      );
    }
  }

  /**
   * List indexes for a specific table or all tables
   */
  async listIndexes(tableName?: string): Promise<IndexInfo[]> {
    try {
      const allTableNames = Object.keys(TABLE_SCHEMAS);
      const query = `SELECT
                      name,
                      tbl_name AS table_name,
                      sql AS definition
                    FROM
                      sqlite_master
                    WHERE
                      type = 'index'
                      AND tbl_name IN (${tableName ? `?` : allTableNames.map(() => `?`).join(',')})
                    ORDER BY
                      tbl_name,
                      name;`;

      const tableIndexes = await this.client.execute({
        sql: query,
        args: tableName ? [tableName] : allTableNames,
      });

      const indexDetails: IndexInfo[] = await Promise.all(
        tableIndexes.rows.map(async index => {
          const [indexList, columnInfo] = await Promise.all([
            this.client.execute(`PRAGMA index_list('${index.table_name}')`),
            this.client.execute(`PRAGMA index_info('${index.name}')`),
          ]);

          return {
            name: index.name as string,
            unique: indexList.rows.find(idx => idx.name === index.name)?.unique === 1 || false,
            columns: columnInfo.rows.map(col => col.name as string),
            table: index.table_name as string,
            size: 'Unavailable for libsql',
            definition: index.definition as string,
          };
        }),
      );

      return indexDetails;
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_LIBSQL_INDEX_LIST_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName: tableName || 'all_tables',
          },
        },
        error,
      );
    }
  }

  /**
   * Creates automatic indexes for optimal query performance
   * These composite indexes cover both filtering and sorting in single index
   */
  async createAutomaticIndexes(): Promise<void> {
    try {
      const schemaPrefix = `${this.schemaName ? `${this.schemaName}_` : ''}mastra_`;
      const indexes: CreateIndexOptions[] = [
        // Composite index for threads (filter + sort)
        {
          name: `${schemaPrefix}threads_resourceid_createdat_idx`,
          table: TABLE_THREADS,
          columns: ['resourceId', 'createdAt DESC'],
        },
        // Composite index for messages (filter + sort)
        {
          name: `${schemaPrefix}messages_thread_id_createdat_idx`,
          table: TABLE_MESSAGES,
          columns: ['thread_id', 'createdAt DESC'],
        },
        // Composite index for traces (filter + sort)
        {
          name: `${schemaPrefix}traces_name_starttime_idx`,
          table: TABLE_TRACES,
          columns: ['name', 'startTime DESC'],
        },
        // Composite index for evals (filter + sort)
        {
          name: `${schemaPrefix}mastra_evals_agent_name_created_at_idx`,
          table: TABLE_EVALS,
          columns: ['agent_name', 'created_at DESC'],
        },
        // Composite index for scores (filter + sort)
        {
          name: `${schemaPrefix}mastra_scores_trace_id_span_id_createdat_idx`,
          table: TABLE_SCORERS,
          columns: ['traceId', 'spanId', 'createdAt DESC'],
        },
      ];

      for (const indexOptions of indexes) {
        try {
          await this.createIndex(indexOptions);
        } catch (error) {
          // Log but continue with other indexes
          this.logger?.warn?.(`Failed to create index ${indexOptions.name}:`, error);
        }
      }
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_LIBSQL_STORE_CREATE_PERFORMANCE_INDEXES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async describeIndex(indexName: string): Promise<StorageIndexStats> {
    throw new MastraError({
      id: 'MASTRA_STORAGE_LIBSQL_STORE_DESCRIBE_INDEX_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `LibSQL does not support describing indexes`,
      details: {
        indexName,
      },
    });
  }
}
