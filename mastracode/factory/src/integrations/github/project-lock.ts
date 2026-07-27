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
 *     transaction-scoped advisory locks) so that *different replicas*
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
  release(): void;
}

const inProcessLocks = new Map<string, Promise<unknown>>();

/**
 * Default hard cap on how long a critical section may run inside the project
 * lock. Prevents an untimed outbound call (sandbox HTTP, GitHub App API, git
 * push, etc.) from pinning both the advisory lock and the pg pool connection
 * indefinitely — the failure mode behind the 2025-07-23 shipyard 30s plateau
 * incident. Callers can override per call via `timeoutMs`.
 */
export const DEFAULT_PROJECT_LOCK_TIMEOUT_MS = 60_000;

/** Thrown when the critical section under `withProjectLock` exceeds the timeout. */
export class ProjectLockTimeoutError extends Error {
  readonly key: string;
  readonly timeoutMs: number;
  constructor(key: string, timeoutMs: number) {
    super(`Project lock critical section for "${key}" exceeded ${timeoutMs}ms`);
    this.name = 'ProjectLockTimeoutError';
    this.key = key;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Race `fn()` against a timeout, throwing `ProjectLockTimeoutError` if the
 * timeout fires first. `fn()` receives an `AbortSignal` so it can (optionally)
 * abort in-flight outbound I/O when the timeout trips. If `fn()` ignores the
 * signal it will still resolve/reject eventually — but the caller sees the
 * timeout error immediately, which is what lets the outer lock wrapper roll
 * back and release the connection.
 */
async function runWithTimeout<T>(key: string, timeoutMs: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abortError = new Promise<never>((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(new ProjectLockTimeoutError(key, timeoutMs)), {
      once: true,
    });
  });
  const work = fn(controller.signal);
  // If `fn` eventually rejects (e.g. its own fetch observes the abort signal
  // after we already rejected via timeout), swallow it — the outer caller
  // has already been rejected with our timeout error and we don't want an
  // unhandled rejection.
  work.catch(() => {});
  try {
    return await Promise.race([work, abortError]);
  } finally {
    clearTimeout(timer);
  }
}

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
export function withProjectLock<T>(options: {
  key: string;
  /** Factory storage backend supplying the `withDistributedLock` capability, when available. */
  storage?: FactoryStorage;
  fn: (signal: AbortSignal) => Promise<T>;
  /** Test seam: fake pg pool standing in for the distributed layer. */
  pool?: LockPool;
  /**
   * Hard cap on the critical section. Defaults to
   * {@link DEFAULT_PROJECT_LOCK_TIMEOUT_MS}. On timeout `fn`'s abort signal
   * fires and the outer lock throws `ProjectLockTimeoutError`, releasing the
   * advisory lock + pool connection.
   */
  timeoutMs?: number;
}): Promise<T> {
  const { key, storage, fn, pool, timeoutMs = DEFAULT_PROJECT_LOCK_TIMEOUT_MS } = options;
  const prev = inProcessLocks.get(key) ?? Promise.resolve();
  const run = () => withDbAdvisoryLock({ key, storage, fn, pool, timeoutMs });
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
  fn: (signal: AbortSignal) => Promise<T>;
  pool?: LockPool;
  timeoutMs?: number;
}): Promise<T> {
  const { key, storage, fn, pool, timeoutMs = DEFAULT_PROJECT_LOCK_TIMEOUT_MS } = options;
  if (process.env.MASTRACODE_DISTRIBUTED_LOCK === '0') {
    return runWithTimeout(key, timeoutMs, fn);
  }

  if (pool) return advisoryLockOver(pool, key, timeoutMs, fn);

  if (typeof storage?.withDistributedLock !== 'function') {
    return runWithTimeout(key, timeoutMs, fn);
  }
  // Wrap the backend-provided lock so the critical section is bounded
  // regardless of whether the backend implements its own timeout. The
  // backend still owns lock acquisition/release; we own the timeout on
  // `fn`.
  return storage.withDistributedLock(key, () => runWithTimeout(key, timeoutMs, fn));
}

/** The pg advisory-lock body, kept for the `poolOverride` test seam. */
async function advisoryLockOver<T>(
  pool: LockPool,
  key: string,
  timeoutMs: number,
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const [k1, k2] = hashKey(key);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Blocks until no other transaction holds this advisory key. Auto-released
    // when the transaction ends below.
    await client.query('SELECT pg_advisory_xact_lock($1, $2)', [k1, k2]);
    try {
      const result = await runWithTimeout(key, timeoutMs, fn);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      // COMMIT/ROLLBACK below releases the advisory lock. If the underlying
      // connection is already dead (e.g. Neon killed it after IIT), the
      // rollback throws — we swallow that specifically so the original error
      // reaches the caller.
      try {
        await client.query('ROLLBACK');
      } catch {
        /* connection already gone; nothing to roll back */
      }
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
