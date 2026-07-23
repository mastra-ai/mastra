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

/**
 * Emit a `warn` log when a critical section completes but took longer than
 * this many ms. Catches platform-call regressions (Fleet, sandbox HTTP,
 * GitHub App API, our own storage) before they cascade into the timeout.
 * Tunable via `MASTRACODE_PROJECT_LOCK_SLOW_WARN_MS`.
 */
export const DEFAULT_PROJECT_LOCK_SLOW_WARN_MS = 5_000;

/** Cap on how many named steps we retain per invocation. Cheap ring buffer. */
export const MAX_LOCK_STEPS = 32;

function slowWarnThresholdMs(): number {
  const raw = process.env.MASTRACODE_PROJECT_LOCK_SLOW_WARN_MS;
  if (!raw) return DEFAULT_PROJECT_LOCK_SLOW_WARN_MS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_PROJECT_LOCK_SLOW_WARN_MS;
}

/** One recorded boundary from inside `fn()`. */
export interface LockStepEntry {
  readonly name: string;
  /** ms since the recorder started (i.e. since `fn()` entered). */
  readonly startedAtMs: number;
  /** ms elapsed inside `fn`; `null` if the step never finished (still running when we captured). */
  readonly durationMs: number | null;
  /** `'ok'` if it resolved, `'error'` if it rejected, `'running'` if it never settled. */
  readonly outcome: 'ok' | 'error' | 'running';
}

/**
 * Passed to `fn()` under the lock. Wrap named boundaries with
 * `recorder.step('sandbox.commitAll', () => commitAll(...))` so timeouts and
 * slow-lock warnings can pinpoint which platform call was in flight when the
 * critical section ran long. Cheap: no I/O, just Date.now() bookkeeping.
 */
export interface LockStepRecorder {
  step<T>(name: string, fn: () => Promise<T>): Promise<T>;
  /** Currently-executing step, if any. Useful in tests and diagnostics. */
  readonly currentStep: string | null;
  /** Immutable snapshot of the recorded step history. */
  readonly entries: ReadonlyArray<LockStepEntry>;
}

/**
 * The mutable recorder implementation. Not exported directly — callers only
 * see the `LockStepRecorder` interface (via `fn(signal, recorder)`) or the
 * frozen snapshot on `ProjectLockTimeoutError.steps`.
 */
class MutableLockStepRecorder implements LockStepRecorder {
  private readonly _entries: LockStepEntry[] = [];
  private readonly startedAt = Date.now();
  private _currentStep: string | null = null;

  get currentStep(): string | null {
    return this._currentStep;
  }

  get entries(): ReadonlyArray<LockStepEntry> {
    return this._entries;
  }

  totalMs(): number {
    return Date.now() - this.startedAt;
  }

  async step<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const startedAtMs = Date.now() - this.startedAt;
    const prevStep = this._currentStep;
    this._currentStep = name;
    // Reserve slot up front so a hanging step still shows up in diagnostics.
    // We track the reserved entry by identity, not by index, so the ring
    // buffer's `shift()` cannot silently corrupt our target slot.
    const reserved: LockStepEntry = { name, startedAtMs, durationMs: null, outcome: 'running' };
    this.pushEntry(reserved);
    try {
      const result = await fn();
      this.replaceEntry(reserved, {
        name,
        startedAtMs,
        durationMs: Date.now() - this.startedAt - startedAtMs,
        outcome: 'ok',
      });
      return result;
    } catch (err) {
      this.replaceEntry(reserved, {
        name,
        startedAtMs,
        durationMs: Date.now() - this.startedAt - startedAtMs,
        outcome: 'error',
      });
      throw err;
    } finally {
      this._currentStep = prevStep;
    }
  }

  private pushEntry(entry: LockStepEntry) {
    if (this._entries.length >= MAX_LOCK_STEPS) {
      // Drop oldest entry so the tail (which is what actually caused the
      // slowdown or timeout) is preserved.
      this._entries.shift();
    }
    this._entries.push(entry);
  }

  private replaceEntry(reserved: LockStepEntry, entry: LockStepEntry) {
    const idx = this._entries.indexOf(reserved);
    if (idx >= 0) {
      this._entries[idx] = entry;
    } else {
      // The reserved slot was evicted by the ring buffer. Append the
      // completed version to the tail so the outcome is not lost.
      this.pushEntry(entry);
    }
  }

  /**
   * Snapshot of the current recorder state, safe to attach to an error.
   * Any still-running step is captured as `outcome: 'running'` with a
   * duration reflecting how long it had been running when we snapshotted.
   */
  snapshot(): { steps: ReadonlyArray<LockStepEntry>; currentStep: string | null; totalMs: number } {
    const now = Date.now();
    const steps = this._entries.map(entry =>
      entry.outcome === 'running' ? { ...entry, durationMs: now - this.startedAt - entry.startedAtMs } : entry,
    );
    return { steps: Object.freeze(steps), currentStep: this._currentStep, totalMs: now - this.startedAt };
  }
}

