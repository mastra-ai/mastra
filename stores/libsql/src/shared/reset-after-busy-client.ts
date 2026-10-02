import type { Client, Transaction, TransactionMode } from '@libsql/client';

function isBusy(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 'SQLITE_BUSY';
}

/**
 * Wraps a pooled local `file:` client so a statement refused with `SQLITE_BUSY`
 * doesn't leave its connection unusable.
 *
 * libsql leaves a write statement whose run failed busy in progress until it is
 * garbage collected (tursodatabase/libsql-js#237). Until then no transaction on
 * that connection can commit ("cannot commit transaction - SQL statements in
 * progress"), and an autocommit write on it stays uncommitted while holding the
 * database's write lock. The pool hands the same connection out again, so
 * retrying the write doesn't help.
 *
 * After a busy failure the wrapper reopens the client's connections, which
 * finalizes the stuck statement. Reopening closes every connection, including
 * borrowed ones, so it waits until no call or transaction made through the
 * wrapper is in flight. Reopened connections start from the pool's connection
 * options, so `afterReset` runs right after to restore any per-connection
 * settings applied after opening. Every other member passes through untouched.
 */
export function resetConnectionsAfterBusy(client: Client, { afterReset }: { afterReset?: () => void } = {}): Client {
  let inFlight = 0;
  let stale = false;

  const settle = () => {
    inFlight--;
    if (!stale || inFlight > 0 || client.closed) return;
    stale = false;
    // Reopens the pool synchronously for local clients.
    client.reconnect();
    afterReset?.();
  };

  const noteBusy = (error: unknown) => {
    if (isBusy(error)) stale = true;
  };

  const run = async <T>(call: () => Promise<T>): Promise<T> => {
    inFlight++;
    try {
      return await call();
    } catch (error) {
      noteBusy(error);
      throw error;
    } finally {
      settle();
    }
  };

  const transaction = async (
    open: (mode?: TransactionMode) => Promise<Transaction>,
    mode?: TransactionMode,
  ): Promise<Transaction> => {
    inFlight++;
    let tx: Transaction;
    try {
      tx = await open(mode);
    } catch (error) {
      noteBusy(error);
      settle();
      throw error;
    }

    // commit, rollback and close each return the connection to the pool, even when they fail.
    let ended = false;
    const end = () => {
      if (ended) return;
      ended = true;
      settle();
    };

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
              } catch (error) {
                noteBusy(error);
                throw error;
              }
            };
          }
          case 'commit':
          case 'rollback': {
            const method = Reflect.get(target, prop) as () => Promise<void>;
            return async () => {
              try {
                await method.call(target);
              } catch (error) {
                noteBusy(error);
                throw error;
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

  // Methods are looked up when they're accessed, not when they're called, so a
  // caller that replaces one with a function delegating to the previous one
  // doesn't recurse into itself.
  return new Proxy(client, {
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
          return (...args: unknown[]) => run(() => method.apply(target, args));
        }
        default: {
          const value = Reflect.get(target, prop);
          return typeof value === 'function' ? value.bind(target) : value;
        }
      }
    },
  });
}
