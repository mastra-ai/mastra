/**
 * Init is a full table scan and callers run per request and per model call, so after a failure
 * only one retry runs at a time, in the background, 1 s later and doubling up to 15 s while it keeps failing.
 */
const FIRST_RETRY_MS = 1_000;
const MAX_RETRY_MS = 15_000;

type FailedInit = { error: unknown; at: number; retryAfterMs: number; retrying: boolean };
const failedInits = new WeakMap<object, FailedInit>();
const lastReportedInitError = new WeakMap<object, unknown>();

/**
 * Whether a storage domain is ready. Only the first caller waits on init: after a failure, callers get
 * `false` at once while the retry runs on its own. Callers degrade instead of failing, so the logged
 * `unavailable` line is the only trace of why.
 */
export async function ensureReadyWithBackoff(
  storage: { ensureReady(): Promise<void> },
  unavailable: string,
): Promise<boolean> {
  const failed = failedInits.get(storage);
  if (!failed) return initOnce(storage, unavailable, FIRST_RETRY_MS);
  if (!failed.retrying && Date.now() - failed.at >= failed.retryAfterMs) {
    failed.retrying = true;
    void initOnce(storage, unavailable, Math.min(failed.retryAfterMs * 2, MAX_RETRY_MS));
  }
  return false;
}

/** Why the storage domain's last init failed, while it stays unavailable. */
export function lastInitError(storage: object): unknown {
  return failedInits.get(storage)?.error;
}

async function initOnce(
  storage: { ensureReady(): Promise<void> },
  unavailable: string,
  retryAfterMs: number,
): Promise<boolean> {
  try {
    await storage.ensureReady();
  } catch (error) {
    failedInits.set(storage, { error, at: Date.now(), retryAfterMs, retrying: false });
    if (error !== lastReportedInitError.get(storage)) {
      lastReportedInitError.set(storage, error);
      console.error(`[factory] ${unavailable}:`, error);
    }
    return false;
  }
  failedInits.delete(storage);
  return true;
}
