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
    metrics.input = usage.inputTokens;

    if (usage.inputDetails?.cacheWrite !== undefined) {
      metrics.cache_write_input_tokens = usage.inputDetails.cacheWrite;
      metrics.input -= metrics.cache_write_input_tokens;
    }
  }

  if (usage.inputDetails?.cacheRead !== undefined) {
    metrics.cache_read_input_tokens = usage.inputDetails.cacheRead;
  }

  if (usage.outputTokens !== undefined) {
    metrics.output = usage.outputTokens;
  }

  if (usage.outputDetails?.reasoning !== undefined) {
    metrics.reasoning = usage.outputDetails.reasoning;
  }

  if (metrics.input && metrics.output) {
    metrics.total = metrics.input + metrics.output;
    if (metrics.cache_write_input_tokens) {
      metrics.total += metrics.cache_write_input_tokens;
    }
  }

  return metrics;
}
