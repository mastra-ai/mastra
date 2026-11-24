import { AsyncLocalStorage } from 'node:async_hooks';
import type { Client, Transaction, TransactionMode } from '@libsql/client';

function isBusy(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 'SQLITE_BUSY';
}

/**
 * A call or transaction made through the wrapper, which a reset waits for until
 * it ends. Linked to the one still open in its caller's async context, if any.
 */
interface Hold {
  open: boolean;
  outer?: Hold;
}

function firstOpen(hold: Hold | undefined): Hold | undefined {
  while (hold && !hold.open) hold = hold.outer;
  return hold;
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
 * wrapper is in flight. New calls wait for the reset rather than join the calls
 * it waits for, so a client that is never idle still gets reset. A call made
 * while its caller holds an open transaction, or from inside another call,
 * doesn't wait: the reset waits for what its caller holds, so waiting would
 * deadlock. Reopened connections start from the pool's connection options,
 * so `afterReset` runs right after to restore any per-connection settings
 * applied after opening, and calls that waited for the reset go on once it
 * settles, even if it fails. A call waits at most `maxWaitMs` (default 5s, the
 * busy timeout) so a long-held transaction can't stall every later call; after
 * that it goes ahead on the current pool. A transaction SQLite rolled back on its
 * own is released as soon as the failing call returns. It must use the client it was given, not the
 * wrapper: calls through the wrapper would wait for the reset it is part of.
 * Every other member passes through untouched.
 */
export function resetConnectionsAfterBusy(
  client: Client,
  { afterReset, maxWaitMs = 5_000 }: { afterReset?: () => void | Promise<void>; maxWaitMs?: number } = {},
): Client {
  let inFlight = 0;
  // Set from a busy failure until the reset it calls for has run.
  let pendingReset: { done: Promise<void>; finish: () => void } | undefined;
  const holds = new AsyncLocalStorage<Hold>();

  const finishReset = () => {
    const reset = pendingReset;
    pendingReset = undefined;
    reset?.finish();
  };

  const settle = () => {
    inFlight--;
    if (client.closed) return finishReset();
    if (!pendingReset || inFlight > 0) return;
    // Reopens the pool synchronously for local clients.
    client.reconnect();
    if (!afterReset) return finishReset();
    const reset = pendingReset;
    void Promise.resolve()
      .then(afterReset)
      .catch(() => {})
      .finally(() => {
        // close() may have released the waiting calls already.
        if (pendingReset === reset) finishReset();
      });
  };

  const noteBusy = (error: unknown) => {
    if (!isBusy(error) || pendingReset) return;
    let finish!: () => void;
    const done = new Promise<void>(resolve => (finish = resolve));
    pendingReset = { done, finish };
  };

  // Synchronous when nothing is pending, so a call reaches the driver in the same tick as before.
  const enter = (callerHolds: boolean): Promise<void> | void => {
    if (!pendingReset || callerHolds || client.closed) {
      inFlight++;
      return;
    }
    // A hold that outlives its reset (a long transaction, say) must not park every later call,
    // so after maxWaitMs the call goes ahead on the current pool and the reset runs once the hold ends.
    return (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const gaveUp = new Promise<'timeout'>(resolve => (timer = setTimeout(resolve, maxWaitMs, 'timeout')));
      try {
        while (pendingReset && !client.closed) {
          if ((await Promise.race([pendingReset.done, gaveUp])) === 'timeout') break;
        }
      } finally {
        clearTimeout(timer);
      }
      inFlight++;
    })();
  };

  const run = async <T>(call: () => Promise<T>): Promise<T> => {
    const hold: Hold = { open: true, outer: firstOpen(holds.getStore()) };
    const waiting = enter(hold.outer !== undefined);
    if (waiting) await waiting;
    try {
      return await holds.run(hold, call);
    } catch (error) {
      noteBusy(error);
      throw error;
    } finally {
      hold.open = false;
      settle();
    }
  };

  const transaction = (
    open: (mode?: TransactionMode) => Promise<Transaction>,
    mode?: TransactionMode,
  ): Promise<Transaction> => {
    const hold: Hold = { open: true, outer: firstOpen(holds.getStore()) };
    const waiting = enter(hold.outer !== undefined);
    // Marks the caller's async context, which this synchronous call shares, as holding the transaction.
    holds.enterWith(hold);
    return openTransaction(open, mode, hold, waiting);
  };

  const openTransaction = async (
    open: (mode?: TransactionMode) => Promise<Transaction>,
    mode: TransactionMode | undefined,
    hold: Hold,
    waiting: Promise<void> | void,
  ): Promise<Transaction> => {
    let tx: Transaction;
    try {
      if (waiting) await waiting;
      tx = await open(mode);
    } catch (error) {
      hold.open = false;
      noteBusy(error);
      settle();
      throw error;
    }

    // commit, rollback and close each return the connection to the pool, even when they fail.
    const end = () => {
      if (!hold.open) return;
      hold.open = false;
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
                // SQLite rolled the transaction back on its own (e.g. INSERT OR ROLLBACK). The caller
                // may never call rollback or close, so return the connection and release the hold now.
                if (target.closed) {
                  try {
                    target.close();
                  } finally {
                    end();
                  }
                }
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
        case 'close': {
          const method = Reflect.get(target, prop) as () => void;
          return () => {
            try {
              method.call(target);
            } finally {
              // Calls waiting for a reset that can no longer happen go on to fail as closed.
              finishReset();
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
}
