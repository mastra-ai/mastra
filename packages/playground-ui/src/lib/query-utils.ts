/**
 * HTTP status codes that should not be retried.
 * - 400: Bad Request (client error, won't change)
 * - 401: Unauthorized (needs re-auth, not retry)
 * - 403: Forbidden (RBAC permission denied)
 * - 404: Not Found (resource doesn't exist)
 * - 501: Not Implemented (capability gap, e.g. disabled storage domain, won't change)
 */
const HTTP_NO_RETRY_STATUSES = [400, 401, 403, 404, 501];

/**
 * Check if error is a 401 Unauthorized response.
 * Indicates the user's session has expired or token is invalid.
 * Handles both direct status property and client-js error message format.
 */
export function is401UnauthorizedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  // Check for status property (direct response or wrapped)
  if ('status' in error && (error as { status: number }).status === 401) {
    return true;
  }

  // Check for statusCode property (some HTTP clients)
  if ('statusCode' in error && (error as { statusCode: number }).statusCode === 401) {
    return true;
  }

  // Check error message for client-js pattern: "HTTP error! status: 401"
  if ('message' in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === 'string') {
      return /\bstatus:\s*401\b/.test(message);
    }
  }

  return false;
}

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
    const message = (error as { message: unknown }).message;
    if (typeof message === 'string') {
      return /\bstatus:\s*403\b/.test(message);
    }
  }

  return false;
}

/**
 * Check if error is a 404 Not Found response.
 * Handles both direct status property and client-js error message format.
 */
export function is404NotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  if ('status' in error && (error as { status: number }).status === 404) {
    return true;
  }

  if ('statusCode' in error && (error as { statusCode: number }).statusCode === 404) {
    return true;
  }

  if ('message' in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === 'string') {
      return /\bstatus:\s*404\b/.test(message);
    }
  }

  return false;
}

/**
 * Check if an error came from a storage provider that does not implement `listBranches`.
 *
 * The server's `handleError` strips the original MastraError's `code`/`id` before serializing,
 * so we can't match on the ID `OBSERVABILITY_STORAGE_LIST_BRANCHES_NOT_IMPLEMENTED` directly —
 * we match on the message text from `core/.../observability/base.ts` instead.
 */
export function isBranchesNotSupportedError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('message' in error)) return false;
  const message = (error as { message: unknown }).message;
  if (typeof message !== 'string') return false;
  return message.includes('does not support listing trace branches');
}

export type UnsupportedObservabilityOperation = 'logs' | 'metrics' | 'scores' | 'feedback';

/**
 * Check if an error came from an observability storage provider that does not
 * implement a list operation. These are capability gaps, not transient failures.
 *
 * The server serializes these as plain HTTP errors, so the original MastraError
 * ID is not available in the browser. Match the stable base-storage message text
 * instead, like the trace branch support check above.
 */
export function isUnsupportedObservabilityOperationError(
  error: unknown,
  operation: UnsupportedObservabilityOperation,
): boolean {
  if (!error || typeof error !== 'object' || !('message' in error)) return false;
  const message = (error as { message: unknown }).message;
  if (typeof message !== 'string') return false;
  return message.includes(`does not support listing ${operation}`);
}

/**
 * Stable messages from the server's observability domain getters when the
 * backing storage domain is disabled — e.g. `domains: { observability: false }`
 * on a composite store. Most observability endpoints report the
 * `observability` domain; span scores are backed by the separate `scores`
 * domain and report their own message. Kept as an explicit list because many
 * other (non-observability) server domains share the same message suffix.
 */
const OBSERVABILITY_UNAVAILABLE_MESSAGES = [
  'Observability storage domain is not available',
  'Scores storage domain is not available',
];

/**
 * Check if an error came from a server whose observability (or scores)
 * storage domain is unavailable. Affects every observability endpoint, so no
 * operation argument.
 */
export function isObservabilityUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('message' in error)) return false;
  const message = (error as { message: unknown }).message;
  if (typeof message !== 'string') return false;
  return OBSERVABILITY_UNAVAILABLE_MESSAGES.some(m => message.includes(m));
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
    const message = (error as { message: unknown }).message;
    if (typeof message === 'string') {
      return HTTP_NO_RETRY_STATUSES.some(code => new RegExp(`\\bstatus:\\s*${code}\\b`).test(message));
    }
  }

  return false;
}

/**
 * Default retry function for TanStack Query.
 * Does not retry 4xx client errors (400, 401, 403, 404) or 501 capability gaps.
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
