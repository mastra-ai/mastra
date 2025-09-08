import type { LLMGenerationAttributes } from '@mastra/core/ai-tracing';
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
 */
export interface BraintrustUsageMetrics {
  prompt_tokens?: number;
  completion_tokens?: number;
  tokens?: number;
  completion_reasoning_tokens?: number;
  prompt_cached_tokens?: number;
  prompt_cache_creation_tokens?: number;
  [key: string]: number | undefined;
}

export function normalizeUsageMetrics(
  llmAttr: LLMGenerationAttributes,
): BraintrustUsageMetrics {
  const metrics: BraintrustUsageMetrics = {};
  
  if (llmAttr.usage?.promptTokens !== undefined) {
    metrics.prompt_tokens = llmAttr.usage?.promptTokens;
  }
  if (llmAttr.usage?.completionTokens !== undefined) {
    metrics.completion_tokens = llmAttr.usage?.completionTokens;
  }
  if (llmAttr.usage?.totalTokens !== undefined) {
    metrics.tokens = llmAttr.usage?.totalTokens;
  }
  if (llmAttr.usage?.promptCacheHitTokens !== undefined) {
    metrics.prompt_cached_tokens = llmAttr.usage?.promptCacheHitTokens;
  }
  if (llmAttr.usage?.promptCacheMissTokens !== undefined) {
    metrics.prompt_cache_creation_tokens = llmAttr.usage?.promptCacheMissTokens;
  }

  return metrics;
}

