import { DrizzleConfig } from 'drizzle-orm';
import { MigrationConfig } from 'drizzle-orm/migrator';

export type SupportedDialect = 'postgresql' | 'mysql' | 'sqlite' | 'turso' | 'planetscale' | 'neon';

export interface ConnectionConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean | any;
  authToken?: string;
  url?: string;
  maxConnections?: number;
  idleTimeout?: number;
}

export interface DialectConfig {
  type: SupportedDialect;
  connection: ConnectionConfig;
  drizzleConfig?: DrizzleConfig;
  migrationConfig?: MigrationConfig;
  pool?: {
    min?: number;
    max?: number;
    idleTimeoutMillis?: number;
  };
}

export interface SchemaDefinition {
  [tableName: string]: TableDefinition;
}

export interface TableDefinition {
  columns: Record<string, ColumnDefinition>;
  indexes?: Record<string, IndexDefinition>;
  foreignKeys?: Record<string, ForeignKeyDefinition>;
  primaryKey?: string | string[];
}

export interface ColumnDefinition {
  type: ColumnType;
  primaryKey?: boolean;
  notNull?: boolean;
  unique?: boolean;
  default?: any;
  references?: {
    table: string;
    column: string;
    onDelete?: 'cascade' | 'restrict' | 'set null' | 'no action';
    onUpdate?: 'cascade' | 'restrict' | 'set null' | 'no action';
  };
}

export type ColumnType =
  | 'uuid'
  | 'text'
  | 'varchar'
  | 'integer'
  | 'bigint'
  | 'boolean'
  | 'timestamp'
  | 'date'
  | 'json'
  | 'jsonb'
  | 'decimal'
  | 'float'
  | 'double'
  | 'blob'
  | 'enum';

export interface IndexDefinition {
  columns: string[];
  unique?: boolean;
  where?: string;
}

export interface ForeignKeyDefinition {
  columns: string[];
  references: {
    table: string;
    columns: string[];
  };
  onDelete?: 'cascade' | 'restrict' | 'set null' | 'no action';
  onUpdate?: 'cascade' | 'restrict' | 'set null' | 'no action';
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface TransactionClient {
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
  rollback(): Promise<void>;
  commit(): Promise<void>;
}
