import { realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';

const databaseWriteChains = new Map<string, Promise<void>>();

export async function getLocalFileDatabaseKey({
  url,
  syncUrl,
  cwd,
}: {
  url: string;
  syncUrl?: string;
  cwd: string;
}): Promise<string | undefined> {
  if (!url.startsWith('file:') || url.includes(':memory:') || syncUrl) {
    return undefined;
  }

  const uriPath = url.slice('file:'.length).split(/[?#]/, 1)[0]!;
  const decodedPath = decodeURIComponent(uriPath);
  const absolutePath = isAbsolute(decodedPath) ? decodedPath : resolve(cwd, decodedPath);

  try {
    return await realpath(absolutePath);
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
      throw error;
    }
  }

  return join(await realpath(dirname(absolutePath)), basename(absolutePath));
}

export function withLocalFileDatabaseWriteLock<T>(key: string | undefined, fn: () => Promise<T>): Promise<T> {
  if (!key) {
    return fn();
  }

  const previous = databaseWriteChains.get(key) ?? Promise.resolve();
  const result = previous.then(fn, fn);
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  databaseWriteChains.set(key, tail);

  void tail.then(() => {
    if (databaseWriteChains.get(key) === tail) {
      databaseWriteChains.delete(key);
    }
  });

  return result;
}

/**
 * Wraps a local-file client so interactive transactions hold the path-keyed
 * write lock for their entire lifetime — acquisition through commit, rollback,
 * or close.
 *
 * `LibSQLVector` already serializes its mutations behind the same path-keyed
 * chain (see `executeMutation`). Without this wrapper, a `LibSQLStore`
 * transaction on the same database file can begin while a vector mutation
 * holds the file write lock: the interrupted `BEGIN IMMEDIATE` leaves the
 * pooled connection with an active statement, and every later `COMMIT` on that
 * connection fails with `SQLITE_BUSY: cannot commit transaction - SQL
 * statements in progress`. Because the pool hands connections out LIFO, the
 * retry loop keeps re-acquiring the poisoned connection and the failure
 * becomes deterministic.
 *
 * Non-transactional calls pass through untouched: autocommit writes cannot
 * wedge a connection this way, and reads must not queue behind writers.
 */
export function gateFileTransactionClient<
  Tx extends { commit(): Promise<unknown>; rollback(): Promise<unknown>; close(): unknown },
  C extends { transaction(mode?: never): Promise<Tx> },
>(client: C, databaseKey: Promise<string | undefined>): C {
  // Bind before shadowing: `acquire` must reach the original prototype/own
  // method, not itself. Clients without an interactive-transaction method
  // (nothing to gate) keep their identity untouched.
  if (typeof client.transaction !== 'function') return client;
  const openTransaction = client.transaction.bind(client) as (mode?: never) => Promise<Tx>;
  const acquire = async (mode?: never): Promise<Tx> => {
    const key = await databaseKey;
    if (!key) return openTransaction(mode);

    const previous = databaseWriteChains.get(key) ?? Promise.resolve();
    let release!: () => void;
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    const tail = previous.then(
      () => held,
      () => held,
    );
    databaseWriteChains.set(key, tail);
    void tail.then(() => {
      if (databaseWriteChains.get(key) === tail) databaseWriteChains.delete(key);
    });
    await previous.then(
      () => undefined,
      () => undefined,
    );

    let tx: Tx;
    try {
      tx = await openTransaction(mode);
    } catch (error) {
      release();
      throw error;
    }

    const settle =
      <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
      async (...args: A): Promise<R> => {
        try {
          return await fn(...args);
        } finally {
          release();
        }
      };

    return new Proxy(tx, {
      get(target, prop, receiver) {
        if (prop === 'commit') return settle(target.commit.bind(target));
        if (prop === 'rollback') return settle(target.rollback.bind(target));
        if (prop === 'close')
          return (...args: unknown[]) => {
            try {
              return (target.close as (...a: unknown[]) => unknown)(...args);
            } finally {
              release();
            }
          };
        const value = Reflect.get(target, prop);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  };

  // Override `transaction` as an own property instead of wrapping the client
  // in a Proxy. `LibSQLStore` promises local file DBs the pooled client as-is:
  // callers legitimately compare the store's client to the one they created,
  // and every other method — including private-field access on the raw client —
  // stays untouched. The store constructs this client exclusively, so the
  // shadowing never leaks to another consumer.
  Object.defineProperty(client, 'transaction', {
    value: acquire,
    writable: true,
    enumerable: false,
    configurable: true,
  });
  return client;
}
