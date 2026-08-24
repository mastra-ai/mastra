import type { SqliteClient } from './client';

/**
 * Per-client write serialization.
 *
 * `@libsql/client` backs a local (`file:`/`:memory:`) database with a single
 * underlying connection. An interactive `client.transaction('write')` issues a
 * `BEGIN` and then yields to the event loop on every `await tx.execute(...)`.
 * Any autocommit write (`client.execute`/`client.batch`) issued on the same
 * client during that window runs on the same connection — so it is swept into
 * the still-open transaction and is committed or rolled back with it, instead
 * of as its own statement. Two concurrent interactive transactions collide the
 * same way ("cannot start a transaction within a transaction").
 *
 * This is dormant under the default engine but the evented engine runs many
 * concurrent workflow snapshot writes per agent run, so a write issued by an
 * unrelated domain (e.g. creating a dataset experiment) can silently vanish.
 *
 * Serializing every write on a given client closes that window: writes — both
 * autocommit statements and full interactive transactions — run one at a time,
 * so none can interleave with an open transaction. Reads are intentionally not
 * gated; WAL readers never observe a partial write and must not queue behind a
 * long-running writer.
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
