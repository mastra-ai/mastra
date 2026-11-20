import type { Client, ResultSet, Transaction } from '@libsql/client';
import type { SqliteClient, SqliteResultSet, SqliteTransaction } from '@mastra/libsql';

// Mastra's SQLite abstraction omits an absent row ID; @libsql/client exposes
// it as undefined. Normalize the boundary without weakening strict types.
const normalizeResult = (result: ResultSet): SqliteResultSet => ({
  columns: result.columns,
  columnTypes: result.columnTypes,
  rows: result.rows,
  rowsAffected: result.rowsAffected,
  ...(result.lastInsertRowid === undefined ? {} : { lastInsertRowid: result.lastInsertRowid }),
});

const adaptTransaction = (transaction: Transaction): SqliteTransaction => ({
  execute: async statement => normalizeResult(await transaction.execute(statement)),
  commit: () => transaction.commit(),
  rollback: () => transaction.rollback(),
  close: () => transaction.close(),
  get closed() {
    return transaction.closed;
  },
});

export const createMastraSqliteClient = (client: Client): SqliteClient => ({
  execute: async statement => normalizeResult(await client.execute(statement)),
  batch: async (statements, mode) => (await client.batch(statements, mode)).map(normalizeResult),
  transaction: async mode => adaptTransaction(await client.transaction(mode)),
  close: () => client.close(),
  get closed() {
    return client.closed;
  },
  get protocol() {
    return client.protocol;
  },
});
