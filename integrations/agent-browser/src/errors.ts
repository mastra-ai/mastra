/**
 * Unified error handling for browser tools.
 *
 * All browser tools return errors in this consistent format,
 * providing LLM-friendly messages and recovery hints.
 */

/**
 * Error codes for browser tool failures.
 *
 * These codes help agents understand what went wrong
 * and whether retry or recovery is possible.
 */
export type ErrorCode =
  | 'stale_ref' // Ref no longer valid after page change
  | 'element_not_found' // Element doesn't exist
  | 'element_blocked' // Element covered by overlay
  | 'element_not_visible' // Element hidden
  | 'not_focusable' // Can't type into element
  | 'timeout' // Operation timed out
  | 'browser_error'; // Generic browser error

/**
 * Structured error response for browser tool failures.
 *
 * Provides LLM-friendly error information with optional recovery hints.
 */
export interface BrowserToolError {
  /** Always false for error responses */
  success: false;
  /** Error classification code */
  code: ErrorCode;
  /** LLM-friendly error description */
  message: string;
  /** Suggested recovery action (only when actionable) */
  recoveryHint?: string;
  /** Whether the operation can be retried */
  canRetry: boolean;
}

/**
 * Error codes that are generally retryable.
 */
const RETRYABLE_CODES: Set<ErrorCode> = new Set(['timeout', 'element_blocked']);

/**
 * Creates a structured error response for browser tools.
 *
 * Sets canRetry based on the error code: true for 'timeout' and 'element_blocked'.
 *
 * @param code - Error classification code
 * @param message - LLM-friendly error description
 * @param hint - Optional recovery hint (only when actionable)
 * @returns Typed BrowserToolError with canRetry set automatically
 */
export function createError(code: ErrorCode, message: string, hint?: string): BrowserToolError {
  return {
    success: false,
    code,
    message,
    recoveryHint: hint,
    canRetry: RETRYABLE_CODES.has(code),
  };
}
