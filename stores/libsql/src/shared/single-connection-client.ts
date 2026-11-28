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
  return isInMemoryDatabaseUrl(url) || Boolean(syncUrl);
}

const URL_PARTS = /^(?<scheme>[A-Za-z][A-Za-z.+-]*):(?<authority>\/\/[^/?#]*)?(?<path>[^?#]*)/su;

/**
 * Whether `@libsql/client` opens `url` as an in-memory database: the url is `:memory:`, or a
 * `file:` url without an authority whose percent-decoded path, before any query, is `:memory:` or
 * starts with `:memory:?`. `file::memory:?cache=shared`, `file:%3Amemory%3A` and
 * `file::memory:%3Fcache=shared` are in memory; `file:my%3Amemory%3A.db` is a file.
 */
export function isInMemoryDatabaseUrl(url: string): boolean {
  if (url === ':memory:') return true;
  const parts = URL_PARTS.exec(url)?.groups;
  if (!parts || parts.scheme!.toLowerCase() !== 'file' || parts.authority !== undefined) return false;
  let path = parts.path!;
  try {
    path = decodeURIComponent(path);
  } catch {
    // A malformed escape sequence: compare the path as written.
  }
  return path === ':memory:' || path.startsWith(':memory:?');
}

/**
 * Wraps a single-connection client so client calls queue behind open
 * transactions rather than failing with `TRANSACTION_ACTIVE`.
 *
 * `transaction()` takes the gate and releases it when the transaction commits,
 * rolls back, or closes. `execute`, `batch`, `executeMultiple`, `migrate`, and `sync`
 * wait for the gate to be free before running but do not hold it — the driver
 * executes them synchronously on the connection, so they cannot interleave
 * with each other. Every other member passes through untouched.
 *
 * Callers must not issue client calls from inside their own open transaction
 * (use `tx.execute`); such a call would wait for the transaction it is part of.
 */
export function gateSingleConnectionClient(client: Client): Client {
  let gate: Promise<void> = Promise.resolve();

  const waitForGate = <T>(run: () => Promise<T>): Promise<T> => gate.then(run, run);

  const transaction = async (mode?: TransactionMode): Promise<Transaction> => {
    let release!: () => void;
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
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

    return new Proxy(tx, {
      get(target, prop) {
        if (prop === 'commit' || prop === 'rollback') {
          return async () => {
            try {
              await (target[prop] as () => Promise<void>).call(target);
            } finally {
              release();
            }
          };
        }
        if (prop === 'close') {
          return () => {
            try {
              target.close();
            } finally {
              release();
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
        default: {
          const value = Reflect.get(target, prop);
          return typeof value === 'function' ? value.bind(target) : value;
        }
      }
    },
  });
}
