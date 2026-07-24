import { APICallError } from '@internal/ai-sdk-v5';

import { clampDelayMs, DEFAULT_MAX_RETRY_AFTER_MS, getRetryAfterMs, waitDelay } from '../utils/retry-after';
import type { Processor, ProcessAPIErrorArgs, ProcessAPIErrorResult } from './index';

export type StreamErrorRetryMatcher = (error: unknown) => boolean;

export type StreamErrorRetryDelayMs = number | ((args: ProcessAPIErrorArgs) => number | Promise<number>);

/**
 * A matcher with its own retry policy. When this matcher is the first to match
 * an error, its `maxRetries` and `delayMs` override the processor-level defaults.
 * Omitted fields fall back to the processor-level values.
 */
export type StreamErrorRetryMatcherConfig = {
  match: StreamErrorRetryMatcher;
  maxRetries?: number;
  delayMs?: StreamErrorRetryDelayMs;
};

/** A matcher entry: either a plain predicate or a config object with per-matcher policy. */
export type StreamErrorRetryMatcherEntry = StreamErrorRetryMatcher | StreamErrorRetryMatcherConfig;

export type StreamErrorRetryProcessorOptions = {
  maxRetries?: number;
  matchers?: StreamErrorRetryMatcherEntry[];
  /**
   * Retry unknown errors that are not matched by provider metadata, built-in
   * matchers, or custom matchers. Known authorization failures are excluded.
   * Uses the processor-level `maxRetries` and `delayMs`. Defaults to false.
   */
  retryUnknownErrors?: boolean;
  /**
   * Optional delay (ms) to wait before signaling a retry. Accepts a number or an
   * async function evaluated with the current error args. Negative/non-finite
   * values are clamped to 0. Defaults to 0 (retry immediately), preserving the
   * existing behavior for consumers that do not configure a delay.
   */
  delayMs?: StreamErrorRetryDelayMs;
  /**
   * Maximum provider-controlled Retry-After delay in milliseconds. Invalid values
   * are clamped to 0. Defaults to 30 seconds. This does not cap an explicitly
   * configured delayMs value.
   */
  maxRetryAfterMs?: number;
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
const TERMINAL_AUTHORIZATION_ERROR_CODES = new Set([
  'access_denied',
  'authentication_error',
  'forbidden',
  'invalid_api_key',
  'permission_denied',
]);
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

/**
 * Matcher for transient HTTP 400 (Bad Request) failures. Providers like OpenAI
 * occasionally return 400 during service degradation that succeeds on retry.
 * Recommended with `maxRetries: 1` since a 400 could also be genuinely invalid.
 */
export function isBadRequestError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  if ('statusCode' in error && (error as { statusCode?: unknown }).statusCode === 400) return true;

  return false;
}

function isRetryableProviderMetadata(error: unknown): boolean {
  const retryable = APICallError.isInstance(error)
    ? error.isRetryable
    : isRecord(error) && typeof error.isRetryable === 'boolean'
      ? error.isRetryable
      : undefined;

  return retryable === true;
}

function isKnownTerminalAuthorizationError(error: unknown): boolean {
  const visited = new WeakSet<object>();

  function visit(candidate: unknown): boolean {
    if (!isRecord(candidate)) return false;
    if (visited.has(candidate)) return false;
    visited.add(candidate);

    const statusCode = candidate.statusCode ?? candidate.status;
    if (statusCode === 401 || statusCode === 403) return true;

    const code = getStringProperty(candidate, 'code') ?? getStringProperty(candidate, 'type');
    if (code && TERMINAL_AUTHORIZATION_ERROR_CODES.has(code.trim().toLowerCase())) return true;

    const responseBody = getStringProperty(candidate, 'responseBody');
    let parsedResponseBody: unknown;
    if (responseBody) {
      try {
        parsedResponseBody = JSON.parse(responseBody);
      } catch {
        // Ignore non-JSON provider response bodies.
      }
    }

    return visit(candidate.error) || visit(candidate.data) || visit(parsedResponseBody) || visit(candidate.cause);
  }

  return visit(error);
}

