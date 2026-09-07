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
 * gated; WAL readers never observe a partial write and must not queue behind a
 * long-running writer.
 *
 * `:memory:` databases and embedded replicas get a single pooled connection
 * instead; see `shared/single-connection-client.ts`, which gates *all* calls
 * (reads included) behind open transactions for those clients.
 */
const clientWriteChains = new WeakMap<SqliteClient, Promise<unknown>>();

/**
 * Runs `fn` after every previously-enqueued write on `client` has settled, and
 * returns its result. The chain advances regardless of whether `fn` resolves or
 * rejects, so one failed write never wedges the queue.
 */
export function withClientWriteLock<T>(client: SqliteClient, fn: () => Promise<T>): Promise<T> {
  const previous = clientWriteChains.get(client) ?? Promise.resolve();
  const result = previous.then(fn, fn);
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
