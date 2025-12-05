import type { ModelGenerationAttributes } from '@mastra/core/observability';
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
  [key: string]: number | { [key: string]: number } | undefined;
}

export function normalizeUsageMetrics(modelAttr: ModelGenerationAttributes): LangSmithUsageMetrics {
  const metrics: LangSmithUsageMetrics = {};
  const usage = modelAttr.usage;

  // Input tokens
  if (usage?.inputTokens !== undefined) {
    metrics.input_tokens = usage.inputTokens;
  } else if (usage?.promptTokens !== undefined) {
    metrics.input_tokens = usage.promptTokens;
  }

  // Output tokens
  if (usage?.outputTokens !== undefined) {
    metrics.output_tokens = usage.outputTokens;
  } else if (usage?.completionTokens !== undefined) {
    metrics.output_tokens = usage.completionTokens;
  }

  // Total tokens
  if (usage?.totalTokens !== undefined) {
    metrics.total_tokens = usage.totalTokens;
  } else if (typeof usage?.inputTokens === 'number' && typeof usage?.outputTokens === 'number') {
    metrics.total_tokens = usage.inputTokens + usage.outputTokens;
  }

  // Reasoning tokens - prefer new outputDetails, fallback to legacy
  const reasoningTokens = usage?.outputDetails?.reasoning ?? usage?.reasoningTokens;
  if (reasoningTokens !== undefined) {
    metrics.output_token_details = {
      ...(metrics.output_token_details ?? {}),
      reasoning_tokens: reasoningTokens,
    };
  }

  // Cache read tokens - prefer new inputDetails, fallback to legacy
  const cacheRead = usage?.inputDetails?.cacheRead ?? usage?.cachedInputTokens ?? usage?.promptCacheHitTokens;
  if (cacheRead !== undefined) {
    metrics.input_token_details = {
      ...(metrics.input_token_details ?? {}),
      cache_read: cacheRead,
    };
  }

  // Cache write tokens - prefer new inputDetails, fallback to legacy
  const cacheWrite = usage?.inputDetails?.cacheWrite ?? usage?.promptCacheMissTokens;
  if (cacheWrite !== undefined) {
    metrics.input_token_details = {
      ...(metrics.input_token_details ?? {}),
      cache_write: cacheWrite,
    };
  }

  // Audio tokens from inputDetails/outputDetails
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
