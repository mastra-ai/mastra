import { resolve } from 'node:path';
import type { Client, Transaction, TransactionMode } from '@libsql/client';

interface OpenTransaction {
  owner: Client;
  done: Promise<void>;
}

/** Interactive transactions open in this process, per database file. */
const openTransactions = new Map<string, Set<OpenTransaction>>();

/** The database file a local `file:` url points at, or `undefined` for anything else. */
export function localDatabaseFileKey(url: string): string | undefined {
  if (!url.startsWith('file:') || url.includes(':memory:')) return undefined;
  const path = url.slice('file:'.length).split('?')[0]!;
  return path ? resolve(path.replace(/^\/\/(?=\/)/, '')) : undefined;
}

/**
 * Wraps a local `file:` client so its calls wait for interactive transactions
 * that other clients in this process hold open on the same database file,
 * instead of blocking the thread.
 *
 * `@libsql/client` runs local statements synchronously. When one client holds
 * a write transaction open across an `await` and another client writes the same
 * file, SQLite's busy handler spins on the event loop's only thread for
 * `busy_timeout`, so the transaction holding the lock can't resume and the write
 * fails with `SQLITE_BUSY`. Waiting lets the transaction finish first.
 *
 * Only calls on other clients wait; a client already orders its own writes
 * behind its transactions (see `withClientWriteLock`). A call waits at most
 * `maxWaitMs` (the busy timeout), then goes ahead as it would without the gate,
 * so code that awaits another client from inside its own transaction can't hang.
 * Clients in other processes are unaffected and still rely on `busy_timeout`.
 */
export function gateLocalFileClient(client: Client, key: string, { maxWaitMs = 5_000 } = {}): Client {
  let gated!: Client;

  const othersOpen = () => [...(openTransactions.get(key) ?? [])].filter(open => open.owner !== gated);

  // Synchronous when no other client holds a transaction, so a call reaches the driver in the same tick as before.
  // Resolves `true` once no other transaction is open, `false` if `maxWaitMs` passed first.
  const waitForOthers = (): Promise<boolean> | void => {
    if (othersOpen().length === 0) return;
    return (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const gaveUp = new Promise<'timeout'>(r => (timer = setTimeout(r, maxWaitMs, 'timeout')));
      try {
        // Another transaction can open while this call waits, so wait until none is open.
        for (let open = othersOpen(); open.length > 0; open = othersOpen()) {
          if ((await Promise.race([Promise.all(open.map(o => o.done)), gaveUp])) === 'timeout') return false;
        }
        return true;
      } finally {
        clearTimeout(timer);
      }
    })();
  };

  const call = <T>(run: () => Promise<T>): Promise<T> => {
    const waiting = waitForOthers();
    return waiting ? waiting.then(run) : run();
  };

  const transaction = async (open: (mode?: TransactionMode) => Promise<Transaction>, mode?: TransactionMode) => {
    // Waiters released by the same transaction resume one by one; recheck right before registering
    // so the first to resume holds the file and the others go back to waiting for it.
    const deadline = Date.now() + maxWaitMs;
    for (let waiting = waitForOthers(); waiting; waiting = Date.now() < deadline ? waitForOthers() : undefined) {
      if (!(await waiting)) break;
    }

    let finish!: () => void;
    const entry: OpenTransaction = { owner: gated, done: new Promise<void>(r => (finish = r)) };
    let set = openTransactions.get(key);
    if (!set) openTransactions.set(key, (set = new Set()));
    set.add(entry);
    const end = () => {
      if (!set!.delete(entry)) return;
      if (set!.size === 0 && openTransactions.get(key) === set) openTransactions.delete(key);
      finish();
    };

    let tx: Transaction;
    try {
      tx = await open(mode);
    } catch (error) {
      end();
      throw error;
    }
    return new Proxy(tx, {
      get(target, prop) {
        switch (prop) {
          case 'execute':
          case 'batch':
          case 'executeMultiple': {
            const method = Reflect.get(target, prop) as (...a: unknown[]) => Promise<unknown>;
            return async (...args: unknown[]) => {
              try {
                return await method.apply(target, args);
              } finally {
                // SQLite rolled the transaction back on its own; the caller may never close it.
                if (target.closed) end();
              }
            };
          }
          case 'commit':
          case 'rollback': {
            const method = Reflect.get(target, prop) as () => Promise<void>;
            return async () => {
              try {
                await method.call(target);
              } finally {
                end();
              }
            };
          }
          case 'close': {
            const method = Reflect.get(target, prop) as () => void;
            return () => {
              try {
                method.call(target);
              } finally {
                end();
              }
            };
          }
          default: {
            const value = Reflect.get(target, prop);
            return typeof value === 'function' ? value.bind(target) : value;
          }
        }
      },
    });
  };

  gated = new Proxy(client, {
    get(target, prop) {
      switch (prop) {
        case 'transaction': {
          const open = Reflect.get(target, prop) as Client['transaction'];
          return (mode?: TransactionMode) => transaction(open.bind(target), mode);
        }
        case 'execute':
        case 'batch':
        case 'executeMultiple':
        case 'migrate': {
          const method = Reflect.get(target, prop) as (...a: unknown[]) => Promise<unknown>;
          return (...args: unknown[]) => call(() => method.apply(target, args));
        }
        default: {
          const value = Reflect.get(target, prop);
          return typeof value === 'function' ? value.bind(target) : value;
        }
      }
    },
  });
  return gated;
}

/** Applies {@link gateLocalFileClient} when `url` is a local database file; returns `client` otherwise. */
export function gateIfLocalFile(client: Client, url: string, options?: { maxWaitMs?: number }): Client {
  const key = localDatabaseFileKey(url);
  return key ? gateLocalFileClient(client, key, options) : client;
}
