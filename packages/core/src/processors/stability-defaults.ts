import type { ErrorProcessorOrWorkflow } from './index';
import { PrefillErrorHandler } from './prefill-error-handler';
import { ProviderHistoryCompat } from './provider-history-compat';
import { isBadRequestError, StreamErrorRetryProcessor } from './stream-error-retry-processor';

/**
 * Retry policy for transient network resets (e.g. provider sockets dropping
 * mid-stream). Applied centrally to every model call via the default
 * `StreamErrorRetryProcessor` so all modes/subagents benefit from a short wait
 * before retrying an ECONNRESET. Delay uses exponential backoff:
 * `initialDelay * 2^retryCount`, capped at `maxDelay`.
 */
export const ECONNRESET_MAX_RETRIES = 2;
export const ECONNRESET_RETRY_INITIAL_DELAY_MS = 1000;
export const ECONNRESET_RETRY_MAX_DELAY_MS = 30000;

export const ECONNRESET_MESSAGE_PATTERN = /econnreset|socket hang up/i;

/**
 * Matcher for transient network-reset failures. Checks the immediate error for
 * an `ECONNRESET` code or a `socket hang up` message. Cause-chain traversal is
 * handled by `StreamErrorRetryProcessor.isRetryableStreamError`, which calls
 * each matcher at every level of the cause chain.
 */
export function isECONNRESETError(error: unknown): boolean {
  if (!error) return false;

  const code = typeof error === 'object' && 'code' in error ? error.code : undefined;
  if (typeof code === 'string' && code.toUpperCase() === 'ECONNRESET') return true;

  const message = error instanceof Error ? error.message : undefined;
  if (typeof message === 'string' && ECONNRESET_MESSAGE_PATTERN.test(message)) return true;

  return false;
}

/**
 * The ids of the default stability error processors, in their default order.
 *
 * The order is load-bearing: error processors short-circuit on the first
 * `{ retry: true }`, so `provider-history-compat` must repair provider history
 * **before** `stream-error-retry-processor`'s bad-request matcher blindly
 * resends the same, still-broken request.
 */
export const STABILITY_ERROR_PROCESSOR_IDS = [
  'provider-history-compat',
  'stream-error-retry-processor',
  'prefill-error-handler',
] as const;

/**
 * Builds the default stability error processors every agent gets when the
 * caller supplies no `errorProcessors`.
 *
 * Turning these on means a plain `new Agent({...})` recovers from three
 * provider-side failure classes without any caller wiring:
 *
 * - transient stream/connection failures — including a bare `500`/`isRetryable`
 *   error that would otherwise surface as an empty response;
 * - assistant-prefill rejections from Anthropic/Qwen-style models;
 * - provider history incompatibilities (e.g. another provider's tool calls or
 *   reasoning content in the history).
 *
 * A caller-supplied processor whose id matches one of these replaces that
 * default in its slot; `errorProcessors: []` opts out entirely.
 *
 * Returns a fresh array of fresh instances on every call — never a shared
 * mutable array.
 */
export function defaultStabilityErrorProcessors(): ErrorProcessorOrWorkflow[] {
  return [
    new ProviderHistoryCompat(),
    new StreamErrorRetryProcessor({
      retryUnknownErrors: true,
      maxRetries: 2,
      delayMs: 3000,
      matchers: [
        { match: isBadRequestError, maxRetries: 1, delayMs: 2000 },
        {
          match: isECONNRESETError,
          maxRetries: ECONNRESET_MAX_RETRIES,
          delayMs: ({ retryCount }) =>
            Math.min(ECONNRESET_RETRY_INITIAL_DELAY_MS * Math.pow(2, retryCount), ECONNRESET_RETRY_MAX_DELAY_MS),
        },
      ],
    }),
    new PrefillErrorHandler(),
  ];
}
