import { APICallError } from '@internal/ai-sdk-v5';

import type { Processor, ProcessAPIErrorArgs, ProcessAPIErrorResult } from './index';

export type OpenAITransientErrorRetryOptions = {
  maxRetries?: number;
};

const DEFAULT_MAX_RETRIES = 1;
const RETRYABLE_STATUS_CODES = new Set([408, 409, 429]);
const RETRYABLE_OPENAI_ERROR_CODES = [
  'rate_limit',
  'server_error',
  'internal_error',
  'timeout',
  'temporarily_unavailable',
  'service_unavailable',
  'overloaded',
];
const OPENAI_RETRY_MESSAGE_PATTERN = /you can retry your request/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getStringProperty(value: Record<string, unknown>, key: string): string | undefined {
  const property = value[key];
  return typeof property === 'string' ? property : undefined;
}

function getNumberProperty(value: Record<string, unknown>, key: string): number | undefined {
  const property = value[key];
  return typeof property === 'number' ? property : undefined;
}

function isRetryableStatusCode(statusCode: number | undefined): boolean {
  return statusCode !== undefined && (RETRYABLE_STATUS_CODES.has(statusCode) || statusCode >= 500);
}

function getObjectCause(error: unknown): unknown {
  if (error instanceof Error) {
    return error.cause;
  }

  if (!isRecord(error)) {
    return undefined;
  }

  return error.cause;
}

function getRetryableFlag(error: unknown): boolean | undefined {
  if (APICallError.isInstance(error)) {
    return error.isRetryable;
  }

  if (!isRecord(error)) {
    return undefined;
  }

  const retryable = error.isRetryable;
  return typeof retryable === 'boolean' ? retryable : undefined;
}

function getStatusCode(error: unknown): number | undefined {
  if (APICallError.isInstance(error)) {
    return error.statusCode;
  }

  if (!isRecord(error)) {
    return undefined;
  }

  const directStatus = getNumberProperty(error, 'statusCode') ?? getNumberProperty(error, 'status');
  if (directStatus !== undefined) {
    return directStatus;
  }

  const response = error.response;
  return isRecord(response) ? getNumberProperty(response, 'status') : undefined;
}

function getOpenAIErrorPayload(error: unknown): Record<string, unknown> | undefined {
  if (!isRecord(error)) {
    return undefined;
  }

  if (error.type === 'error' && isRecord(error.error)) {
    return error.error;
  }

  if (error.type === 'response.failed' && isRecord(error.response)) {
    const responseError = error.response.error;
    return isRecord(responseError) ? responseError : undefined;
  }

  return undefined;
}

function hasRetryableOpenAIErrorCode(payload: Record<string, unknown>): boolean {
  const code = getStringProperty(payload, 'code') ?? getStringProperty(payload, 'type');
  if (!code) {
    return false;
  }

  const normalizedCode = code.toLowerCase();
  return RETRYABLE_OPENAI_ERROR_CODES.some(retryableCode => normalizedCode.includes(retryableCode));
}

function hasExplicitRetryMessage(payload: Record<string, unknown>): boolean {
  const message = getStringProperty(payload, 'message');
  return message !== undefined && OPENAI_RETRY_MESSAGE_PATTERN.test(message);
}

function isRetryableOpenAIStreamError(error: unknown): boolean {
  const payload = getOpenAIErrorPayload(error);
  if (!payload) {
    return false;
  }

  return hasRetryableOpenAIErrorCode(payload) || hasExplicitRetryMessage(payload);
}

export function isOpenAITransientError(error: unknown): boolean {
  const visited = new WeakSet<object>();

  function visit(candidate: unknown): boolean {
    if (isRecord(candidate)) {
      if (visited.has(candidate)) {
        return false;
      }
      visited.add(candidate);
    }

    const retryable = getRetryableFlag(candidate);
    if (retryable === true) {
      return true;
    }

    if (retryable !== false && isRetryableStatusCode(getStatusCode(candidate))) {
      return true;
    }

    if (isRetryableOpenAIStreamError(candidate)) {
      return true;
    }

    const cause = getObjectCause(candidate);
    return cause !== undefined && visit(cause);
  }

  return visit(error);
}

export class OpenAITransientErrorRetry implements Processor<'openai-transient-error-retry'> {
  readonly id = 'openai-transient-error-retry' as const;
  readonly name = 'OpenAI Transient Error Retry';

  readonly #maxRetries: number;

  constructor(options: OpenAITransientErrorRetryOptions = {}) {
    this.#maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  async processAPIError({ error, retryCount }: ProcessAPIErrorArgs): Promise<ProcessAPIErrorResult | void> {
    if (retryCount >= this.#maxRetries) return;
    if (!isOpenAITransientError(error)) return;

    return { retry: true };
  }
}
