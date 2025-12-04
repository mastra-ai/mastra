import type { ModelGenerationAttributes } from '@mastra/core/observability';
/**
 * BraintrustUsageMetrics
 *
 * Canonical metric keys expected by Braintrust for LLM usage accounting.
 * These map various provider/SDK-specific usage fields to a common schema.
 * - prompt_tokens: input-side tokens (aka inputTokens/promptTokens)
 * - completion_tokens: output-side tokens (aka outputTokens/completionTokens)
 * - tokens: total tokens (provided or derived)
 * - completion_reasoning_tokens: reasoning tokens, when available
 * - prompt_cached_tokens: tokens served from cache (provider-specific)
 * - prompt_cache_creation_tokens: tokens used to create cache (provider-specific)
 * - time_to_first_token: timestamp (ms since epoch) when first token arrived (streaming only)
 */
export interface BraintrustUsageMetrics {
  prompt_tokens?: number;
  completion_tokens?: number;
  tokens?: number;
  completion_reasoning_tokens?: number;
  prompt_cached_tokens?: number;
  prompt_cache_creation_tokens?: number;
  time_to_first_token?: number;
  [key: string]: number | undefined;
}

export function normalizeUsageMetrics(modelAttr: ModelGenerationAttributes): BraintrustUsageMetrics {
  const metrics: BraintrustUsageMetrics = {};

  if (modelAttr.usage?.inputTokens !== undefined) {
    metrics.prompt_tokens = modelAttr.usage?.inputTokens;
  } else if (modelAttr.usage?.promptTokens !== undefined) {
    metrics.prompt_tokens = modelAttr.usage?.promptTokens;
  }

  if (modelAttr.usage?.outputTokens !== undefined) {
    metrics.completion_tokens = modelAttr.usage?.outputTokens;
  } else if (modelAttr.usage?.completionTokens !== undefined) {
    metrics.completion_tokens = modelAttr.usage?.completionTokens;
  }

  if (modelAttr.usage?.totalTokens !== undefined) {
    metrics.tokens = modelAttr.usage?.totalTokens;
  }
  if (modelAttr.usage?.reasoningTokens !== undefined) {
    metrics.completion_reasoning_tokens = modelAttr.usage?.reasoningTokens;
  }
  if (modelAttr.usage?.promptCacheHitTokens !== undefined) {
    metrics.prompt_cached_tokens = modelAttr.usage?.promptCacheHitTokens;
  }
  if (modelAttr.usage?.promptCacheMissTokens !== undefined) {
    metrics.prompt_cache_creation_tokens = modelAttr.usage?.promptCacheMissTokens;
  }

  // Time to first token (TTFT) for streaming responses
  if (modelAttr.completionStartTime) {
    // Handle both Date objects and already-converted timestamps (number/string)
    const startTime = modelAttr.completionStartTime;
    if (startTime instanceof Date) {
      metrics.time_to_first_token = startTime.getTime();
    } else if (typeof startTime === 'number') {
      metrics.time_to_first_token = startTime;
    } else if (typeof startTime === 'string') {
      metrics.time_to_first_token = new Date(startTime).getTime();
    }
  }

  return metrics;
}
