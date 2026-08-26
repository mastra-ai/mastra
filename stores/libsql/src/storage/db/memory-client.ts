import { LibsqlError } from '@libsql/client';

import type {
  SqliteClient,
  SqliteResultSet,
  SqliteStatement,
  SqliteTransaction,
  SqliteTransactionMode,
} from './client';

/**
 * `@libsql/client`'s `Sqlite3Client.transaction()` hands its current
 * connection to the returned transaction and lazily opens a *new* connection
 * for the next autocommit call. For a `file:` database that reopen is
 * harmless, but for a private in-memory database (`:memory:` /
 * `file::memory:` without `cache=shared`) the new connection is a brand-new
 * empty database — every table and row written before the transaction becomes
 * unreachable (mastra-ai/mastra#22328, upstream
 * tursodatabase/libsql-client-ts#342).
 *
 * `execute()` and `batch()` never discard the connection, so
 * {@link wrapMemoryClient} keeps private in-memory databases alive by
 * emulating interactive transactions over plain `execute()` calls
 * (`BEGIN …` / `COMMIT` / `ROLLBACK`) on the single persistent connection.
 *
 * Every interactive-transaction call site in this package already serializes
 * through `withClientWriteLock`, so no other write can interleave with the
 * open emulated transaction. Ungated reads issued while an emulated
 * transaction is open run inside it (read-uncommitted) — a minor wrinkle
 * confined to dev-only in-memory usage.
 */

/**
 * True for URLs backed by a *private* in-memory database, i.e. ones whose
 * connection-backed data would be lost when `transaction()` reopens the
 * connection. `file::memory:?cache=shared` attaches to the process-wide
 * shared cache and survives reconnects, so it is excluded.
 */
export function isPrivateMemoryUrl(url: string): boolean {
  const normalized = url.toLowerCase();
  if (normalized === ':memory:') return true;
  if (!normalized.startsWith('file:')) return false;
  const [path, query] = normalized.slice('file:'.length).split('?');
  return path === ':memory:' && !(query ?? '').split('&').includes('cache=shared');
}

function beginStatement(mode: SqliteTransactionMode): string {
  switch (mode) {
    case 'read':
      return 'BEGIN TRANSACTION READONLY';
    case 'deferred':
      return 'BEGIN DEFERRED';
    case 'write':
    default:
      return 'BEGIN IMMEDIATE';
  }
}

class EmulatedTransaction implements SqliteTransaction {
  #client: SqliteClient;
  #closed = false;

  constructor(client: SqliteClient) {
    this.#client = client;
  }

  get closed(): boolean {
    return this.#closed;
  }

  async execute(statement: string | SqliteStatement): Promise<SqliteResultSet> {
    if (this.#closed) {
      throw new LibsqlError('The transaction is closed', 'TRANSACTION_CLOSED');
    }
    return this.#client.execute(statement);
  }

  async commit(): Promise<void> {
    if (this.#closed) {
      throw new LibsqlError('The transaction is closed', 'TRANSACTION_CLOSED');
    }
    this.#closed = true;
    await this.#client.execute('COMMIT');
  }

  async rollback(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    await this.#client.execute('ROLLBACK');
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    // Fire-and-forget rollback, matching libsql's Transaction.close() which
    // discards the open transaction without surfacing errors.
    void this.#client.execute('ROLLBACK').catch(() => {});
  }
}

/**
 * Wraps a client backed by a private in-memory database so `transaction()` is
 * emulated over `execute()` on the single persistent connection instead of
 * delegating to `@libsql/client`, which would discard that connection (and
 * with it the whole database).
 *
 * All other members delegate to the wrapped client untouched.
 */
export function wrapMemoryClient<T extends SqliteClient>(client: T): T {
  return new Proxy(client, {
    get(target, prop) {
      if (prop === 'transaction') {
        return async (mode: SqliteTransactionMode = 'write') => {
          await target.execute(beginStatement(mode));
          return new EmulatedTransaction(target);
        };
      }
      // Read off `target` directly so accessors touching private fields work.
      const value = Reflect.get(target, prop, target);
      // Preserve `this` for methods that touch private fields (#db etc.).
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
