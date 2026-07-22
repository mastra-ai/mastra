export type SqliteValue = null | string | number | bigint | ArrayBuffer;

export type SqliteInValue = SqliteValue | boolean | Date | Uint8Array;

export type SqliteInArgs = SqliteInValue[] | Record<string, SqliteInValue>;

export interface SqliteStatement {
  sql: string;
  args?: SqliteInArgs;
}

export interface SqliteResultSet {
  columns: string[];
  columnTypes: string[];
  rows: Array<Record<string, SqliteValue>>;
  rowsAffected: number;
  lastInsertRowid?: bigint;
}

export type SqliteTransactionMode = 'write' | 'read' | 'deferred';

export interface SqliteTransaction {
  execute(statement: string | SqliteStatement): Promise<SqliteResultSet>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  close(): void | Promise<void>;
  readonly closed: boolean;
}

export interface SqliteClient {
  execute(statement: string | SqliteStatement): Promise<SqliteResultSet>;
  batch(statements: Array<string | SqliteStatement>, mode?: SqliteTransactionMode): Promise<SqliteResultSet[]>;
  transaction(mode?: SqliteTransactionMode): Promise<SqliteTransaction>;
  close(): void | Promise<void>;
  readonly closed: boolean;
  readonly protocol: string;
}
