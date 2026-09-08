import { AsyncLocalStorage } from 'node:async_hooks';
import type { SqliteClient } from './client';

/**
 * Per-client write serialization.
 *
 * `@libsql/client` >= 0.18.0 pools connections for local `file:` databases, but
 * SQLite still admits one writer at a time: an interactive
 * `client.transaction('write')` holds `BEGIN` open across every
 * `await tx.execute(...)`, and any other write on the same database in that
 * window contends on the file lock and can fail with `SQLITE_BUSY` once
 * `busy_timeout` expires.
 *
 * This is dormant under the default engine but the evented engine runs many
 * concurrent workflow snapshot writes per agent run, so a write issued by an
 * unrelated domain (e.g. creating a dataset experiment) can fail spuriously.
 *
 * Serializing every write on a given client closes that window: writes — both
 * autocommit statements and full interactive transactions — run one at a time,
 * so none can interleave with an open transaction. Reads are intentionally not
 * gated for file-backed WAL connections. Single-connection clients are gated
 * at the client boundary, while direct in-memory Knowledge reads use
 * withClientReadLock to share the writer's retained connection.
 */
const clientWriteChains = new WeakMap<SqliteClient, Promise<unknown>>();
const activeWrite = new AsyncLocalStorage<{ client: SqliteClient; active: boolean }>();

// Private in-memory reads share the writer's connection, unlike file-backed WAL reads.
export function withClientReadLock<T>(client: SqliteClient, fn: () => Promise<T>): Promise<T> {
  const current = activeWrite.getStore();
  return current?.active && current.client === client ? fn() : withClientWriteLock(client, fn);
}

/**
 * Runs `fn` after every previously-enqueued write on `client` has settled, and
 * returns its result. The chain advances regardless of whether `fn` resolves or
 * rejects, so one failed write never wedges the queue.
 */
export function withClientWriteLock<T>(client: SqliteClient, fn: () => Promise<T>): Promise<T> {
  const previous = clientWriteChains.get(client) ?? Promise.resolve();
  const run = () => {
    const context = { client, active: true };
    return activeWrite.run(context, async () => {
      try {
        return await fn();
      } finally {
        context.active = false;
      }
    });
  };
  const result = previous.then(run, run);
  // Tail that never rejects so a failed write doesn't poison the chain.
  clientWriteChains.set(
    client,
    result.then(
      () => undefined,
      () => undefined,
    ),
  );
  return result;
}