/** Thrown when the critical section under `withProjectLock` exceeds the timeout. */
export class ProjectLockTimeoutError extends Error {
  readonly key: string;
  readonly timeoutMs: number;
  readonly steps: ReadonlyArray<LockStepEntry>;
  readonly currentStep: string | null;
  constructor(
    key: string,
    timeoutMs: number,
    snapshot: { steps: ReadonlyArray<LockStepEntry>; currentStep: string | null } = { steps: [], currentStep: null },
  ) {
    const suffix = snapshot.currentStep
      ? ` (currentStep=${snapshot.currentStep})`
      : snapshot.steps.length > 0
        ? ` (lastStep=${snapshot.steps[snapshot.steps.length - 1]?.name ?? 'unknown'})`
        : '';
    super(`Project lock critical section for "${key}" exceeded ${timeoutMs}ms${suffix}`);
    this.name = 'ProjectLockTimeoutError';
    this.key = key;
    this.timeoutMs = timeoutMs;
    this.steps = snapshot.steps;
    this.currentStep = snapshot.currentStep;
  }
}

/** Optional logger surface — matches the `console.warn` shape by default. */
export interface LockLogger {
  warn(message: string, meta?: Record<string, unknown>): void;
}

const defaultLogger: LockLogger = {
  warn(message, meta) {
    console.warn(message, meta ?? {});
  },
};

/**
 * Race `fn()` against a timeout, throwing `ProjectLockTimeoutError` if the
 * timeout fires first. `fn()` receives an `AbortSignal` so it can (optionally)
 * abort in-flight outbound I/O when the timeout trips. It also receives a
 * `LockStepRecorder` so callers can name their platform-call boundaries; on
 * timeout the recorded steps are attached to the error and on non-timeout
 * completion a slow-lock warn log is emitted when the total exceeds
 * {@link DEFAULT_PROJECT_LOCK_SLOW_WARN_MS}.
 */
async function runWithTimeout<T>(
  key: string,
  timeoutMs: number,
  fn: (signal: AbortSignal, recorder: LockStepRecorder) => Promise<T>,
  logger: LockLogger = defaultLogger,
): Promise<T> {
  const controller = new AbortController();
  const recorder = new MutableLockStepRecorder();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abortError = new Promise<never>((_, reject) => {
    controller.signal.addEventListener(
      'abort',
      () => reject(new ProjectLockTimeoutError(key, timeoutMs, recorder.snapshot())),
      { once: true },
    );
  });
  const work = fn(controller.signal, recorder);
  // If `fn` eventually rejects (e.g. its own fetch observes the abort signal
  // after we already rejected via timeout), swallow it — the outer caller
  // has already been rejected with our timeout error and we don't want an
  // unhandled rejection.
  work.catch(() => {});
  try {
    const result = await Promise.race([work, abortError]);
    const { totalMs, steps } = recorder.snapshot();
    const slowWarn = slowWarnThresholdMs();
    if (slowWarn > 0 && totalMs >= slowWarn) {
      logger.warn(`[project-lock] slow critical section for "${key}" took ${totalMs}ms`, {
        key,
        totalMs,
        thresholdMs: slowWarn,
        steps: steps.map(s => ({ name: s.name, durationMs: s.durationMs, outcome: s.outcome })),
      });
    }
    return result;
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
  fn: (signal: AbortSignal, recorder: LockStepRecorder) => Promise<T>;
  /** Test seam: fake pg pool standing in for the distributed layer. */
  pool?: LockPool;
  /**
   * Hard cap on the critical section. Defaults to
   * {@link DEFAULT_PROJECT_LOCK_TIMEOUT_MS}. On timeout `fn`'s abort signal
   * fires and the outer lock throws `ProjectLockTimeoutError`, releasing the
   * advisory lock + pool connection.
   */
  timeoutMs?: number;
  /** Optional logger override; falls back to `console.warn` for slow-lock warnings. */
  logger?: LockLogger;
}): Promise<T> {
  const { key, storage, fn, pool, timeoutMs = DEFAULT_PROJECT_LOCK_TIMEOUT_MS, logger } = options;
  const prev = inProcessLocks.get(key) ?? Promise.resolve();
  const run = () => withDbAdvisoryLock({ key, storage, fn, pool, timeoutMs, logger });
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
  fn: (signal: AbortSignal, recorder: LockStepRecorder) => Promise<T>;
  pool?: LockPool;
  timeoutMs?: number;
  logger?: LockLogger;
}): Promise<T> {
  const { key, storage, fn, pool, timeoutMs = DEFAULT_PROJECT_LOCK_TIMEOUT_MS, logger } = options;
  if (process.env.MASTRACODE_DISTRIBUTED_LOCK === '0') {
    return runWithTimeout(key, timeoutMs, fn, logger);
  }

  if (pool) return advisoryLockOver(pool, key, timeoutMs, fn, logger);

  if (typeof storage?.withDistributedLock !== 'function') {
    return runWithTimeout(key, timeoutMs, fn, logger);
  }
  // Wrap the backend-provided lock so the critical section is bounded
  // regardless of whether the backend implements its own timeout. The
  // backend still owns lock acquisition/release; we own the timeout on
  // `fn`.
  return storage.withDistributedLock(key, () => runWithTimeout(key, timeoutMs, fn, logger));
}

/** The pg advisory-lock body, kept for the `poolOverride` test seam. */
async function advisoryLockOver<T>(
  pool: LockPool,
  key: string,
  timeoutMs: number,
  fn: (signal: AbortSignal, recorder: LockStepRecorder) => Promise<T>,
  logger?: LockLogger,
): Promise<T> {
  const [k1, k2] = hashKey(key);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Blocks until no other transaction holds this advisory key. Auto-released
    // when the transaction ends below.
    await client.query('SELECT pg_advisory_xact_lock($1, $2)', [k1, k2]);
    try {
      const result = await runWithTimeout(key, timeoutMs, fn, logger);
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
