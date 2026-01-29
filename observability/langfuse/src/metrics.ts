import type { UsageStats } from '@mastra/core/observability';

/**
 * Token usage format compatible with Langfuse.
 */
export interface LangfuseUsageMetrics {
  input?: number;
  output?: number;
  total?: number;
  reasoning?: number;
  cache_read_input_tokens?: number;
  cache_write_input_tokens?: number;
}

/**
 * Formats UsageStats to Langfuse's expected format.
 */
export function formatUsageMetrics(usage?: UsageStats): LangfuseUsageMetrics {
  if (!usage) return {};

  const metrics: LangfuseUsageMetrics = {};

  if (usage.inputTokens !== undefined) {
    // Start with total input tokens (which includes cached tokens from usage.ts)
    metrics.input = usage.inputTokens;

    // Langfuse expects 'input' to be NON-cached tokens only.
    // Subtract cache tokens to get the actual non-cached input count.
    // See: https://langfuse.com/docs/observability/features/token-and-cost-tracking
    if (usage.inputDetails?.cacheRead !== undefined) {
      metrics.cache_read_input_tokens = usage.inputDetails.cacheRead;
      metrics.input -= metrics.cache_read_input_tokens;
    }

    if (usage.inputDetails?.cacheWrite !== undefined) {
      metrics.cache_write_input_tokens = usage.inputDetails.cacheWrite;
      metrics.input -= metrics.cache_write_input_tokens;
    }

    // Defensive clamp: ensure input tokens is never negative
    if (metrics.input < 0) metrics.input = 0;
  }

  if (usage.outputTokens !== undefined) {
    metrics.output = usage.outputTokens;
  }

  if (usage.outputDetails?.reasoning !== undefined) {
    metrics.reasoning = usage.outputDetails.reasoning;
  }

  // Calculate total: input + cache_read + cache_write + output
  // Use explicit null checks to handle zero values correctly
  if (metrics.input != null && metrics.output != null) {
    metrics.total = metrics.input + metrics.output;
    if (metrics.cache_read_input_tokens != null) {
      metrics.total += metrics.cache_read_input_tokens;
    }
    if (metrics.cache_write_input_tokens != null) {
      metrics.total += metrics.cache_write_input_tokens;
    }
  }

  return metrics;
}
