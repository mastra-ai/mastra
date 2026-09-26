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

export type OmFailurePolicy = 'abort' | 'continue';
export type OmFailureKind = 'observer-model' | 'reflector-model';

export class OmModelExecutionError extends Error {
  constructor(
    readonly failureKind: OmFailureKind,
    cause: unknown,
  ) {
    super(formatOmError(cause), { cause });
    this.name = 'OmModelExecutionError';
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
  return {
    failurePolicy,
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
