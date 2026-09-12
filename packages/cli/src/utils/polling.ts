const RETRYABLE_NETWORK_ERROR_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND']);

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

export async function withPollingRetries<T>(fn: () => Promise<T>, maxRetries = 3, signal?: AbortSignal): Promise<T> {
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

      if (!isRetryablePollingError(error) || retryCount >= maxRetries) {
        throw error;
      }

      await delay(500 * Math.pow(2, retryCount), signal);
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
