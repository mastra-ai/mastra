/**
 * Per-(project, user) lock that serializes the worktree/commit/push/PR flows.
 *
 * The push/PR flows temporarily rewrite the sandbox git remote to a tokenized
 * URL and scrub it again in a `finally`; two concurrent operations on the same
 * `(project, user)` sandbox could interleave those rewrites and leak a tokenized
 * remote. Serializing per `(project, user)` removes that race.
 *
 * There are two layers:
 *  1. An **in-process** promise-chain mutex keyed by the lock key, so repeated
 *     same-replica callers stay cheap and never touch the database for ordering.
 *  2. The factory storage backend's **`withDistributedLock` capability** (pg:
 *     session-scoped advisory locks) so that *different replicas*
 *     operating on the same key also serialize. Backends without the
 *     capability (libsql: local single-writer) fall back to the in-process
 *     mutex alone — correct for single-replica deployments.
 *
 * Set `MASTRACODE_DISTRIBUTED_LOCK=0` to force-disable the distributed layer
 * (local dev, single replica) and fall back to the pure in-process mutex.
 */

import { createHash } from 'node:crypto';

import type { FactoryStorage } from '@mastra/core/storage';

/** Minimal pg pool surface used by the distributed lock (for testability). */
export interface LockPool {
  connect(): Promise<LockClient>;
}
export interface LockClient {
  query(sql: string, params?: unknown[]): Promise<unknown>;
  release(error?: Error): void;
}

const inProcessLocks = new Map<string, Promise<unknown>>();

/**
 * True when the cross-replica lock layer should be used: not force-disabled
 * via env, and the factory storage backend exposes the
 * `withDistributedLock` capability.
 */
export function isDistributedLockEnabled(storage: FactoryStorage | undefined): boolean {
  if (process.env.MASTRACODE_DISTRIBUTED_LOCK === '0') return false;
  return typeof storage?.withDistributedLock === 'function';
}

/**
 * Hash a lock key into the two signed 32-bit integers that the two-arg form of
 * `pg_advisory_lock(int4, int4)` expects. Using two int4 args (rather than
 * one int8) keeps the key inside the GitHub-feature advisory-lock namespace and
 * avoids collisions with other single-int8 advisory locks.
 */
export function hashKey(key: string): [number, number] {
  const digest = createHash('sha256').update(key).digest();
  // Read two independent 32-bit halves as signed int4 values.
  const a = digest.readInt32BE(0);
  const b = digest.readInt32BE(4);
  return [a, b];
}

/**
 * Run `fn` while holding the lock for `key`. Same-replica callers serialize via
 * the in-process mutex; cross-replica callers additionally serialize via a
 * Postgres session-scoped advisory lock (unless disabled).
 *
 * The in-process chain swallows rejections so one failed operation does not
 * poison the lock for subsequent callers.
 */
export function withProjectLock<T>(options: {
  key: string;
  /** Factory storage backend supplying the `withDistributedLock` capability, when available. */
  storage?: FactoryStorage;
  fn: () => Promise<T>;
  /** Test seam: fake pg pool standing in for the distributed layer. */
  pool?: LockPool;
}): Promise<T> {
  const { key, storage, fn, pool } = options;
  const prev = inProcessLocks.get(key) ?? Promise.resolve();
  const run = () => withDbAdvisoryLock({ key, storage, fn, pool });
  const next = prev.then(run, run);
  const tail = next.then(
    () => undefined,
    () => undefined,
  );
  inProcessLocks.set(key, tail);
  // Drop the entry once this operation settles, but only if no later caller has
  // chained onto it in the meantime — otherwise we'd evict a live waiter's tail.
  // This keeps the map from growing unbounded across many distinct project keys.
  void tail.then(() => {
    if (inProcessLocks.get(key) === tail) {
      inProcessLocks.delete(key);
    }
  });
  return next;
}

/**
 * Acquire only the cross-replica lock for `key` and run `fn` under it. This is
 * the distributed serialization layer; `withProjectLock` wraps it with an
 * in-process mutex for same-replica callers. Delegates to the factory storage
 * backend's `withDistributedLock` capability; backends without it (or a
 * force-disabled env) run `fn` directly — the in-process mutex still holds.
 *
 * `poolOverride` keeps the pg advisory-lock path directly testable with a fake
 * pool (each simulated replica has its own in-process state but shares one
 * database).
 */
export async function withDbAdvisoryLock<T>(options: {
  key: string;
  storage?: FactoryStorage;
  fn: () => Promise<T>;
  pool?: LockPool;
}): Promise<T> {
  const { key, storage, fn, pool } = options;
  if (process.env.MASTRACODE_DISTRIBUTED_LOCK === '0') {
    return fn();
  }

  if (pool) return advisoryLockOver(pool, key, fn);

  if (typeof storage?.withDistributedLock !== 'function') {
    return fn();
  }
  return storage.withDistributedLock(key, fn);
}

/** The pg advisory-lock body, kept for the `poolOverride` test seam. */
async function advisoryLockOver<T>(pool: LockPool, key: string, fn: () => Promise<T>): Promise<T> {
  const [k1, k2] = hashKey(key);
  const client = await pool.connect();
  let locked = false;
  try {
    await client.query('SELECT pg_advisory_lock($1, $2)', [k1, k2]);
    locked = true;
    return await fn();
  } finally {
    if (locked) {
      try {
        await client.query('SELECT pg_advisory_unlock($1, $2)', [k1, k2]);
      } catch (error) {
        client.release(error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    }
    client.release();
  }
}

/** For tests: clear the in-process lock chains. */
export function __resetProjectLocksForTests(): void {
  inProcessLocks.clear();
}
