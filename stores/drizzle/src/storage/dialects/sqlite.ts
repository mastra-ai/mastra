import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { eq, and, sql } from 'drizzle-orm';
import Database from 'better-sqlite3';
import { BaseDialect } from './base';
import {
  DialectConfig,
  SchemaDefinition,
  QueryResult,
  TransactionClient,
  ColumnDefinition,
  TableDefinition,
} from './types';

export class SQLiteDialect extends BaseDialect {
  private database?: Database.Database;
  protected db?: BetterSQLite3Database<any>;

  constructor(config: DialectConfig) {
    super(config);
  }

  async connect(): Promise<void> {
    if (this.database) {
      return;
    }

    const { connection } = this.config;
    const filename = connection.database || ':memory:';

    this.database = new Database(filename);

    // Enable foreign keys
    this.database.exec('PRAGMA foreign_keys = ON');

    this.db = drizzle(this.database, this.config.drizzleConfig as any);
  }

  async disconnect(): Promise<void> {
    if (this.database) {
      this.database.close();
      this.database = undefined;
      this.db = undefined;
    }
  }

  isConnected(): boolean {
    return !!this.database && this.database.open;
  }

  createSchema(definition: SchemaDefinition): any {
    const schemas: Record<string, any> = {};

    for (const [tableName, tableDef] of Object.entries(definition)) {
      schemas[tableName] = this.createTableSchema(tableName, tableDef);
    }

    this.schemas = schemas;
    return schemas;
  }

  private createTableSchema(tableName: string, definition: TableDefinition): any {
    const columns: Record<string, any> = {};

    for (const [columnName, columnDef] of Object.entries(definition.columns)) {
      columns[columnName] = this.createColumn(columnName, columnDef);
    }

    return sqliteTable(tableName, columns);
  }

  private createColumn(name: string, def: ColumnDefinition): any {
    let column: any;

    switch (def.type) {
      case 'uuid':
      case 'text':
      case 'varchar':
        column = text(name);
        break;
      case 'integer':
      case 'bigint':
        column = integer(name);
        break;
      case 'boolean':
        column = integer(name, { mode: 'boolean' });
        break;
      case 'timestamp':
      case 'date':
        column = integer(name, { mode: 'timestamp' });
        break;
      case 'json':
      case 'jsonb':
        column = text(name, { mode: 'json' });
        break;
      case 'decimal':
      case 'float':
      case 'double':
        column = text(name); // SQLite doesn't have real decimal type
        break;
      default:
        column = text(name);
    }

    if (def.primaryKey) {
      column = column.primaryKey();
    }
    if (def.notNull) {
      column = column.notNull();
    }
    if (def.unique) {
      column = column.unique();
    }
    if (def.default !== undefined) {
      if (def.default === 'now()') {
        column = column.default(sql`CURRENT_TIMESTAMP`);
      } else if (def.default === 'uuid_generate_v4()') {
        // SQLite doesn't have built-in UUID generation
        column = column.default(
          sql`(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))))`,
        );
      } else {
        column = column.default(def.default);
      }
    }

    return column;
  }

  getDb(): BetterSQLite3Database<any> {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  getSchemas(): any {
    return this.schemas;
  }

  async query<T = any>(sqlQuery: string, params?: any[]): Promise<QueryResult<T>> {
    if (!this.database) {
      throw new Error('Database not connected');
    }

    const stmt = this.database.prepare(sqlQuery);
    const rows = params ? stmt.all(...params) : stmt.all();

    return {
      rows: rows as T[],
      rowCount: rows.length,
    };
  }

  async transaction<T>(callback: (tx: TransactionClient) => Promise<T>): Promise<T> {
    if (!this.database) {
      throw new Error('Database not connected');
    }

    const db = this.database;

    return new Promise((resolve, reject) => {
      db.exec('BEGIN');

      const txClient: TransactionClient = {
        async query(sql: string, params?: any[]) {
          const stmt = db.prepare(sql);
          const rows = params ? stmt.all(...params) : stmt.all();
          return {
            rows: rows as any[],
            rowCount: rows.length,
          };
        },
        async rollback() {
          db.exec('ROLLBACK');
        },
        async commit() {
          db.exec('COMMIT');
        },
      };

      callback(txClient)
        .then(result => {
          db.exec('COMMIT');
          resolve(result);
        })
        .catch(error => {
          db.exec('ROLLBACK');
          reject(error);
        });
    });
  }

  async createTable(tableName: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    const createTableSQL = sql`
      CREATE TABLE IF NOT EXISTS ${sql.identifier(tableName)} (
        -- Table creation would be handled by Drizzle migrations
      )
    `;

    await this.db.run(createTableSQL);
  }

  async dropTable(tableName: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    await this.db.run(sql`DROP TABLE IF EXISTS ${sql.identifier(tableName)}`);
  }

  async tableExists(tableName: string): Promise<boolean> {
    if (!this.database) {
      throw new Error('Database not connected');
    }

    const result = this.database.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(tableName);

    return !!result;
  }

  async insert(table: string, data: Record<string, any>): Promise<any> {
    if (!this.db || !this.schemas[table]) {
      throw new Error(`Table ${table} not found in schema`);
    }

    const result = await this.db.insert(this.schemas[table]).values(data).returning();
    return Array.isArray(result) ? result[0] : result;
  }

  async update(table: string, data: Record<string, any>, where: Record<string, any>): Promise<any> {
    if (!this.db || !this.schemas[table]) {
      throw new Error(`Table ${table} not found in schema`);
    }

    const whereConditions = Object.entries(where).map(([key, value]) => eq(this.schemas[table][key], value));

    const result = await this.db
      .update(this.schemas[table])
      .set(data)
      .where(and(...whereConditions))
      .returning();

    return result;
  }

  async delete(table: string, where: Record<string, any>): Promise<number> {
    if (!this.db || !this.schemas[table]) {
      throw new Error(`Table ${table} not found in schema`);
    }

    const whereConditions = Object.entries(where).map(([key, value]) => eq(this.schemas[table][key], value));

    const result = await this.db
      .delete(this.schemas[table])
      .where(and(...whereConditions))
      .returning();

    return Array.isArray(result) ? result.length : 0;
  }

  async select(table: string, where?: Record<string, any>, options?: any): Promise<any[]> {
    if (!this.db || !this.schemas[table]) {
      throw new Error(`Table ${table} not found in schema`);
    }

    let query = this.db.select().from(this.schemas[table]);

    if (where && Object.keys(where).length > 0) {
      const whereConditions = Object.entries(where).map(([key, value]) => eq(this.schemas[table][key], value));
      query = query.where(and(...whereConditions)) as any;
    }

    if (options?.limit) {
      query = query.limit(options.limit) as any;
    }

    if (options?.offset) {
      query = query.offset(options.offset) as any;
    }

    return await query;
  }

  protected getProtocol(): string {
    return 'sqlite';
  }
}
