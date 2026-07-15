import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { StoreOperations, TABLE_CONFIGS, TABLE_SPANS, TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import type { StorageColumn, TABLE_NAMES, CreateIndexOptions } from '@mastra/core/storage';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import {
  formatTableName,
  prepareDeleteStatement,
  prepareInsertOnlyStatement,
  prepareStatement,
  prepareUpdateStatement,
  prepareWhereClause,
  quoteIdentifier,
  transformFromSqlRow,
  transformToSqlValue,
} from '../utils';
import type { SqlParam } from '../utils';

type WhereClause = {
  sql: string;
  args: SqlParam[];
};

export class StoreOperationsMySQL extends StoreOperations {
  private pool: Pool;
  private database?: string;
  private resolvedDatabase?: string | null;

  constructor({ pool, database }: { pool: Pool; database?: string }) {
    super();
    this.pool = pool;
    this.database = database;
    this.resolvedDatabase = database ?? null;
  }

  getPool(): Pool {
    return this.pool;
  }

  async query<T = RowDataPacket>(sql: string, args: SqlParam[] = []): Promise<T[]> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(sql, args.map(transformToSqlValue));
    return rows as unknown as T[];
  }

  private async getDatabase(): Promise<string | undefined> {
    if (this.resolvedDatabase !== null) {
      return this.resolvedDatabase ?? undefined;
    }

    const [rows] = await this.pool.query<RowDataPacket[]>('SELECT DATABASE() AS db');
    const db = rows[0]?.db as string | null;
    this.resolvedDatabase = db ?? null;
    return this.resolvedDatabase ?? undefined;
  }

  async hasColumn(table: string, column: string): Promise<boolean> {
    const db = await this.getDatabase();
    const params: SqlParam[] = [table, column];
    let sql =
      'SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name = ? AND (column_name = ? OR column_name = ? )';
    params.push(column.toLowerCase());
    if (db) {
      sql += ' AND table_schema = ?';
      params.push(db);
    }
    const [rows] = await this.pool.execute<RowDataPacket[]>(sql, params);
    return Number(rows[0]?.count ?? 0) > 0;
  }

  protected getSqlType(type: StorageColumn['type'], opts?: { isKey?: boolean; isNullable?: boolean }): string {
    const isKey = Boolean(opts?.isKey);
    const _isNullable = opts?.isNullable ?? true;
    switch (type) {
      case 'text':
        // Keys should remain short and indexable
        if (isKey) {
          return 'VARCHAR(191)';
        }
        // For non-key text fields, prefer LONGTEXT to avoid truncation errors
        // (message content, snapshots, etc. can exceed small VARCHAR limits)
        return 'LONGTEXT';
      case 'uuid':
        return 'VARCHAR(36)';
      case 'timestamp':
        return 'DATETIME(6)';
      case 'jsonb':
        return 'JSON';
      case 'integer':
        return 'INT';
      case 'float':
        return 'DOUBLE';
      case 'bigint':
        return 'BIGINT';
      case 'boolean':
        return 'TINYINT(1)';
      default:
        return super.getSqlType(type);
    }
  }

  private buildColumnDefinition(tableName: TABLE_NAMES, columnName: string, column: StorageColumn): string {
    const parts: string[] = [];
    const isKeyColumn = column.primaryKey || this.isKeyColumn(tableName, columnName);
    const isNullable = column.nullable !== false;
    parts.push(
      `${quoteIdentifier(columnName, 'column name')} ${this.getSqlType(column.type, {
        isKey: Boolean(isKeyColumn),
        isNullable,
      })}`,
    );
    if (column.nullable === false) {
      parts.push('NOT NULL');
      const defaultClause = this.getDefaultClause(column.type, {
        isNullable,
        isKey: Boolean(isKeyColumn),
      });
      if (defaultClause) {
        parts.push(defaultClause);
      }
    }
    if (column.primaryKey) {
      parts.push('PRIMARY KEY');
    }
    return parts.join(' ');
  }

  private getDefaultClause(
    type: StorageColumn['type'],
    { isNullable, isKey }: { isNullable: boolean; isKey: boolean },
  ): string | undefined {
    switch (type) {
      case 'jsonb':
        return undefined;
      case 'timestamp':
        return "DEFAULT '1970-01-01 00:00:00'";
      case 'text':
        return !isNullable && isKey ? "DEFAULT ''" : undefined;
      case 'boolean':
        return !isNullable ? 'DEFAULT 0' : undefined;
      default:
        return super.getDefaultValue(type);
    }
  }

  private getCreateTableSQL(tableName: TABLE_NAMES, schema: Record<string, StorageColumn>): string {
    const columns = Object.entries(schema).map(([name, column]) => this.buildColumnDefinition(tableName, name, column));
    const tableIdent = formatTableName(tableName, this.database);

    const extraConstraints: string[] = [];
    // Check if this table has a composite primary key defined in TABLE_CONFIGS
    const tableConfig = TABLE_CONFIGS[tableName];
    if (tableConfig?.compositePrimaryKey) {
      const pkColumns = tableConfig.compositePrimaryKey
        .map(col => quoteIdentifier(col, 'primary key column'))
        .join(', ');
      extraConstraints.push(`PRIMARY KEY (${pkColumns})`);
    }

    // Hard-coded constraints for tables that rely on upsert behavior
    if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
      extraConstraints.push(
        `PRIMARY KEY (${quoteIdentifier('workflow_name', 'column name')}, ${quoteIdentifier('run_id', 'column name')})`,
      );
    }
    if (tableName === TABLE_SPANS) {
      extraConstraints.push(
        `PRIMARY KEY (${quoteIdentifier('traceId', 'column name')}, ${quoteIdentifier('spanId', 'column name')})`,
      );
    }

    return `CREATE TABLE IF NOT EXISTS ${tableIdent} (${[...columns, ...extraConstraints].filter(Boolean).join(', ')}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;
  }

  private isKeyColumn(tableName: TABLE_NAMES, columnName: string): boolean {
    if (columnName === 'id') {
      return true;
    }

    // Check if this column is part of a composite primary key
    const tableConfig = TABLE_CONFIGS[tableName];
    if (tableConfig?.compositePrimaryKey?.includes(columnName)) {
      return true;
    }

    if (tableName === TABLE_WORKFLOW_SNAPSHOT && (columnName === 'workflow_name' || columnName === 'run_id')) {
      return true;
    }

    if (tableName === TABLE_SPANS && (columnName === 'traceId' || columnName === 'spanId')) {
      return true;
    }

    return false;
  }

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      const db = await this.getDatabase();
      const [t_rows] = await connection.query(
        'SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = ? AND table_name = ?',
        [db ?? '', tableName],
      );
      const exists = Array.isArray(t_rows) && t_rows.length > 0 && (t_rows[0] as any).count > 0;
      if (exists) {
        return;
      }
      const sql = this.getCreateTableSQL(tableName, schema);
      await connection.execute(sql);
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_STORE_CREATE_TABLE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    } finally {
      connection.release();
    }
  }

  async dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      await this.pool.execute(`DROP TABLE IF EXISTS ${formatTableName(tableName, this.database)}`);
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_STORE_DROP_TABLE_FAILED',
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
      await this.pool.execute(`DELETE FROM ${formatTableName(tableName, this.database)}`);
    } catch (error) {
      // Ignore table not exists errors
      if ((error as any)?.code === 'ER_NO_SUCH_TABLE') {
        return;
      }
      throw new MastraError(
        {
          id: 'MYSQL_STORE_CLEAR_TABLE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async withTransaction<T>(fn: (connection: PoolConnection) => Promise<T>): Promise<T> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await fn(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async createIndex(options: CreateIndexOptions): Promise<void> {
    const { name, table, columns, unique = false } = options;
    const tableName = formatTableName(table as TABLE_NAMES, this.database);
    const indexName = quoteIdentifier(name, 'index name');

    try {
      // Check if index already exists
      const db = (await this.getDatabase()) ?? '';
      const [existing] = await this.pool.execute<RowDataPacket[]>(
        `SELECT 1 FROM information_schema.STATISTICS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?
         LIMIT 1`,
        [db, table, name],
      );

      if (existing.length > 0) {
        return; // Index already exists
      }

      // Look up column data types so we can add prefix lengths for TEXT/BLOB
      // columns, which MySQL cannot index without an explicit key length.
      const [columnMeta] = await this.pool.execute<RowDataPacket[]>(
        `SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
        [db, table],
      );
      const dataTypeByColumn = new Map<string, string>(
        columnMeta.map(row => [String(row.COLUMN_NAME).toLowerCase(), String(row.DATA_TYPE).toLowerCase()]),
      );
      const PREFIX_TYPES = new Set([
        'tinytext',
        'text',
        'mediumtext',
        'longtext',
        'blob',
        'tinyblob',
        'mediumblob',
        'longblob',
      ]);
      const indexColumn = (colName: string): string => {
        const quoted = quoteIdentifier(colName, 'column name');
        const dataType = dataTypeByColumn.get(colName.toLowerCase());
        return dataType && PREFIX_TYPES.has(dataType) ? `${quoted}(191)` : quoted;
      };

      // Build column list
      const columnsStr = columns
        .map(col => {
          // Handle DESC/ASC modifiers
          if (col.includes(' DESC') || col.includes(' ASC')) {
            const [colName, ...modifiers] = col.split(' ');
            return `${indexColumn(colName!)} ${modifiers.join(' ')}`;
          }
          return indexColumn(col);
        })
        .join(', ');

      const uniqueStr = unique ? 'UNIQUE ' : '';
      const sql = `CREATE ${uniqueStr}INDEX ${indexName} ON ${tableName} (${columnsStr})`;

      await this.pool.execute(sql);
    } catch (error) {
      // Log but don't throw - indexes are performance optimizations
      console.warn(`Failed to create index ${name}:`, error);
    }
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    try {
      const statement = prepareStatement({ tableName, record, database: this.database });
      await this.pool.execute(statement.sql, statement.args);
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_STORE_INSERT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async insertOnly({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    try {
      const statement = prepareInsertOnlyStatement({ tableName, record, database: this.database });
      await this.pool.execute(statement.sql, statement.args);
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_STORE_INSERT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    if (records.length === 0) return;
    try {
      await this.withTransaction(async connection => {
        for (const record of records) {
          const statement = prepareStatement({ tableName, record, database: this.database });
          await connection.execute(statement.sql, statement.args);
        }
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_STORE_BATCH_INSERT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName, numberOfRecords: records.length },
        },
        error,
      );
    }
  }

  async update({
    tableName,
    keys,
    data,
  }: {
    tableName: TABLE_NAMES;
    keys: Record<string, any>;
    data: Record<string, any>;
  }): Promise<void> {
    try {
      const statement = prepareUpdateStatement({ tableName, updates: data, keys, database: this.database });
      await this.pool.execute(statement.sql, statement.args);
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_STORE_UPDATE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async batchUpdate({
    tableName,
    items,
  }: {
    tableName: TABLE_NAMES;
    items: { keys: Record<string, any>; data: Record<string, any> }[];
  }): Promise<void> {
    if (items.length === 0) return;
    try {
      await this.withTransaction(async connection => {
        for (const item of items) {
          const statement = prepareUpdateStatement({
            tableName,
            updates: item.data,
            keys: item.keys,
            database: this.database,
          });
          await connection.execute(statement.sql, statement.args);
        }
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_STORE_BATCH_UPDATE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName, numberOfRecords: items.length },
        },
        error,
      );
    }
  }

  async batchDelete({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, any>[] }): Promise<void> {
    if (keys.length === 0) return;
    try {
      await this.withTransaction(async connection => {
        for (const key of keys) {
          const statement = prepareDeleteStatement({ tableName, keys: key, database: this.database });
          await connection.execute(statement.sql, statement.args);
        }
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_STORE_BATCH_DELETE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName, numberOfRecords: keys.length },
        },
        error,
      );
    }
  }

  async delete({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, any> }): Promise<void> {
    try {
      const statement = prepareDeleteStatement({ tableName, keys, database: this.database });
      await this.pool.execute(statement.sql, statement.args);
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_STORE_DELETE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, any> }): Promise<R | null> {
    try {
      const whereClause = prepareWhereClause(keys);
      const sql = `SELECT * FROM ${formatTableName(tableName, this.database)}${whereClause.sql} ORDER BY createdAt DESC LIMIT 1`;
      const [rows] = await this.pool.execute<RowDataPacket[]>(sql, whereClause.args.map(transformToSqlValue));
      if (!rows.length) {
        return null;
      }
      let record = transformFromSqlRow<R>({ tableName, sqlRow: rows[0] as any });
      if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
        const snapshotRecord: any = record;
        if (typeof snapshotRecord.snapshot === 'string') {
          try {
            snapshotRecord.snapshot = JSON.parse(snapshotRecord.snapshot);
          } catch {}
        }
        record = snapshotRecord;
      }
      return record;
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_STORE_LOAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async loadMany<R>({
    tableName,
    whereClause,
    orderBy,
    offset,
    limit,
  }: {
    tableName: TABLE_NAMES;
    whereClause?: WhereClause;
    orderBy?: string;
    offset?: number;
    limit?: number;
  }): Promise<R[]> {
    try {
      let sql = `SELECT * FROM ${formatTableName(tableName, this.database)}`;
      const args: SqlParam[] = [];

      if (whereClause?.sql) {
        sql += whereClause.sql;
        args.push(...whereClause.args.map(transformToSqlValue));
      }

      if (orderBy) {
        sql += ` ORDER BY ${sanitizeOrderBy(orderBy)}`;
      }

      if (typeof limit === 'number') {
        const safeLimit = Math.max(0, Number(limit));
        sql += ` LIMIT ${safeLimit}`;
        if (typeof offset === 'number') {
          const safeOffset = Math.max(0, Number(offset));
          sql += ` OFFSET ${safeOffset}`;
        }
      } else if (typeof offset === 'number') {
        const safeOffset = Math.max(0, Number(offset));
        sql += ` LIMIT 18446744073709551615 OFFSET ${safeOffset}`;
      }

      const [rows] = await this.pool.execute<RowDataPacket[]>(sql, args);
      return rows.map((row: RowDataPacket) => transformFromSqlRow<R>({ tableName, sqlRow: row as any }));
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_STORE_LOAD_MANY_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async loadTotalCount({
    tableName,
    whereClause,
  }: {
    tableName: TABLE_NAMES;
    whereClause?: WhereClause;
  }): Promise<number> {
    try {
      let sql = `SELECT COUNT(*) as count FROM ${formatTableName(tableName, this.database)}`;
      const args: SqlParam[] = [];
      if (whereClause?.sql) {
        sql += whereClause.sql;
        args.push(...whereClause.args.map(transformToSqlValue));
      }
      const [rows] = await this.pool.execute<RowDataPacket[]>(sql, args);
      return Number(rows[0]?.count ?? 0);
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_STORE_LOAD_TOTAL_COUNT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async alterTable({
    tableName,
    schema,
    ifNotExists,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void> {
    if (!ifNotExists.length) return;

    // Check if table exists first
    const db = await this.getDatabase();
    const tableExistsSql =
      'SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = ? AND table_name = ?';
    const [tableRows] = await this.pool.execute<RowDataPacket[]>(tableExistsSql, [db ?? '', tableName]);
    const tableExists = Array.isArray(tableRows) && tableRows.length > 0 && (tableRows[0] as any).count > 0;

    if (!tableExists) {
      return; // Silently return if table doesn't exist
    }

    const params: SqlParam[] = [tableName];
    let sql = 'SELECT column_name FROM information_schema.columns WHERE table_name = ?';
    if (db) {
      sql += ' AND table_schema = ?';
      params.push(db);
    }
    const [rows] = await this.pool.execute<RowDataPacket[]>(sql, params);
    const existing = new Set((rows || []).map((row: RowDataPacket) => String(row.column_name).toLowerCase()));

    for (const columnName of ifNotExists) {
      if (existing.has(columnName.toLowerCase())) {
        continue;
      }
      const column = schema[columnName];
      if (!column) continue;

      const isNullable = column.nullable !== false;
      const isKeyColumn = Boolean(column.primaryKey) || this.isKeyColumn(tableName, columnName);
      const parts: string[] = [
        quoteIdentifier(columnName, 'column name'),
        this.getSqlType(column.type, { isKey: isKeyColumn, isNullable }),
      ];
      if (column.nullable === false) {
        parts.push('NOT NULL');
        const defaultClause = this.getDefaultClause(column.type, { isNullable, isKey: isKeyColumn });
        if (defaultClause) {
          parts.push(defaultClause);
        }
      }

      const alterSql = `ALTER TABLE ${formatTableName(tableName, this.database)} ADD COLUMN ${parts.join(' ')}`;
      try {
        await this.pool.execute(alterSql);
      } catch (error) {
        if ((error as any)?.code === 'ER_DUP_FIELDNAME') {
          continue;
        }
        throw new MastraError(
          {
            id: 'MYSQL_STORE_ALTER_TABLE_FAILED',
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.THIRD_PARTY,
            details: { tableName, columnName },
          },
          error,
        );
      }
    }
  }
}

const ORDER_BY_PATTERN = /^`[A-Za-z0-9_]+`(?:\s+(ASC|DESC))?$/i;

function sanitizeOrderBy(orderBy: string): string {
  const clauses = orderBy
    .split(',')
    .map(clause => clause.trim())
    .filter(Boolean);

  if (!clauses.length) {
    throw new Error('ORDER BY clause cannot be empty.');
  }

  clauses.forEach(clause => {
    if (!ORDER_BY_PATTERN.test(clause)) {
      throw new Error(`Invalid ORDER BY clause: ${clause}`);
    }
  });

  return clauses.join(', ');
}

/**
 * Generates MySQL CREATE TABLE SQL for export.
 * @param tableName - Table name
 * @param schema - Column definitions
 * @param compositePrimaryKey - Optional composite primary key columns
 */
export function generateTableSQL({
  tableName,
  schema,
  compositePrimaryKey,
}: {
  tableName: TABLE_NAMES;
  schema: Record<string, StorageColumn>;
  compositePrimaryKey?: string[];
}): string {
  const tableIdent = formatTableName(tableName);
  const columns = Object.entries(schema).map(([name, def]) => {
    const colName = quoteIdentifier(name, 'column name');
    const constraints: string[] = [];
    if (def.primaryKey && !compositePrimaryKey?.includes(name)) constraints.push('PRIMARY KEY');
    if (!def.nullable) constraints.push('NOT NULL');
    const sqlType = mapToMySqlType(def.type);
    return `${colName} ${sqlType} ${constraints.join(' ')}`;
  });

  const tableConstraints: string[] = [];
  if (compositePrimaryKey) {
    const pkCols = compositePrimaryKey.map(c => quoteIdentifier(c, 'primary key column')).join(', ');
    tableConstraints.push(`PRIMARY KEY (${pkCols})`);
  }

  return `CREATE TABLE IF NOT EXISTS ${tableIdent} (\n${[...columns, ...tableConstraints].join(',\n')}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;
}

/**
 * Generates MySQL CREATE INDEX SQL for export.
 */
export function generateIndexSQL(options: CreateIndexOptions): string {
  const { name, table, columns, unique = false } = options;
  const tableName = formatTableName(table as TABLE_NAMES);
  const indexName = quoteIdentifier(name, 'index name');
  const uniqueStr = unique ? 'UNIQUE ' : '';

  const columnsStr = columns
    .map(col => {
      if (col.includes(' DESC') || col.includes(' ASC')) {
        const [colName, ...modifiers] = col.split(' ');
        return `${quoteIdentifier(colName!, 'column name')} ${modifiers.join(' ')}`;
      }
      return quoteIdentifier(col, 'column name');
    })
    .join(', ');

  return `CREATE ${uniqueStr}INDEX ${indexName} ON ${tableName} (${columnsStr});`;
}

function mapToMySqlType(type: StorageColumn['type']): string {
  switch (type) {
    case 'text':
      return 'TEXT';
    case 'timestamp':
      return 'DATETIME(3)';
    case 'bigint':
      return 'BIGINT';
    case 'integer':
      return 'INT';
    case 'float':
      return 'FLOAT';
    case 'boolean':
      return 'BOOLEAN';
    case 'uuid':
      return 'VARCHAR(36)';
    case 'jsonb':
      return 'JSON';
    default:
      return 'TEXT';
  }
}
