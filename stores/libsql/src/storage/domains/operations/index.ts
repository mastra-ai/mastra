import type { Client } from '@libsql/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { TABLE_WORKFLOW_SNAPSHOT, StoreOperations } from '@mastra/core/storage';
import type { StorageColumn, TABLE_NAMES } from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';
import { createExecuteWriteOperationWithRetry, prepareStatement } from '../utils';

export class StoreOperationsLibSQL extends StoreOperations {
  private client: Client;
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
  }: {
    client: Client;
    maxRetries?: number;
    initialBackoffMs?: number;
  }) {
    super();
    this.client = client;

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
}
