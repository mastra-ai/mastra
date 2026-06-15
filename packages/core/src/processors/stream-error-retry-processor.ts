import { APICallError } from '@internal/ai-sdk-v5';

import type { Processor, ProcessAPIErrorArgs, ProcessAPIErrorResult } from './index';

export type StreamErrorRetryMatcher = (error: unknown) => boolean;

export type StreamErrorRetryProcessorOptions = {
  maxRetries?: number;
  matchers?: StreamErrorRetryMatcher[];
};

const DEFAULT_MAX_RETRIES = 1;
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
const DEFAULT_MATCHERS = [isRetryableOpenAIResponsesStreamError];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getStringProperty(value: Record<string, unknown>, key: string): string | undefined {
  const property = value[key];
  return typeof property === 'string' ? property : undefined;
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

export function isRetryableOpenAIResponsesStreamError(error: unknown): boolean {
  const payload = getOpenAIErrorPayload(error);
  if (!payload) {
    return false;
  }

  return hasRetryableOpenAIErrorCode(payload) || hasExplicitRetryMessage(payload);
}

function isRetryableProviderMetadata(error: unknown): boolean {
  const retryable = APICallError.isInstance(error)
    ? error.isRetryable
    : isRecord(error) && typeof error.isRetryable === 'boolean'
      ? error.isRetryable
      : undefined;

  return retryable === true;
}

function isRetryableStreamError(error: unknown, matchers: StreamErrorRetryMatcher[]): boolean {
  const visited = new WeakSet<object>();

  function visit(candidate: unknown): boolean {
    if (isRecord(candidate)) {
      if (visited.has(candidate)) {
        return false;
      }
      visited.add(candidate);
    }

    if (isRetryableProviderMetadata(candidate)) {
      return true;
    }

    if (matchers.some(matcher => matcher(candidate))) {
      return true;
    }

    const cause = getObjectCause(candidate);
    return cause !== undefined && visit(cause);
  }

  return visit(error);
}

export class StreamErrorRetryProcessor implements Processor<'stream-error-retry-processor'> {
  readonly id = 'stream-error-retry-processor' as const;
  readonly name = 'Stream Error Retry Processor';

  readonly #maxRetries: number;
  readonly #matchers: StreamErrorRetryMatcher[];

  constructor(options: StreamErrorRetryProcessorOptions = {}) {
    this.#maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.#matchers = [...DEFAULT_MATCHERS, ...(options.matchers ?? [])];
  }

  async processAPIError({ error, retryCount }: ProcessAPIErrorArgs): Promise<ProcessAPIErrorResult | void> {
    if (retryCount >= this.#maxRetries) return;
    if (!isRetryableStreamError(error, this.#matchers)) return;

    return { retry: true };
  }
}