type MatchedPolicy = { maxRetries?: number; delayMs?: StreamErrorRetryDelayMs };

function normalizeEntry(entry: StreamErrorRetryMatcherEntry): StreamErrorRetryMatcherConfig {
  return typeof entry === 'function' ? { match: entry } : entry;
}

/**
 * Walk the error cause chain and return the policy of the first matching
 * entry, or `undefined` when no matcher fires. Provider `isRetryable`
 * metadata is checked first (returns an empty policy so processor-level
 * defaults apply). Among user-supplied matchers, first-match wins.
 */
function findMatchingPolicy(error: unknown, entries: StreamErrorRetryMatcherConfig[]): MatchedPolicy | undefined {
  const visited = new WeakSet<object>();

  function visit(candidate: unknown): MatchedPolicy | undefined {
    if (isRecord(candidate)) {
      if (visited.has(candidate)) return undefined;
      visited.add(candidate);
    }

    if (isRetryableProviderMetadata(candidate)) {
      return {};
    }

    for (const entry of entries) {
      if (entry.match(candidate)) {
        return { maxRetries: entry.maxRetries, delayMs: entry.delayMs };
      }
    }

    const cause = getObjectCause(candidate);
    return cause !== undefined ? visit(cause) : undefined;
  }

  return visit(error);
}

export class StreamErrorRetryProcessor implements Processor<'stream-error-retry-processor'> {
  readonly id = 'stream-error-retry-processor' as const;
  readonly name = 'Stream Error Retry Processor';

  readonly #maxRetries: number;
  readonly #entries: StreamErrorRetryMatcherConfig[];
  readonly #retryUnknownErrors: boolean;
  readonly #delayMs: StreamErrorRetryDelayMs | undefined;
  readonly #maxRetryAfterMs: number;

  constructor(options: StreamErrorRetryProcessorOptions = {}) {
    this.#maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    const defaultEntries: StreamErrorRetryMatcherConfig[] = DEFAULT_MATCHERS.map(m => ({ match: m }));
    this.#entries = [...defaultEntries, ...(options.matchers ?? []).map(normalizeEntry)];
    this.#retryUnknownErrors = options.retryUnknownErrors ?? false;
    this.#delayMs = options.delayMs;
    this.#maxRetryAfterMs = clampDelayMs(options.maxRetryAfterMs ?? DEFAULT_MAX_RETRY_AFTER_MS);
  }

  async processAPIError(args: ProcessAPIErrorArgs): Promise<ProcessAPIErrorResult | void> {
    const { error, retryCount, abortSignal } = args;

    const matchedPolicy = findMatchingPolicy(error, this.#entries);
    const policy =
      matchedPolicy ?? (this.#retryUnknownErrors && !isKnownTerminalAuthorizationError(error) ? {} : undefined);
    if (!policy) return;

    const effectiveMaxRetries = policy.maxRetries ?? this.#maxRetries;
    if (retryCount >= effectiveMaxRetries) return;

    const effectiveDelay = policy.delayMs ?? this.#delayMs;
    const configuredDelayMs = effectiveDelay === undefined ? 0 : await resolveDelayMs(effectiveDelay, args);
    const retryAfterMs = getRetryAfterMs(error);
    const providerDelayMs = retryAfterMs === undefined ? 0 : Math.min(retryAfterMs, this.#maxRetryAfterMs);
    await waitDelay(Math.max(configuredDelayMs, providerDelayMs), abortSignal);

    return { retry: true };
  }
}

async function resolveDelayMs(delayMs: StreamErrorRetryDelayMs, args: ProcessAPIErrorArgs): Promise<number> {
  const delay = typeof delayMs === 'function' ? await delayMs(args) : delayMs;
  return clampDelayMs(delay);
}
