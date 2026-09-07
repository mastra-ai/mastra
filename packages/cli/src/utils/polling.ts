const RETRYABLE_NETWORK_ERROR_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND']);

export function isRetryablePollingError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  if ('name' in error && error.name === 'AbortError') {
    return true;
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

export async function withPollingRetries<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let retryCount = 0;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (!isRetryablePollingError(error) || retryCount >= maxRetries) {
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, retryCount)));
      retryCount += 1;
    }
  }
}
