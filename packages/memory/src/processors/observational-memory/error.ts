import * as coreObservability from '@mastra/core/observability';
import type { AnySpan, ObserverFailureMetadata } from '@mastra/core/observability';
import { hasAbortInChain, isTransientLLMError } from './retry';

const AI_API_CALL_ERROR_MARKER = Symbol.for('vercel.ai.error.AI_APICallError');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isOmModelExecutionFailure(error: unknown): boolean {
  // Cancellation wins over every other signal, even when a wrapper's message
  // looks transient ("request timeout") — an aborted turn must never be
  // absorbed by `failurePolicy: 'continue'`.
  if (hasAbortInChain(error)) return false;

  if (isTransientLLMError(error)) return true;

  const visited = new Set<object>();
  let current: unknown = error;
  while (isRecord(current) && !visited.has(current)) {
    visited.add(current);

    if (Object.prototype.hasOwnProperty.call(current, AI_API_CALL_ERROR_MARKER)) {
      return Reflect.get(current, AI_API_CALL_ERROR_MARKER) === true;
    }

    current = current.cause ?? current.error;
  }

  return false;
}

const REQUEST_REJECTION_STATUSES = new Set([400, 413, 415, 422]);

/**
 * True when the provider rejected the request itself (bad request, payload too large,
 * unsupported media). Attachments are a common cause, and each provider sets its own
 * limits (image dimensions, bytes, count, mime types), so the Observer retries such
 * failures without attachments rather than hard-coding provider limits.
 */
export function isOmRequestRejection(error: unknown): boolean {
  if (hasAbortInChain(error)) return false;

  const visited = new Set<object>();
  const pending: unknown[] = [error];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!isRecord(current) || visited.has(current)) continue;
    visited.add(current);
    if (typeof current.statusCode === 'number' && REQUEST_REJECTION_STATUSES.has(current.statusCode)) return true;
    pending.push(current.cause, current.error);
  }
  return false;
}

export type OmFailurePolicy = 'abort' | 'continue';
export type OmFailureKind = 'observer-model' | 'reflector-model';

export class OmModelExecutionError extends Error {
  #observerSpanId?: string;

  get observerSpanId(): string | undefined {
    return this.#observerSpanId;
  }
  constructor(
    readonly failureKind: OmFailureKind,
    cause: unknown,
    observerSpan?: AnySpan,
  ) {
    super(formatOmError(cause), { cause });
    this.name = 'OmModelExecutionError';
    // Keep the reference out of serialized errors, and omit excluded spans rather
    // than accidentally linking back to the interrupted parent execution.
    try {
      this.#observerSpanId =
        observerSpan &&
        (typeof observerSpan.getExportedSpanId !== 'function' || observerSpan.getExportedSpanId() === observerSpan.id)
          ? observerSpan.id
          : undefined;
    } catch {
      // Custom tracing implementations must not replace the original failure.
    }
  }
}

export function isOmModelExecutionError(error: unknown): error is OmModelExecutionError {
  try {
    return error instanceof OmModelExecutionError;
  } catch {
    return false;
  }
}

export function getOmFailureMetadata(error: unknown, failurePolicy: OmFailurePolicy) {
  let observerFailure: ObserverFailureMetadata['observerFailure'] | undefined;
  if (typeof coreObservability.executionFailureTermination === 'function') {
    try {
      const modelFailure = isOmModelExecutionError(error);
      observerFailure = {
        ...(modelFailure && error.observerSpanId ? { observerSpanId: error.observerSpanId } : {}),
        cause: coreObservability.executionFailureTermination(
          modelFailure ? error.cause : error,
          modelFailure ? 'model_error' : 'runtime_error',
        ),
      };
    } catch {
      // Malformed error getters must not turn tracing into a new failure.
      observerFailure = { cause: { outcome: 'error', stopReason: 'runtime_error' } };
    }
  }
  return {
    failurePolicy,
    ...(observerFailure ? { observerFailure } : {}),
    ...(isOmModelExecutionError(error) ? { failureKind: error.failureKind } : {}),
  };
}

/** Keep provider diagnostics in streamed/persisted markers, not whole API request/response objects. */
export function formatOmError(error: unknown): string {
  const details = new Set<string>();
  const visited = new Set<object>();
  const add = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) details.add(value.trim().slice(0, 2000));
  };

  function collectErrorDetails(value: unknown, depth: number) {
    if (depth > 5) return;
    if (!isRecord(value)) {
      if (value !== undefined) add(String(value));
      return;
    }
    if (visited.has(value)) return;
    visited.add(value);
    // MastraError ids are framework-generated operation tokens (no user data) and are often the only
    // attribution when a wrapper omits `text` and inherits the driver message.
    if (typeof value.id === 'string' && typeof value.domain === 'string' && typeof value.category === 'string') {
      add(value.id);
    }
    add(value.message);
    if (typeof value.statusCode === 'number') add(`HTTP ${value.statusCode}`);

    // Only extract the provider's diagnostic message. Bodies may also contain
    // echoed prompts, credentials, headers, or HTML from an upstream proxy.
    if (typeof value.responseBody === 'string') {
      try {
        const body: unknown = JSON.parse(value.responseBody);
        if (isRecord(body)) {
          add(body.message);
          add(body.detail);
          if (isRecord(body.error)) add(body.error.message);
          else add(body.error);
        }
      } catch {
        // A non-JSON body is not safe to include in a persisted marker.
      }
    }
    if (value.cause !== undefined) collectErrorDetails(value.cause, depth + 1);
    if (value.error !== undefined) collectErrorDetails(value.error, depth + 1);
  }

  try {
    collectErrorDetails(error, 0);
  } catch {
    // Stop on malformed thrown values, but preserve diagnostics already collected.
  }
  const message = [...details].join(': ') || 'Unknown error';
  return message.length > 2000 ? `${message.slice(0, 1997)}...` : message;
}
