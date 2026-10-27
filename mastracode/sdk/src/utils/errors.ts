/**
 * Error handling utilities for the Mastra Code TUI.
 * Parses API errors and provides user-friendly messages.
 */

import { classifyProviderError } from '@mastra/core/error';

import { PROVIDER_AUTH_REQUIRED_ERROR } from '../auth/provider-auth-error.js';

export interface ParsedError {
  /** User-friendly error message */
  message: string;
  /** Extra diagnostic detail to surface to the user */
  detail?: string;
  /** Request URL involved in the failure, when available */
  requestUrl?: string;
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
  | 'quota'
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
function summarizeErrorDetail(error: unknown): string | undefined {
  if (error instanceof Error) {
    if (error.cause instanceof Error && error.cause.message) {
      return error.cause.message;
    }

    if (typeof error.cause === 'string' && error.cause.trim().length > 0) {
      return error.cause;
    }

    if (error.message.trim().length > 0) {
      return error.message;
    }
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  if (error && typeof error === 'object') {
    const errorObj = error as Record<string, unknown>;
    const candidates = [errorObj['message'], errorObj['cause'], errorObj['code'], errorObj['statusText']];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate;
      }
    }
  }

  return undefined;
}

function extractRequestUrl(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const candidates: unknown[] = [];
  const errorObj = error as Record<string, unknown>;
  candidates.push(errorObj['requestUrl'], errorObj['url']);

  if (errorObj['cause'] && typeof errorObj['cause'] === 'object') {
    const causeObj = errorObj['cause'] as Record<string, unknown>;
    candidates.push(causeObj['requestUrl'], causeObj['url']);
  }

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate;
    }
  }

  return undefined;
}

/** A flattened error crossing the wire: the server sends `{ name, message }`, not an `Error`. */
function isSerializedError(value: unknown): value is { name: string; message: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof value.name === 'string' &&
    'message' in value &&
    typeof value.message === 'string'
  );
}

function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (!isSerializedError(error)) return new Error(String(error));
  const rebuilt = new Error(error.message);
  rebuilt.name = error.name;
  return rebuilt;
}

function errorTypeOf(error: unknown, message: string, status: unknown): ErrorType {
  const kind = classifyProviderError(typeof status === 'number' ? { statusCode: status, cause: error } : error);
  if (kind === 'quota') return 'quota';
  if (kind === 'rate_limited' || status === 429 || message.includes('429')) return 'rate_limit';
  if (
    kind === 'auth' ||
    status === 401 ||
    status === 403 ||
    (kind !== 'unavailable' &&
      (message.includes('unauthorized') || message.includes('authentication') || message.includes('api key')))
  ) {
    return 'auth';
  }
  if (
    message.includes('network') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('fetch failed') ||
    message.includes('connection')
  ) {
    return 'network';
  }
  if (kind === 'timeout') return 'timeout';
  if (kind === 'model_rejected' || message.includes('does not exist')) return 'model_not_found';
  if (
    kind === 'context_overflow' ||
    message.includes('context length') ||
    message.includes('too many tokens') ||
    message.includes('token limit')
  ) {
    return 'context_length';
  }
  if (
    message.includes('content filter') ||
    message.includes('content_filter') ||
    message.includes('content policy') ||
    message.includes('safety') ||
    message.includes('prohibited')
  ) {
    return 'content_filter';
  }
  if (kind === 'unavailable' || (typeof status === 'number' && status >= 500 && status < 600)) return 'server_error';
  if (
    kind === 'invalid_request' ||
    kind === 'tool_history_rejected' ||
    status === 400 ||
    message.includes('invalid request') ||
    message.includes('bad request')
  ) {
    return 'invalid_request';
  }
  return 'unknown';
}

export function parseError(error: unknown): ParsedError {
  const err = toError(error);
  const errorObj = (typeof error === 'object' && error !== null ? error : {}) as Record<string, unknown>;
  const detail = summarizeErrorDetail(error);
  const requestUrl = extractRequestUrl(error);

  // Matched by name, not instance: the error may have crossed a serialization boundary.
  if (err.name === PROVIDER_AUTH_REQUIRED_ERROR) {
    return { message: err.message, detail, requestUrl, type: 'auth', retryable: false, originalError: err };
  }

  const message = err.message.toLowerCase();
  const type = errorTypeOf(error, message, errorObj.statusCode ?? errorObj.status);

  switch (type) {
    case 'quota':
      return {
        message: 'Usage quota exhausted for this provider account.',
        detail,
        requestUrl,
        type,
        retryable: false,
        originalError: err,
      };
    case 'rate_limit':
      return {
        message: 'Rate limited. Please wait a moment before trying again.',
        type,
        retryable: true,
        retryDelay: extractRetryAfter(errorObj) || 5000,
        originalError: err,
      };
    case 'auth':
      return {
        message:
          (errorObj.statusCode ?? errorObj.status) === 403
            ? 'Access denied. You may not have permission to use this model.'
            : 'Authentication failed. Check the credential configured for this provider.',
        detail,
        requestUrl,
        type,
        retryable: false,
        originalError: err,
      };
    case 'network':
      return {
        message: 'Network error while contacting the provider or gateway.',
        detail,
        requestUrl,
        type,
        retryable: true,
        retryDelay: 2000,
        originalError: err,
      };
    case 'timeout':
      return {
        message: 'Request timed out. The server may be overloaded.',
        type,
        retryable: true,
        retryDelay: 3000,
        originalError: err,
      };
    case 'model_not_found':
      return {
        message: 'Model not found. Please select a different model with /models.',
        type,
        retryable: false,
        originalError: err,
      };
    case 'context_length':
      return {
        message: 'Message too long. Try starting a new thread with /new.',
        type,
        retryable: false,
        originalError: err,
      };
    case 'content_filter':
      return {
        message: "Content was filtered by the model's safety system.",
        type,
        retryable: false,
        originalError: err,
      };
    case 'server_error':
      return {
        message: 'Server error. The API may be experiencing issues.',
        type,
        retryable: true,
        retryDelay: 5000,
        originalError: err,
      };
    case 'invalid_request':
      return {
        message: `Invalid request: ${extractErrorDetail(err)}`,
        type,
        retryable: false,
        originalError: err,
      };
    case 'unknown':
      return {
        message: extractErrorDetail(err),
        type,
        retryable: false,
        originalError: err,
      };
  }
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
