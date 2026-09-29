import type { InValue, ResultSet } from '@libsql/client';

export type SqlStatement = Readonly<{
  sql: string;
  args?: readonly InValue[] | Record<string, InValue>;
}>;

export type SqlResult = ResultSet;

export interface StoreTransaction {
  execute(statement: SqlStatement): Promise<SqlResult>;
  batch(statements: readonly SqlStatement[]): Promise<readonly SqlResult[]>;
}

export interface OperationalStore {
  execute(statement: SqlStatement): Promise<SqlResult>;
  transaction<T>(fn: (tx: StoreTransaction) => Promise<T>): Promise<T>;
  close(): void;
}
