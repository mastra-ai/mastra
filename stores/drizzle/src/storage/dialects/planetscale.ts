import { drizzle, PlanetScaleDatabase } from 'drizzle-orm/planetscale-serverless';
import { connect, Connection } from '@planetscale/database';
import { BaseDialect } from './base';
import {
  DialectConfig,
  SchemaDefinition,
  QueryResult,
  TransactionClient,
  ColumnDefinition,
  TableDefinition,
} from './types';
import { mysqlTable, varchar, text, timestamp, boolean, int, json } from 'drizzle-orm/mysql-core';
import { eq, and, sql } from 'drizzle-orm';

export class PlanetScaleDialect extends BaseDialect {
  private client?: Connection;
  protected db?: PlanetScaleDatabase<any>;

  constructor(config: DialectConfig) {
    super(config);
  }

  async connect(): Promise<void> {
    const { connection } = this.config;

    this.client = connect({
      url: connection.url || connection.connectionString,
    });

    this.db = drizzle(this.client as any);
  }

  async disconnect(): Promise<void> {
    // PlanetScale client doesn't have explicit disconnect
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

  getDb(): PlanetScaleDatabase<any> {
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

    const result = await this.client.execute(sqlQuery, params);
    return {
      rows: result.rows as T[],
      rowCount: result.size || 0,
    };
  }

  async transaction<T>(callback: (tx: TransactionClient) => Promise<T>): Promise<T> {
    if (!this.client) {
      throw new Error('Database not connected');
    }

    return await this.client.transaction(async tx => {
      const txClient: TransactionClient = {
        async query(sql: string, params?: any[]) {
          const result = await tx.execute(sql, params);
          return {
            rows: result.rows as any[],
            rowCount: result.size || 0,
          };
        },
        async rollback() {
          // Transaction automatically rolls back on error
          throw new Error('Manual rollback requested');
        },
        async commit() {
          // Transaction auto-commits if no error
        },
      };

      return await callback(txClient);
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

    const result = await this.client.execute(
      `SELECT COUNT(*) as count FROM information_schema.tables 
       WHERE table_schema = DATABASE() AND table_name = ?`,
      [tableName],
    );

    return (result.rows[0] as any).count > 0;
  }

  async insert(table: string, data: Record<string, any>): Promise<any> {
    if (!this.db || !this.schemas[table]) {
      throw new Error(`Table ${table} not found in schema`);
    }

    const result = await this.db.insert(this.schemas[table]).values(data);
    return { ...data, insertId: (result as any).insertId };
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

    return (result as any).rowsAffected || 0;
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
