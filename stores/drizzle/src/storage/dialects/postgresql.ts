import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { pgTable, uuid, text, timestamp, boolean, integer, jsonb, varchar } from 'drizzle-orm/pg-core';
import { eq, and, sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { BaseDialect } from './base';
import {
  DialectConfig,
  SchemaDefinition,
  QueryResult,
  TransactionClient,
  ColumnDefinition,
  TableDefinition,
} from './types';

export class PostgreSQLDialect extends BaseDialect {
  private pool?: Pool;
  protected db?: NodePgDatabase<any>;

  constructor(config: DialectConfig) {
    super(config);
  }

  async connect(): Promise<void> {
    if (this.pool) {
      return;
    }

    const connectionString = this.buildConnectionUrl();

    this.pool = new Pool({
      connectionString,
      max: this.config.pool?.max || 10,
      min: this.config.pool?.min || 2,
      idleTimeoutMillis: this.config.pool?.idleTimeoutMillis || 30000,
      ...this.config.connection,
    });

    // Test connection
    const client = await this.pool.connect();
    client.release();

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
    return !!this.pool && !this.pool.ended;
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

    return pgTable(tableName, columns);
  }

  private createColumn(name: string, def: ColumnDefinition): any {
    let column: any;

    switch (def.type) {
      case 'uuid':
        column = uuid(name);
        break;
      case 'text':
        column = text(name);
        break;
      case 'varchar':
        column = varchar(name, { length: 255 });
        break;
      case 'integer':
        column = integer(name);
        break;
      case 'boolean':
        column = boolean(name);
        break;
      case 'timestamp':
        column = timestamp(name);
        break;
      case 'json':
      case 'jsonb':
        column = jsonb(name);
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
        column = column.default(sql`uuid_generate_v4()`);
      } else {
        column = column.default(def.default);
      }
    }

    return column;
  }

  getDb(): NodePgDatabase<any> {
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

    const result = await this.pool.query(sqlQuery, params);
    return {
      rows: result.rows,
      rowCount: result.rowCount || 0,
    };
  }

  async transaction<T>(callback: (tx: TransactionClient) => Promise<T>): Promise<T> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const txClient: TransactionClient = {
        async query(sql: string, params?: any[]) {
          const result = await client.query(sql, params);
          return {
            rows: result.rows,
            rowCount: result.rowCount || 0,
          };
        },
        async rollback() {
          await client.query('ROLLBACK');
        },
        async commit() {
          await client.query('COMMIT');
        },
      };

      const result = await callback(txClient);
      await client.query('COMMIT');

      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async createTable(tableName: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    // Use Drizzle's SQL builder to create table
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
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    const result = await this.pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )`,
      [tableName],
    );

    return result.rows[0].exists;
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

    const result = await this.db.delete(this.schemas[table]).where(and(...whereConditions));

    return result.rowCount || 0;
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
    return 'postgresql';
  }
}
