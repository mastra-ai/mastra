import type { IMastraLogger } from '../logger';

/**
 * Safety cap applied to error-processor retries when the caller has not set
 * `maxProcessorRetries` explicitly.
 *
 * This is a backstop against a processor that returns `{ retry: true }`
 * unconditionally — not a retry budget to design against. Every built-in error
 * processor self-limits to at most one retry (`PrefillErrorHandler` and
 * `ProviderHistoryCompat` bail on `retryCount > 0`, `StreamErrorRetryProcessor`
 * defaults to `maxRetries: 1`), so this cap only takes effect for a processor
 * that never stops asking.
 *
 * Kept deliberately low: each retry is a full model call billed to the user and
 * also consumes an iteration of the agent's step budget (`stopWhen`, which
 * itself defaults to 5 steps). Callers who genuinely need more must opt in via
 * `maxProcessorRetries`.
 */
export const DEFAULT_MAX_PROCESSOR_RETRIES = 3;

const warnedAgents = new Set<string>();

/**
 * Resolves the effective error-processor retry cap, warning once per agent when
 * the implicit cap is what's keeping a processor in check.
 */
export function resolveMaxProcessorRetries({
  maxProcessorRetries,
  hasErrorProcessors,
  agentId,
  logger,
}: {
  maxProcessorRetries: number | undefined;
  hasErrorProcessors: boolean;
  agentId?: string;
  logger?: IMastraLogger;
}): number | undefined {
  if (maxProcessorRetries !== undefined) return maxProcessorRetries;
  if (!hasErrorProcessors) return undefined;

  const key = agentId ?? 'unknown';
  if (!warnedAgents.has(key)) {
    warnedAgents.add(key);
    logger?.warn?.(
      `errorProcessors are configured without an explicit \`maxProcessorRetries\`. ` +
        `Falling back to a safety cap of ${DEFAULT_MAX_PROCESSOR_RETRIES} retries, so a single turn can make up to ` +
        `${DEFAULT_MAX_PROCESSOR_RETRIES + 1} model calls. Set \`maxProcessorRetries\` to control this explicitly.`,
      { agentId },
    );
  }

  return DEFAULT_MAX_PROCESSOR_RETRIES;
}

/** Test-only: clears the one-time warning dedupe. */
export function __resetProcessorRetryWarnings() {
  warnedAgents.clear();
}
