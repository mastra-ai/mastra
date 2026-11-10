import type { Pool } from 'pg';

/**
 * A pool-level `error` listener only covers *idle* clients: pg hands ownership
 * of a client to the borrower for the duration of a checkout and takes its own
 * listener off. So a backend restart or network blip that lands on a client
 * mid-transaction reaches an emitter with no listener, and Node escalates that
 * to an uncaughtException that kills the process — the pool handler logs the
 * idle siblings and the borrowed one still brings everything down.
 *
 * Attach a listener once per physical connection instead. `connect` fires when
 * the pool establishes a client, so the client stays covered for its whole life
 * and there is nothing to remove on release.
 *
 * That listener outlives the checkout, so it also sees the failures the pool is
 * already reporting through its own idle listener. Follow `acquire`/`release`
 * to tell the two apart and stay quiet while the client is idle — otherwise one
 * dropped connection is announced twice, the second time as the wrong thing.
 *
 * The pool still discards the failed connection; this only keeps the failure
 * reportable instead of fatal.
 */
export function guardCheckedOutClientErrors(pool: Pool, warn = console.warn): void {
  // pg emits 'connect' from inside the acquire path, so a client is borrowed
  // from the moment it exists.
  const borrowed = new WeakSet<object>();

  pool.on('connect', client => {
    borrowed.add(client);
    client.on('error', err => {
      if (!borrowed.has(client)) return; // idle: the pool's own listener reports this one
      warn(
        `PostgreSQL: client error while checked out (the pool discards this connection): ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  });
  pool.on('acquire', client => borrowed.add(client));
  pool.on('release', (_err, client) => borrowed.delete(client));
}
