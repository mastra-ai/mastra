const RETRYABLE_NETWORK_ERROR_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'EAI_AGAIN',
  'EPIPE',
  'UND_ERR_SOCKET',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
]);

export function isRetryablePollingError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const cause = 'cause' in error && error.cause && typeof error.cause === 'object' ? error.cause : undefined;
  const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined;
  const causeCode = cause && 'code' in cause && typeof cause.code === 'string' ? cause.code : undefined;

  if (
    (code !== undefined && RETRYABLE_NETWORK_ERROR_CODES.has(code)) ||
    (causeCode !== undefined && RETRYABLE_NETWORK_ERROR_CODES.has(causeCode))
  ) {
    return true;
  }

  // A specific non-retryable cause (for example a certificate error) takes
  // precedence over fetch's generic TypeError message.
  if (code !== undefined || causeCode !== undefined) return false;

  return error instanceof TypeError && error.message.toLowerCase().includes('fetch failed');
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('This operation was aborted', 'AbortError');
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReason(signal));
      return;
    }

    const onAbort = () => {
      clearTimeout(timer);
      reject(abortReason(signal!));
    };

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export interface PollingRetryOptions {
  /** Retries after the initial attempt. Use Infinity with a deadline signal to retry until cancellation. */
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

export async function withPollingRetries<T>(
  fn: () => Promise<T>,
  retries: number | PollingRetryOptions = 3,
  signal?: AbortSignal,
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 500,
    maxDelayMs = Infinity,
    shouldRetry = isRetryablePollingError,
    onRetry,
  } = typeof retries === 'number' ? { maxRetries: retries } : retries;
  if (maxRetries === Infinity && !signal) {
    throw new Error('Unlimited polling retries require an AbortSignal');
  }
  let retryCount = 0;

  while (true) {
    if (signal?.aborted) {
      throw abortReason(signal);
    }

    try {
      return await fn();
    } catch (error) {
      if (signal?.aborted) {
        throw abortReason(signal);
      }

      if (!shouldRetry(error) || retryCount >= maxRetries) {
        throw error;
      }

      const delayMs = Math.min(initialDelayMs * Math.pow(2, retryCount), maxDelayMs);
      onRetry?.(error, retryCount + 1, delayMs);
      await delay(delayMs, signal);
      retryCount += 1;
    }
  }
}

/** Sleep that resolves early, without throwing, when the signal aborts. */
export function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
