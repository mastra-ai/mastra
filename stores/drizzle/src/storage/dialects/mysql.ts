import { drizzle, MySql2Database } from 'drizzle-orm/mysql2';
import { mysqlTable, varchar, text, timestamp, boolean, int, json } from 'drizzle-orm/mysql-core';
import { eq, and, sql } from 'drizzle-orm';
import mysql from 'mysql2/promise';
import { BaseDialect } from './base';
import {
  DialectConfig,
  SchemaDefinition,
  QueryResult,
  TransactionClient,
  ColumnDefinition,
  TableDefinition,
} from './types';

export class MySQLDialect extends BaseDialect {
  private pool?: mysql.Pool;
  protected db?: MySql2Database<any>;

  constructor(config: DialectConfig) {
    super(config);
  }

  async connect(): Promise<void> {
    if (this.pool) {
      return;
    }

    const { connection } = this.config;

    this.pool = mysql.createPool({
      host: connection.host,
      port: connection.port || 3306,
      database: connection.database,
      user: connection.user,
      password: connection.password,
      connectionLimit: this.config.pool?.max || 10,
      waitForConnections: true,
      queueLimit: 0,
      ...connection,
    });

    // Test connection
    const conn = await this.pool.getConnection();
    conn.release();

    this.db = drizzle(this.pool, this.config.drizzleConfig as any);
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = undefined;
      this.db = undefined;
    }
  }

  isConnected(): boolean {
    return !!this.pool;
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

    return mysqlTable(tableName, columns);
  }

  private createColumn(name: string, def: ColumnDefinition): any {
    let column: any;

    switch (def.type) {
      case 'uuid':
        column = varchar(name, { length: 36 });
        break;
      case 'text':
        column = text(name);
        break;
      case 'varchar':
        column = varchar(name, { length: 255 });
        break;
      case 'integer':
        column = int(name);
        break;
      case 'boolean':
        column = boolean(name);
        break;
      case 'timestamp':
        column = timestamp(name);
        break;
      case 'json':
      case 'jsonb':
        column = json(name);
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
        column = column.defaultNow();
      } else if (def.default === 'uuid_generate_v4()') {
        column = column.default(sql`(UUID())`);
      } else {
        column = column.default(def.default);
      }
    }

    return column;
  }

  getDb(): MySql2Database<any> {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  getSchemas(): any {
    return this.schemas;
  }

  async query<T = any>(sqlQuery: string, params?: any[]): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    const [rows] = await this.pool.execute(sqlQuery, params);
    return {
      rows: rows as T[],
      rowCount: Array.isArray(rows) ? rows.length : 0,
    };
  }

  async transaction<T>(callback: (tx: TransactionClient) => Promise<T>): Promise<T> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();

      const txClient: TransactionClient = {
        async query(sql: string, params?: any[]) {
          const [rows] = await connection.execute(sql, params);
          return {
            rows: rows as any[],
            rowCount: Array.isArray(rows) ? rows.length : 0,
          };
        },
        async rollback() {
          await connection.rollback();
        },
        async commit() {
          await connection.commit();
        },
      };

      const result = await callback(txClient);
      await connection.commit();

      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
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

    await this.db.execute(createTableSQL);
  }

  async dropTable(tableName: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    await this.db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(tableName)}`);
  }

  async tableExists(tableName: string): Promise<boolean> {
    if (!this.pool || !this.config.connection.database) {
      throw new Error('Database not connected');
    }

    const [rows] = await this.pool.execute(
      `SELECT COUNT(*) as count FROM information_schema.tables 
       WHERE table_schema = ? AND table_name = ?`,
      [this.config.connection.database, tableName],
    );

    return (rows as any)[0].count > 0;
  }

  async insert(table: string, data: Record<string, any>): Promise<any> {
    if (!this.db || !this.schemas[table]) {
      throw new Error(`Table ${table} not found in schema`);
    }

    const result = await this.db.insert(this.schemas[table]).values(data);
    return { ...data, insertId: (result as any)[0].insertId };
  }

  async update(table: string, data: Record<string, any>, where: Record<string, any>): Promise<any> {
    if (!this.db || !this.schemas[table]) {
      throw new Error(`Table ${table} not found in schema`);
    }

    const whereConditions = Object.entries(where).map(([key, value]) => eq(this.schemas[table][key], value));

    const result = await this.db
      .update(this.schemas[table])
      .set(data)
      .where(and(...whereConditions));

    return result;
  }

  async delete(table: string, where: Record<string, any>): Promise<number> {
    if (!this.db || !this.schemas[table]) {
      throw new Error(`Table ${table} not found in schema`);
    }

    const whereConditions = Object.entries(where).map(([key, value]) => eq(this.schemas[table][key], value));

    const result = await this.db.delete(this.schemas[table]).where(and(...whereConditions));

    return (result as any)[0].affectedRows || 0;
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
    return 'mysql';
  }
}
