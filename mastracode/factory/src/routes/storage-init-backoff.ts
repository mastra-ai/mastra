/** Init is a full table scan and callers run per request and per model call, so a failure retries at most this often. */
const INIT_RETRY_MS = 15_000;
const failedInitAt = new WeakMap<object, number>();
const lastReportedInitError = new WeakMap<object, unknown>();

/**
 * Whether a storage domain is ready, retrying a failed init at most every 15 seconds.
 * Callers degrade instead of failing, so the logged `unavailable` line is the only trace of why.
 */
export async function ensureReadyWithBackoff(
  storage: { ensureReady(): Promise<void> },
  unavailable: string,
): Promise<boolean> {
  const failedAt = failedInitAt.get(storage);
  if (failedAt !== undefined && Date.now() - failedAt < INIT_RETRY_MS) return false;
  try {
    await storage.ensureReady();
  } catch (error) {
    failedInitAt.set(storage, Date.now());
    if (error !== lastReportedInitError.get(storage)) {
      lastReportedInitError.set(storage, error);
      console.error(`[factory] ${unavailable}:`, error);
    }
    return false;
  }
  return true;
}
