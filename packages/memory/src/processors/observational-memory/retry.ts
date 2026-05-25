import { omDebug } from './debug';

/**
 * Retry knobs for the internal OM transport-error retry wrapper.
 * Exported as a mutable object so tests can shrink the backoff schedule
 * without changing public API.
 *
 * With the defaults the per-retry pre-jitter backoff schedule is:
 *   1s, 2s, 4s, 8s, 16s, 32s, 64s, 120s (cap)
 * giving 8 retries / 9 total attempts and ~247s (~4 minutes) of waiting
 * before the final attempt fails. Designed to ride out short provider /
 * network blips without holding the actor turn for much longer than that.
 *
 * @internal
 */
export const RETRY_CONFIG = {
  /** Maximum number of retry *attempts* (total tries = maxRetries + 1). */
  maxRetries: 8,
  /** Initial backoff delay in milliseconds. */
  initialDelayMs: 1_000,
  /** Multiplier applied to the delay after each failed attempt. */
  backoffFactor: 2,
  /** Cap on per-attempt delay (ms). */
  maxDelayMs: 120_000,
  /** Random jitter as a fraction of the computed delay (e.g. 0.2 = ±20%). */
  jitter: 0.2,
};

const TRANSIENT_MESSAGE_SUBSTRINGS = [
  'terminated',
  'fetch failed',
  'econnreset',
  'econnrefused',
  'enotfound',
  'eai_again',
  'socket hang up',
  'network error',
  'request timed out',
  'request timeout',
  'connection reset',
  'connection closed',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAbortError(error: unknown): boolean {
  if (!isRecord(error)) return false;
  if (error.name === 'AbortError') return true;
  // DOMException-style abort
  if (typeof error.code === 'string' && error.code === 'ABORT_ERR') return true;
  return false;
}

function hasTransientMessage(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const message = typeof value.message === 'string' ? value.message.toLowerCase() : '';
  if (message && TRANSIENT_MESSAGE_SUBSTRINGS.some(sub => message.includes(sub))) return true;
  if (typeof value.code === 'string' && value.code.toUpperCase().startsWith('UND_ERR_')) return true;
  return false;
}

function hasRetryableHttpStatus(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const status = typeof value.statusCode === 'number' ? value.statusCode : undefined;
  if (status === undefined) return false;
  if (status === 408 || status === 425 || status === 429) return true;
  if (status >= 500 && status <= 599) return true;
  return false;
}

function hasIsRetryableFlag(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return value.isRetryable === true;
}

/**
 * Returns true when the given error looks like a transient transport-class
 * failure that's worth retrying — undici `terminated`, `fetch failed`,
 * `UND_ERR_*` codes, AI SDK `APICallError` with `isRetryable: true`, and
 * common HTTP 408/425/429/5xx statuses. Walks the `error.cause` chain so
 * wrapper errors don't hide the real failure.
 *
 * Never retries on user-initiated aborts.
 *
 * @internal
 */
export function isTransientLLMError(error: unknown): boolean {
  if (isAbortError(error)) return false;

  const visited = new WeakSet<object>();

  function visit(candidate: unknown): boolean {
    if (isRecord(candidate)) {
      if (visited.has(candidate)) return false;
      visited.add(candidate);
    }

    if (hasTransientMessage(candidate)) return true;
    if (hasRetryableHttpStatus(candidate)) return true;
    if (hasIsRetryableFlag(candidate)) return true;

    if (isRecord(candidate)) {
      if (visit(candidate.cause)) return true;
      // Some libraries wrap the original error under `.error` instead of `.cause`.
      if (visit(candidate.error)) return true;
    }

    return false;
  }

  return visit(error);
}

/**
 * Compute the backoff delay (ms) for the Nth retry (0-indexed).
 *
 * Exponential growth (`initialDelayMs * backoffFactor^attempt`) capped at
 * `maxDelayMs`, then nudged by ±`jitter` (fractional). Exported for unit
 * tests that lock the schedule against drift.
 *
 * @internal
 */
export function computeDelay(attempt: number): number {
  const base = RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffFactor, attempt);
  const capped = Math.min(base, RETRY_CONFIG.maxDelayMs);
  if (RETRY_CONFIG.jitter <= 0) return capped;
  const jitterRange = capped * RETRY_CONFIG.jitter;
  // Symmetric jitter in [-jitterRange, +jitterRange].
  const offset = (Math.random() * 2 - 1) * jitterRange;
  return Math.max(0, Math.round(capped + offset));
}

function sleep(ms: number, abortSignal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    if (abortSignal?.aborted) {
      reject(new Error('The operation was aborted.'));
      return;
    }
    const timer = setTimeout(() => {
      abortSignal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      abortSignal?.removeEventListener('abort', onAbort);
      reject(new Error('The operation was aborted.'));
    };
    abortSignal?.addEventListener('abort', onAbort, { once: true });
  });
}

export interface WithRetryOptions {
  /** Short label used in debug logs (e.g. 'observer', 'reflector'). */
  label: string;
  /** Optional abort signal — cancels both in-flight attempts and backoff waits. */
  abortSignal?: AbortSignal;
}

/**
 * Run `fn` with retries on transient transport-class errors.
 *
 * Non-transient errors (auth, validation, schema, etc.) are rethrown
 * immediately. User-initiated aborts are rethrown without delay.
 *
 * @internal
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: WithRetryOptions): Promise<T> {
  const { label, abortSignal } = opts;
  let attempt = 0;
  // total tries = maxRetries + 1 (the initial attempt isn't a "retry")
  while (true) {
    if (abortSignal?.aborted) {
      throw new Error('The operation was aborted.');
    }
    try {
      return await fn();
    } catch (error) {
      if (isAbortError(error) || abortSignal?.aborted) throw error;
      if (attempt >= RETRY_CONFIG.maxRetries || !isTransientLLMError(error)) {
        if (attempt > 0) {
          omDebug(
            `[OM:retry:${label}] giving up after ${attempt} retry/retries: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
        throw error;
      }
      const delay = computeDelay(attempt);
      attempt++;
      omDebug(
        `[OM:retry:${label}] transient error on attempt ${attempt}, retrying in ${delay}ms: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      await sleep(delay, abortSignal);
    }
  }
}
