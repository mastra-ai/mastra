import type { Client, Transaction, TransactionMode } from '@libsql/client';

/**
 * Whether `@libsql/client` backs this database with exactly one connection.
 *
 * An in-memory database exists only on the connection that opened it, and each
 * embedded-replica connection carries its own sync state, so `@libsql/client`
 * (>= 0.18.0) gives both a pool of one. Any `execute`/`batch` issued while an
 * interactive `transaction()` holds that connection is rejected immediately
 * with `TRANSACTION_ACTIVE` instead of waiting for the transaction to settle.
 */
export function isSingleConnectionDatabase({ url, syncUrl }: { url: string; syncUrl?: string }): boolean {
  return url.includes(':memory:') || Boolean(syncUrl);
}

/**
 * Wraps a single-connection client so client calls queue behind open
 * transactions rather than failing with `TRANSACTION_ACTIVE`.
 *
 * `transaction()` takes the gate and releases it when the transaction commits,
 * rolls back, or closes. The driver can also settle a transaction under the caller:
 * closing the client ends every transaction on that client, including one that has not
 * finished opening, and SQLite rolls one back when a statement fails. Neither reaches
 * the proxy, so the gate is freed when the client closes, when a statement settles the
 * transaction, and before anything waits on it, in case some other path settled it.
 * `execute`, `batch`, `executeMultiple`,
 * `migrate`, and `sync` wait for the gate to be free before running but do not
 * hold it — the driver executes them synchronously on the connection, so they
 * cannot interleave with each other. Every other member passes through untouched.
 *
 * Callers must not issue client calls from inside their own open transaction
 * (use `tx.execute`); such a call would wait for the transaction it is part of.
 */
export function gateSingleConnectionClient(client: Client): Client {
  let gate: Promise<void> = Promise.resolve();
  /**
   * The transaction holding the gate, from the moment it opens. A transaction the driver
   * settled holds no connection, so it must not keep the gate.
   */
  let holder: { tx: Transaction; release: () => void } | null = null;
  /**
   * Releases taken by transactions that are queued or still opening. The gate is a promise chain, so
   * one of these already blocks later calls even though its transaction has no holder yet to release
   * it — which is what closing the client has to free.
   */
  const pendingHolds = new Set<() => void>();

  const releaseHolder = (): void => {
    const held = holder;
    holder = null;
    held?.release();
  };

  /**
   * Frees a gate whose transaction the driver settled itself, without `commit`, `rollback` or
   * `close` reaching the proxy. Closing a transaction hands its connection back when the driver
   * has already ended it, which matters for the one SQLite rolled back on a statement error: that
   * connection stays borrowed until then, and a pool of one has no other to serve the next call.
   */
  const releaseSettledHolder = (): void => {
    const held = holder;
    if (!held?.tx.closed) return;
    try {
      held.tx.close();
    } catch {
      // Already settled, so there is no connection left to hand back.
    }
    releaseHolder();
  };

  const waitForGate = <T>(run: () => Promise<T>): Promise<T> => {
    // Backstop for a path that ends a transaction without the wrapper seeing it, so that a
    // waiting call never queues behind a transaction the driver has already settled.
    releaseSettledHolder();
    return gate.then(run, run);
  };

  const transaction = async (mode?: TransactionMode): Promise<Transaction> => {
    releaseSettledHolder();
    let release!: () => void;
    const held = new Promise<void>(resolve => {
      release = () => {
        pendingHolds.delete(release);
        resolve();
      };
    });
    pendingHolds.add(release);
    const previous = gate;
    gate = previous.then(
      () => held,
      () => held,
    );
    await previous.then(
      () => undefined,
      () => undefined,
    );

    let tx: Transaction;
    try {
      tx = await client.transaction(mode);
    } catch (error) {
      release();
      throw error;
    }
    holder = { tx, release };

    return new Proxy(tx, {
      get(target, prop) {
        if (prop === 'execute' || prop === 'batch' || prop === 'executeMultiple') {
          const run = Reflect.get(target, prop);
          if (typeof run !== 'function') return run;
          return async (...args: unknown[]) => {
            try {
              return await (run as (...a: unknown[]) => Promise<unknown>).apply(target, args);
            } finally {
              // A statement can end the transaction on its own: SQLite rolls it back when one
              // fails, and the caller may never roll back or close it afterwards.
              if (holder?.tx === target) releaseSettledHolder();
            }
          };
        }
        if (prop === 'commit' || prop === 'rollback') {
          return async () => {
            try {
              await (target[prop] as () => Promise<void>).call(target);
            } finally {
              if (holder?.tx === target) releaseHolder();
            }
          };
        }
        if (prop === 'close') {
          return () => {
            try {
              target.close();
            } finally {
              if (holder?.tx === target) releaseHolder();
            }
          };
        }
        const value = Reflect.get(target, prop);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  };

  return new Proxy(client, {
    get(target, prop) {
      switch (prop) {
        case 'transaction':
          return transaction;
        case 'execute':
        case 'batch':
        case 'executeMultiple':
        case 'migrate':
        case 'sync':
          return (...args: unknown[]) =>
            waitForGate(() => (target[prop] as (...a: unknown[]) => Promise<unknown>).apply(target, args));
        case 'close': {
          const close = Reflect.get(target, prop) as () => void;
          return () => {
            try {
              close.call(target);
            } finally {
              // The client is closed for good, so every transaction on it is over and no call can
              // settle one through the proxy: free the holder and every transaction that is queued
              // or still opening, or anything already waiting behind them waits forever.
              releaseSettledHolder();
              releaseHolder();
              for (const release of [...pendingHolds]) release();
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
