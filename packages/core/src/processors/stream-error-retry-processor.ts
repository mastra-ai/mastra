import { APICallError } from '@internal/ai-sdk-v5';

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
   * Optional delay (ms) to wait before signaling a retry. Accepts a number or an
   * async function evaluated with the current error args. Negative/non-finite
   * values are clamped to 0. Defaults to 0 (retry immediately), preserving the
   * existing behavior for consumers that do not configure a delay.
   */
  delayMs?: StreamErrorRetryDelayMs;
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
  readonly #delayMs: StreamErrorRetryDelayMs | undefined;

  constructor(options: StreamErrorRetryProcessorOptions = {}) {
    this.#maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    const defaultEntries: StreamErrorRetryMatcherConfig[] = DEFAULT_MATCHERS.map(m => ({ match: m }));
    this.#entries = [...defaultEntries, ...(options.matchers ?? []).map(normalizeEntry)];
    this.#delayMs = options.delayMs;
  }

  async processAPIError(args: ProcessAPIErrorArgs): Promise<ProcessAPIErrorResult | void> {
    const { error, retryCount, abortSignal } = args;

    const policy = findMatchingPolicy(error, this.#entries);
    if (!policy) return;

    const effectiveMaxRetries = policy.maxRetries ?? this.#maxRetries;
    if (retryCount >= effectiveMaxRetries) return;

    const effectiveDelay = policy.delayMs ?? this.#delayMs;
    if (effectiveDelay !== undefined) {
      await waitDelay(effectiveDelay, args, abortSignal);
    }

    return { retry: true };
  }
}

function clampDelayMs(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

async function waitDelay(
  delayMs: StreamErrorRetryDelayMs,
  args: ProcessAPIErrorArgs,
  abortSignal?: AbortSignal,
): Promise<void> {
  const delay = typeof delayMs === 'function' ? await delayMs(args) : delayMs;
  const ms = clampDelayMs(delay);
  if (ms <= 0) return;

  if (!abortSignal) {
    await new Promise<void>(resolve => setTimeout(resolve, ms));
    return;
  }

  await new Promise<void>(resolve => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const onAbort = () => {
      if (timeout) clearTimeout(timeout);
      abortSignal.removeEventListener('abort', onAbort);
      resolve();
    };
    // Register before checking aborted to close the race window where
    // abort fires between the check and addEventListener.
    abortSignal.addEventListener('abort', onAbort, { once: true });
    if (abortSignal.aborted) {
      onAbort();
      return;
    }
    timeout = setTimeout(() => {
      abortSignal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
  });
}
