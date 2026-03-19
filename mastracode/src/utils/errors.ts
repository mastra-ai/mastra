/**
 * Error handling utilities for the Mastra Code TUI.
 * Parses API errors and provides user-friendly messages.
 */

export interface ParsedError {
  /** User-friendly error message */
  message: string;
  /** Error type for categorization */
  type: ErrorType;
  /** Whether this error is retryable */
  retryable: boolean;
  /** Suggested retry delay in ms (if retryable) */
  retryDelay?: number;
  /** Original error for debugging */
  originalError: Error;
}

export type ErrorType =
  | 'rate_limit'
  | 'auth'
  | 'network'
  | 'timeout'
  | 'invalid_request'
  | 'server_error'
  | 'model_not_found'
  | 'context_length'
  | 'content_filter'
  | 'unknown';

/**
 * Parse an error and return a user-friendly representation.
 */
export function parseError(error: unknown): ParsedError {
  const err = error instanceof Error ? error : new Error(String(error));
  const message = err.message.toLowerCase();
  const errorObj = error as Record<string, unknown>;

  // Check for rate limiting
  if (
    message.includes('rate limit') ||
    message.includes('rate_limit') ||
    message.includes('429') ||
    errorObj.statusCode === 429 ||
    errorObj.status === 429
  ) {
    const retryAfter = extractRetryAfter(errorObj);
    return {
      message: 'Rate limited. Please wait a moment before trying again.',
      type: 'rate_limit',
      retryable: true,
      retryDelay: retryAfter || 5000,
      originalError: err,
    };
  }

  // Check for authentication errors
  if (
    message.includes('unauthorized') ||
    message.includes('authentication') ||
    message.includes('invalid api key') ||
    message.includes('invalid_api_key') ||
    message.includes('api key') ||
    errorObj.statusCode === 401 ||
    errorObj.status === 401
  ) {
    return {
      message: 'Authentication failed. Please check your API key or login with /login.',
      type: 'auth',
      retryable: false,
      originalError: err,
    };
  }

  // Check for forbidden/permission errors
  if (errorObj.statusCode === 403 || errorObj.status === 403) {
    return {
      message: 'Access denied. You may not have permission to use this model.',
      type: 'auth',
      retryable: false,
      originalError: err,
    };
  }

  // Check for network errors
  if (
    message.includes('network') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('fetch failed') ||
    message.includes('connection')
  ) {
    return {
      message: 'Network error. Please check your internet connection.',
      type: 'network',
      retryable: true,
      retryDelay: 2000,
      originalError: err,
    };
  }

  // Check for timeout errors
  if (message.includes('timeout') || message.includes('timed out') || message.includes('etimedout')) {
    return {
      message: 'Request timed out. The server may be overloaded.',
      type: 'timeout',
      retryable: true,
      retryDelay: 3000,
      originalError: err,
    };
  }

  // Check for model not found
  if (
    message.includes('model not found') ||
    message.includes('model_not_found') ||
    message.includes('does not exist') ||
    message.includes('invalid model')
  ) {
    return {
      message: 'Model not found. Please select a different model with /models.',
      type: 'model_not_found',
      retryable: false,
      originalError: err,
    };
  }

  // Check for context length errors
  if (
    message.includes('context length') ||
    message.includes('context_length') ||
    message.includes('too many tokens') ||
    message.includes('maximum context') ||
    message.includes('token limit')
  ) {
    return {
      message: 'Message too long. Try starting a new thread with /new.',
      type: 'context_length',
      retryable: false,
      originalError: err,
    };
  }

  // Check for content filter errors
  if (
    message.includes('content filter') ||
    message.includes('content_filter') ||
    message.includes('content policy') ||
    message.includes('safety') ||
    message.includes('prohibited')
  ) {
    return {
      message: "Content was filtered by the model's safety system.",
      type: 'content_filter',
      retryable: false,
      originalError: err,
    };
  }

  // Check for server errors
  if (
    message.includes('internal server') ||
    message.includes('server error') ||
    errorObj.statusCode === 500 ||
    errorObj.status === 500 ||
    errorObj.statusCode === 502 ||
    errorObj.status === 502 ||
    errorObj.statusCode === 503 ||
    errorObj.status === 503
  ) {
    return {
      message: 'Server error. The API may be experiencing issues.',
      type: 'server_error',
      retryable: true,
      retryDelay: 5000,
      originalError: err,
    };
  }

  // Check for invalid request errors
  if (
    message.includes('invalid request') ||
    message.includes('bad request') ||
    errorObj.statusCode === 400 ||
    errorObj.status === 400
  ) {
    return {
      message: `Invalid request: ${extractErrorDetail(err)}`,
      type: 'invalid_request',
      retryable: false,
      originalError: err,
    };
  }

  // Unknown error - try to extract useful info
  return {
    message: extractErrorDetail(err),
    type: 'unknown',
    retryable: false,
    originalError: err,
  };
}

/**
 * Extract retry-after header value from error.
 */
function extractRetryAfter(error: Record<string, unknown>): number | undefined {
  const headers = error.headers as Record<string, unknown> | undefined;
  const retryAfter = error.retryAfter || headers?.['retry-after'];
  if (typeof retryAfter === 'number') {
    return retryAfter * 1000; // Convert seconds to ms
  }
  if (typeof retryAfter === 'string') {
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }
  }
  return undefined;
}

/**
 * Extract a useful error detail from an error object.
 */
function extractErrorDetail(error: Error): string {
  const errorObj = error as unknown as Record<string, unknown>;

  // Try to get a specific error message from common API error formats
  if (errorObj.error && typeof errorObj.error === 'object') {
    const apiError = errorObj.error as Record<string, unknown>;
    if (apiError.message) return String(apiError.message);
  }

  if (errorObj.message) return String(errorObj.message);
  if (errorObj.detail) return String(errorObj.detail);
  if (errorObj.reason) return String(errorObj.reason);

  // Clean up the error message
  let message = error.message;

  // Remove common prefixes
  message = message.replace(/^(error|exception|failed):\s*/i, '');

  // Truncate very long messages
  if (message.length > 200) {
    message = message.substring(0, 200) + '...';
  }

  return message || 'An unknown error occurred';
}

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    onRetry?: (error: ParsedError, attempt: number) => void;
  } = {},
): Promise<T> {
  const { maxRetries = 3, initialDelay = 1000, maxDelay = 30000, onRetry } = options;

  let lastError: ParsedError | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = parseError(error);

      // Don't retry non-retryable errors
      if (!lastError.retryable || attempt === maxRetries) {
        throw lastError.originalError;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(lastError.retryDelay || initialDelay * Math.pow(2, attempt), maxDelay);

      if (onRetry) {
        onRetry(lastError, attempt + 1);
      }

      await sleep(delay);
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError?.originalError || new Error('Retry failed');
}
