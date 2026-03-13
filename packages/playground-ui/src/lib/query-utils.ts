/**
 * HTTP status codes that should not be retried.
 * - 400: Bad Request (client error, won't change)
 * - 401: Unauthorized (needs re-auth, not retry)
 * - 403: Forbidden (RBAC permission denied)
 * - 404: Not Found (resource doesn't exist)
 */
const HTTP_NO_RETRY_STATUSES = [400, 401, 403, 404];

/**
 * Check if error is a 403 Forbidden response.
 * Handles both direct status property and client-js error message format.
 */
export function is403ForbiddenError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  // Check for status property (direct response or wrapped)
  if ('status' in error && (error as { status: number }).status === 403) {
    return true;
  }

  // Check for statusCode property (some HTTP clients)
  if ('statusCode' in error && (error as { statusCode: number }).statusCode === 403) {
    return true;
  }

  // Check error message for client-js pattern: "HTTP error! status: 403"
  if ('message' in error) {
    const message = (error as { message: string }).message;
    return message.includes('status: 403');
  }

  return false;
}

/**
 * Check if error has a status code that shouldn't be retried.
 * Used to prevent retrying client errors that won't resolve.
 */
export function isNonRetryableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  // Check for status property
  if ('status' in error) {
    const status = (error as { status: number }).status;
    return HTTP_NO_RETRY_STATUSES.includes(status);
  }

  // Check for statusCode property
  if ('statusCode' in error) {
    const statusCode = (error as { statusCode: number }).statusCode;
    return HTTP_NO_RETRY_STATUSES.includes(statusCode);
  }

  // Check error message for client-js pattern
  if ('message' in error) {
    const message = (error as { message: string }).message;
    return HTTP_NO_RETRY_STATUSES.some(code => message.includes(`status: ${code}`));
  }

  return false;
}

/**
 * Default retry function for TanStack Query.
 * Does not retry 4xx client errors (400, 401, 403, 404).
 * Retries other errors up to 3 times.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  // Don't retry client errors - they won't resolve with retries
  if (isNonRetryableError(error)) {
    return false;
  }
  // Default: retry up to 3 times for transient errors
  return failureCount < 3;
}
