import { omDebug } from './debug';

/**
 * Retry schedule for storage lock contention. Exported so tests can shrink it.
 *
 * Pre-jitter backoff: 100ms, 200ms, 400ms, 800ms. Stores such as LibSQL already
 * wait out their own `busy_timeout` before reporting a lock, so each retry gives
 * the competing writer another full window.
 *
 * @internal
 */
export const STORAGE_RETRY_CONFIG = {
  maxRetries: 4,
  initialDelayMs: 100,
};

/**
 * Lock-contention codes where the database rejected the statement or rolled back
 * the transaction, so nothing was committed and re-running the call is safe:
 * SQLite busy/locked (including extended codes such as `SQLITE_BUSY_SNAPSHOT`),
 * and Postgres serialization failure, deadlock, and lock-not-available.
 */
const SQLITE_LOCK_CODE = /^SQLITE_(BUSY|LOCKED)/;
const POSTGRES_LOCK_CODES = new Set(['40001', '40P01', '55P03']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Returns true when the error (or anything in its `cause`/`error` chain) is a
 * storage lock-contention error.
 *
 * @internal
 */
export function isStorageLockError(error: unknown): boolean {
  const seen = new Set<object>();

  function visit(candidate: unknown): boolean {
    if (!isRecord(candidate) || seen.has(candidate)) return false;
    seen.add(candidate);
    const code = candidate.code;
    if (typeof code === 'string' && (SQLITE_LOCK_CODE.test(code) || POSTGRES_LOCK_CODES.has(code))) return true;
    const message = typeof candidate.message === 'string' ? candidate.message : '';
    if (SQLITE_LOCK_CODE.test(message) || message.includes('database is locked')) return true;
    return visit(candidate.cause) || visit(candidate.error);
  }

  return visit(error);
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return isRecord(value) && typeof value.then === 'function';
}

function backoff(attempt: number): Promise<void> {
  const base = STORAGE_RETRY_CONFIG.initialDelayMs * 2 ** attempt;
  const jittered = base * (0.8 + Math.random() * 0.4);
  return new Promise(resolve => setTimeout(resolve, jittered));
}

async function retryOnLock(first: PromiseLike<unknown>, rerun: () => unknown, method: string): Promise<unknown> {
  let pending = first;
  for (let attempt = 0; ; attempt++) {
    try {
      return await pending;
    } catch (error) {
      if (attempt >= STORAGE_RETRY_CONFIG.maxRetries || !isStorageLockError(error)) throw error;
      omDebug(
        `[OM:storage-retry] ${method} hit a storage lock (attempt ${attempt + 1}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      await backoff(attempt);
      pending = rerun() as PromiseLike<unknown>;
    }
  }
}

/**
 * Wrap a storage adapter so async calls that fail on lock contention are retried
 * with backoff. A brief lock (e.g. several processes sharing one SQLite file)
 * would otherwise surface as an observation failure and stop the agent run.
 *
 * @internal
 */
export function withStorageLockRetry<T extends object>(storage: T): T {
  return new Proxy(storage, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        const call = () => Reflect.apply(value, target, args);
        const result = call();
        return isPromiseLike(result) ? retryOnLock(result, call, String(prop)) : result;
      };
    },
  });
}
