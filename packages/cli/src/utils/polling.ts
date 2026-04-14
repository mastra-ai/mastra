export function isRetryablePollingError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  if ('name' in error && error.name === 'AbortError') {
    return true;
  }

  const cause = 'cause' in error && error.cause && typeof error.cause === 'object' ? error.cause : undefined;
  const code = cause && 'code' in cause && typeof cause.code === 'string' ? cause.code : undefined;

  if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
    return true;
  }

  return error instanceof TypeError && error.message.toLowerCase().includes('fetch failed');
}
