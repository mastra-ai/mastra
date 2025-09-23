import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { BaseDialect } from './base';
import {
  DialectConfig,
  SchemaDefinition,
  QueryResult,
  TransactionClient,
  ColumnDefinition,
  TableDefinition,
} from './types';
import { pgTable, uuid, text, timestamp, boolean, integer, jsonb, varchar } from 'drizzle-orm/pg-core';
import { eq, and, sql } from 'drizzle-orm';

export class NeonDialect extends BaseDialect {
  private client?: NeonQueryFunction<boolean, boolean>;
  protected db?: NeonHttpDatabase<any>;

  constructor(config: DialectConfig) {
    super(config);
  }

  async connect(): Promise<void> {
    const { connection } = this.config;
    const connectionString = connection.connectionString || connection.url;

    if (!connectionString) {
      throw new Error('Neon requires a connection string');
    }

    this.client = neon(connectionString);
    this.db = drizzle(this.client);
  }

  async disconnect(): Promise<void> {
    // Neon client doesn't have explicit disconnect
    this.client = undefined;
    this.db = undefined;
  }

  isConnected(): boolean {
    return !!this.client;
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

  getDb(): NeonHttpDatabase<any> {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  getSchemas(): any {
    return this.schemas;
  }

  async query<T = any>(sqlQuery: string, params?: any[]): Promise<QueryResult<T>> {
    if (!this.client) {
      throw new Error('Database not connected');
    }

    const result = await this.client(sqlQuery, params);
    const rows = Array.isArray(result) ? result : [];
    return {
      rows: rows as T[],
      rowCount: rows.length,
    };
  }

  async transaction<T>(callback: (tx: TransactionClient) => Promise<T>): Promise<T> {
    // Neon HTTP doesn't support transactions in the same way
    // We'll simulate it with a simple wrapper
    if (!this.client) {
      throw new Error('Database not connected');
    }

    const txClient: TransactionClient = {
      query: async (sql: string, params?: any[]) => {
        const result = await this.client!(sql, params);
        const rows = Array.isArray(result) ? result : [];
        return {
          rows: rows as any[],
          rowCount: rows.length,
        };
      },
      rollback: async () => {
        // HTTP connections don't have persistent transactions
        throw new Error('Rollback not supported in Neon HTTP mode');
      },
      commit: async () => {
        // HTTP connections auto-commit
      },
    };

    return callback(txClient);
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
    if (!this.client) {
      throw new Error('Database not connected');
    }

    const result = await this.client(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )`,
      [tableName],
    );

    const rows = Array.isArray(result) ? result : [];
    return rows.length > 0 && (rows[0] as any).exists;
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

  protected buildConnectionUrl(): string | undefined {
    const { connection } = this.config;
    return connection.connectionString || connection.url;
  }
}
