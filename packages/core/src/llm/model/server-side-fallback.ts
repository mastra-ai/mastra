/**
 * Anthropic server-side fallback detection.
 *
 * When a fallback chain is configured via `providerOptions.anthropic.fallbacks`
 * and the primary model's safety classifiers decline a turn, the Anthropic API
 * transparently retries the turn on the fallback model and returns that
 * model's answer. The substitution is reported via `fallback_message` entries
 * in `providerMetadata.anthropic.iterations`, each carrying the model that
 * served the retry.
 */

export interface ServerSideFallbackInfo {
  /** Id of the fallback model that served the turn, when reported. */
  model?: string;
}

/**
 * Detect whether a turn was served by an Anthropic server-side fallback model.
 * Returns `undefined` when no fallback fired; otherwise returns the fallback
 * model id when the provider reported one.
 */
export function getServerSideFallbackInfo(providerMetadata: unknown): ServerSideFallbackInfo | undefined {
  const iterations = (providerMetadata as { anthropic?: { iterations?: unknown } } | undefined)?.anthropic?.iterations;
  if (!Array.isArray(iterations)) {
    return undefined;
  }
  const fallback = [...iterations]
    .reverse()
    .find(
      (iter): iter is { type: string; model?: unknown } =>
        typeof iter === 'object' && iter !== null && (iter as { type?: unknown }).type === 'fallback_message',
    );
  if (!fallback) {
    return undefined;
  }
  return typeof fallback.model === 'string' && fallback.model ? { model: fallback.model } : {};
}

/**
 * Resolve the model id that actually generated a response, accounting for
 * Anthropic server-side fallbacks. Prefers the fallback model reported in
 * provider metadata over the response's own model id, so tracing/metrics
 * attribute the turn to the model that actually served it.
 */
export function resolveResponseModelId(
  providerMetadata: unknown,
  responseModelId: string | undefined,
): string | undefined {
  return getServerSideFallbackInfo(providerMetadata)?.model ?? responseModelId;
}
