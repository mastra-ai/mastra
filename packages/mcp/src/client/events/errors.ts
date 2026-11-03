import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { ProtocolError, ProtocolErrorCode } from '@modelcontextprotocol/client';
import { EVENTS_NON_RETRYABLE_ERROR_CODES } from '../../shared/events';

type Details = Record<string, string | number | boolean | null>;

export function eventsError(id: Uppercase<string>, text: string, details: Details = {}, cause?: unknown): MastraError {
  return new MastraError({ id, domain: ErrorDomain.MCP, category: ErrorCategory.THIRD_PARTY, text, details }, cause);
}

/** A JSON-RPC error that means the subscription itself is invalid, so retrying cannot help. */
export function isNonRetryable(error: unknown): error is ProtocolError {
  return (
    error instanceof ProtocolError &&
    (EVENTS_NON_RETRYABLE_ERROR_CODES.includes(error.code) || error.code === ProtocolErrorCode.MethodNotFound)
  );
}

export function isFatal(error: unknown): boolean {
  return (
    isNonRetryable(error) ||
    (error instanceof MastraError &&
      (error.id === 'MCP_EVENTS_SUBSCRIPTION_FAILED' ||
        error.id === 'MCP_EVENTS_SUBSCRIPTION_TERMINATED' ||
        error.id === 'MCP_EVENTS_RETRIES_EXHAUSTED'))
  );
}

/** Normalizes a failure that ends the subscription. */
export function toFatalError(error: unknown, details: Details): MastraError {
  if (error instanceof MastraError && isFatal(error)) return error;
  if (error instanceof ProtocolError) {
    return eventsError(
      'MCP_EVENTS_SUBSCRIPTION_FAILED',
      `Event subscription failed: ${error.message}`,
      { ...details, code: error.code },
      error,
    );
  }
  if (error instanceof MastraError) return error;
  return eventsError(
    'MCP_EVENTS_SUBSCRIPTION_FAILED',
    `Event subscription failed: ${error instanceof Error ? error.message : String(error)}`,
    details,
    error,
  );
}

/** Normalizes a failure the subscription recovers from. */
export function toTransientError(error: unknown, details: Details): MastraError {
  if (error instanceof MastraError) return error;
  return eventsError(
    'MCP_EVENTS_DELIVERY_INTERRUPTED',
    `Event delivery interrupted: ${error instanceof Error ? error.message : String(error)}`,
    details,
    error,
  );
}
