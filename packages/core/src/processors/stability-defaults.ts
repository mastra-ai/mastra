import { PrefillErrorHandler } from './prefill-error-handler';
import { ProviderHistoryCompat } from './provider-history-compat';
import { isBadRequestError, StreamErrorRetryProcessor } from './stream-error-retry-processor';
import type { ErrorProcessorOrWorkflow } from './index';

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
 * `{ retry: true }`, so the two processors that repair a request must run
 * **before** `stream-error-retry-processor`, whose retry matchers resend the
 * request unchanged.
 *
 * `stream-error-retry-processor` goes last for that reason. Whichever repair
 * processor matches first gets its one shot at fixing the request; the retry
 * processor is the backstop for everything the repairs do not claim.
 */
export const STABILITY_ERROR_PROCESSOR_IDS = [
  'provider-history-compat',
  'prefill-error-handler',
  'stream-error-retry-processor',
] as const;

/**
 * Builds the default stability error processors every agent gets when the
 * caller supplies no `errorProcessors`.
 *
 * Turning these on means a plain `new Agent({...})` recovers from three
 * provider-side failure classes without any caller wiring:
 *
 * - provider history incompatibilities (e.g. another provider's tool calls or
 *   reasoning content in the history);
 * - assistant-prefill rejections from Anthropic/Qwen-style models;
 * - transient stream/connection failures — including a bare `500`/`isRetryable`
 *   error that would otherwise surface as an empty response.
 *
 * The retry processor keeps `retryUnknownErrors` off by default and carries no
 * bad-request matcher. Transient failures carry provider `isRetryable`
 * metadata or match the connection-reset matcher, so the three classes above
 * still recover, while a deterministic failure — a rejected structured-output
 * attempt, an invalid request, a validation error — surfaces immediately
 * instead of being replayed unchanged. Most `400`s are deterministic, so the
 * bad-request matcher is opt-in: pass `{ retryBadRequests: true }` here (as
 * `createCodingAgent` does) or configure your own
 * `StreamErrorRetryProcessor` in `errorProcessors`. Pass
 * `{ retryUnknownErrors: true }` likewise to retry unmatched errors.
 *
 * A caller-supplied processor whose id matches one of these keeps its place at
 * that id's position; `errorProcessorDefaults: false` opts out entirely.
 *
 * Returns a fresh array of fresh instances on every call — never a shared
 * mutable array.
 */
export function defaultStabilityErrorProcessors(
  options: {
    /**
     * Retry errors that match no matcher and carry no `isRetryable` metadata.
     * Off by default: it turns one rejected model call into three. Callers that
     * want it — `createCodingAgent` does, and tests it — opt in.
     */
    retryUnknownErrors?: boolean;
    /**
     * Retry any HTTP `400` once after a 2s delay, on the chance it was a
     * spurious provider rejection. Off by default: most `400`s are
     * deterministic client errors, and replaying them unchanged cannot
     * succeed. The repair processors ahead of this one still claim and fix
     * every `400` they recognize, so this option only affects the `400`s no
     * repair could fix. `createCodingAgent` opts in, preserving its shipped
     * behavior.
     */
    retryBadRequests?: boolean;
  } = {},
): ErrorProcessorOrWorkflow[] {
  return [
    new ProviderHistoryCompat(),
    new PrefillErrorHandler(),
    new StreamErrorRetryProcessor({
      retryUnknownErrors: options.retryUnknownErrors ?? false,
      maxRetries: 2,
      delayMs: 3000,
      matchers: [
        ...(options.retryBadRequests ? [{ match: isBadRequestError, maxRetries: 1, delayMs: 2000 }] : []),
        {
          match: isECONNRESETError,
          maxRetries: ECONNRESET_MAX_RETRIES,
          delayMs: ({ retryCount }) =>
            Math.min(ECONNRESET_RETRY_INITIAL_DELAY_MS * Math.pow(2, retryCount), ECONNRESET_RETRY_MAX_DELAY_MS),
        },
      ],
    }),
  ];
}
