import type { UsageStats } from '@mastra/core/observability';

/**
 * LangSmithUsageMetrics
 *
 * Canonical metric keys expected by LangSmith for LLM usage accounting.
 * See: https://docs.langchain.com/langsmith/log-llm-trace#provide-token-and-cost-information
 */
export interface LangSmithUsageMetrics {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  input_token_details?: {
    [key: string]: number;
  };
  output_token_details?: {
    [key: string]: number;
  };
}

/**
 * Formats UsageStats to LangSmith's expected metric format.
 */
export function formatUsageMetrics(usage?: UsageStats): LangSmithUsageMetrics {
  const metrics: LangSmithUsageMetrics = {};

  if (usage?.inputTokens !== undefined) {
    metrics.input_tokens = usage.inputTokens;
  }

  if (usage?.outputTokens !== undefined) {
    metrics.output_tokens = usage.outputTokens;
  }

  // Compute total if we have both
  if (metrics.input_tokens !== undefined && metrics.output_tokens !== undefined) {
    metrics.total_tokens = metrics.input_tokens + metrics.output_tokens;
  }

  if (usage?.outputDetails?.reasoning !== undefined) {
    metrics.output_token_details = {
      ...(metrics.output_token_details ?? {}),
      reasoning_tokens: usage.outputDetails.reasoning,
    };
  }

  if (usage?.inputDetails?.cacheRead !== undefined) {
    metrics.input_token_details = {
      ...(metrics.input_token_details ?? {}),
      cache_read: usage.inputDetails.cacheRead,
    };
  }

  if (usage?.inputDetails?.cacheWrite !== undefined) {
    metrics.input_token_details = {
      ...(metrics.input_token_details ?? {}),
      cache_write: usage.inputDetails.cacheWrite,
    };
  }

  if (usage?.inputDetails?.audio !== undefined) {
    metrics.input_token_details = {
      ...(metrics.input_token_details ?? {}),
      audio: usage.inputDetails.audio,
    };
  }

  if (usage?.outputDetails?.audio !== undefined) {
    metrics.output_token_details = {
      ...(metrics.output_token_details ?? {}),
      audio: usage.outputDetails.audio,
    };
  }

  return metrics;
}
