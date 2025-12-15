import type { UsageStats } from '@mastra/core/observability';

/**
 * BraintrustUsageMetrics
 *
 * Canonical metric keys expected by Braintrust for LLM usage accounting.
 */
export interface BraintrustUsageMetrics {
  prompt_tokens?: number;
  completion_tokens?: number;
  tokens?: number;
  completion_reasoning_tokens?: number;
  prompt_cached_tokens?: number;
  prompt_cache_creation_tokens?: number;
}

/**
 * Formats UsageStats to Braintrust's expected metric format.
 */
export function formatUsageMetrics(usage?: UsageStats): BraintrustUsageMetrics {
  const metrics: BraintrustUsageMetrics = {};

  if (usage?.inputTokens !== undefined) {
    metrics.prompt_tokens = usage.inputTokens;
  }

  if (usage?.outputTokens !== undefined) {
    metrics.completion_tokens = usage.outputTokens;
  }

  // Compute total if we have both
  if (metrics.prompt_tokens !== undefined && metrics.completion_tokens !== undefined) {
    metrics.tokens = metrics.prompt_tokens + metrics.completion_tokens;
  }

  if (usage?.outputDetails?.reasoning !== undefined) {
    metrics.completion_reasoning_tokens = usage.outputDetails.reasoning;
  }

  if (usage?.inputDetails?.cacheRead !== undefined) {
    metrics.prompt_cached_tokens = usage.inputDetails.cacheRead;
  }

  if (usage?.inputDetails?.cacheWrite !== undefined) {
    metrics.prompt_cache_creation_tokens = usage.inputDetails.cacheWrite;
  }

  return metrics;
}
