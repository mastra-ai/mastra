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
 *     same-replica callers stay cheap and never touch Postgres for ordering.
 *  2. A **Postgres transaction-level advisory lock** (`pg_advisory_xact_lock`)
 *     so that *different replicas* operating on the same key also serialize.
 *     Transaction-scoped advisory locks release automatically when the
 *     transaction ends (commit, rollback, or connection loss), so a crashed
 *     replica can never hold the lock forever.
 *
 * Set `MASTRACODE_DISTRIBUTED_LOCK=0` to disable the Postgres layer (local dev,
 * single replica) and fall back to the pure in-process mutex.
 */

import { createHash } from 'node:crypto';
import { getAppDbPool } from './db';

/** Minimal pg pool surface used by the distributed lock (for testability). */
export interface LockPool {
  connect(): Promise<LockClient>;
}
export interface LockClient {
  query(sql: string, params?: unknown[]): Promise<unknown>;
  release(): void;
}

const inProcessLocks = new Map<string, Promise<unknown>>();

/** True when the Postgres advisory-lock layer should be used. */
export function isDistributedLockEnabled(): boolean {
  return process.env.MASTRACODE_DISTRIBUTED_LOCK !== '0';
}

/**
 * Hash a lock key into the two signed 32-bit integers that the two-arg form of
 * `pg_advisory_xact_lock(int4, int4)` expects. Using two int4 args (rather than
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
 * Postgres transaction-scoped advisory lock (unless disabled).
 *
 * The in-process chain swallows rejections so one failed operation does not
 * poison the lock for subsequent callers.
 */
export function withProjectLock<T>(key: string, fn: () => Promise<T>, poolOverride?: LockPool): Promise<T> {
  const prev = inProcessLocks.get(key) ?? Promise.resolve();
  const run = () => withDbAdvisoryLock(key, fn, poolOverride);
  const next = prev.then(run, run);
  inProcessLocks.set(
    key,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next;
}

/**
 * Acquire only the Postgres transaction-scoped advisory lock for `key` and run
 * `fn` inside that transaction. This is the cross-replica serialization layer;
 * `withProjectLock` wraps it with an in-process mutex for same-replica callers.
 * Exposed so the cross-replica behavior can be tested without the in-process
 * chain (each replica has its own in-process state but shares one Postgres).
 */
export async function withDbAdvisoryLock<T>(key: string, fn: () => Promise<T>, poolOverride?: LockPool): Promise<T> {
  if (!isDistributedLockEnabled()) {
    return fn();
  }

  const pool: LockPool = poolOverride ?? (getAppDbPool() as unknown as LockPool);
  const [k1, k2] = hashKey(key);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Blocks until no other transaction holds this advisory key. Auto-released
    // when the transaction ends below.
    await client.query('SELECT pg_advisory_xact_lock($1, $2)', [k1, k2]);
    try {
      const result = await fn();
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } finally {
    client.release();
  }
}

/** For tests: clear the in-process lock chains. */
export function __resetProjectLocksForTests(): void {
  inProcessLocks.clear();
}
