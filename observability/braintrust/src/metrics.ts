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
  const usage = modelAttr.usage;

  // Input tokens (prompt_tokens)
  if (usage?.inputTokens !== undefined) {
    metrics.prompt_tokens = usage.inputTokens;
  } else if (usage?.promptTokens !== undefined) {
    metrics.prompt_tokens = usage.promptTokens;
  }

  // Output tokens (completion_tokens)
  if (usage?.outputTokens !== undefined) {
    metrics.completion_tokens = usage.outputTokens;
  } else if (usage?.completionTokens !== undefined) {
    metrics.completion_tokens = usage.completionTokens;
  }

  // Total tokens
  if (usage?.totalTokens !== undefined) {
    metrics.tokens = usage.totalTokens;
  }

  // Reasoning tokens - prefer new inputDetails/outputDetails, fallback to legacy
  if (usage?.outputDetails?.reasoning !== undefined) {
    metrics.completion_reasoning_tokens = usage.outputDetails.reasoning;
  } else if (usage?.reasoningTokens !== undefined) {
    metrics.completion_reasoning_tokens = usage.reasoningTokens;
  }

  // Cache read tokens (prompt_cached_tokens) - prefer new inputDetails, fallback to legacy
  if (usage?.inputDetails?.cacheRead !== undefined) {
    metrics.prompt_cached_tokens = usage.inputDetails.cacheRead;
  } else if (usage?.cachedInputTokens !== undefined) {
    metrics.prompt_cached_tokens = usage.cachedInputTokens;
  } else if (usage?.promptCacheHitTokens !== undefined) {
    metrics.prompt_cached_tokens = usage.promptCacheHitTokens;
  }

  // Cache write tokens (prompt_cache_creation_tokens) - prefer new inputDetails, fallback to legacy
  if (usage?.inputDetails?.cacheWrite !== undefined) {
    metrics.prompt_cache_creation_tokens = usage.inputDetails.cacheWrite;
  } else if (usage?.promptCacheMissTokens !== undefined) {
    metrics.prompt_cache_creation_tokens = usage.promptCacheMissTokens;
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
