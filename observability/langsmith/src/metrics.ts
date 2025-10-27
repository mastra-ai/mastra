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

  if (modelAttr.usage?.inputTokens !== undefined) {
    metrics.input_tokens = modelAttr.usage?.inputTokens;
  } else if (modelAttr.usage?.promptTokens !== undefined) {
    metrics.input_tokens = modelAttr.usage?.promptTokens;
  }

  if (modelAttr.usage?.outputTokens !== undefined) {
    metrics.output_tokens = modelAttr.usage?.outputTokens;
  } else if (modelAttr.usage?.completionTokens !== undefined) {
    metrics.output_tokens = modelAttr.usage?.completionTokens;
  }

  if (modelAttr.usage?.totalTokens !== undefined) {
    metrics.total_tokens = modelAttr.usage?.totalTokens;
  } else if (typeof modelAttr.usage?.inputTokens === 'number' && typeof modelAttr.usage?.outputTokens === 'number') {
    metrics.total_tokens = modelAttr.usage?.inputTokens + modelAttr.usage?.outputTokens;
  }
  if (modelAttr.usage?.reasoningTokens !== undefined) {
    metrics.output_token_details = {
      ...(metrics.output_token_details ?? {}),
      reasoning_tokens: modelAttr.usage?.reasoningTokens,
    };
  }
  if (modelAttr.usage?.promptCacheHitTokens !== undefined) {
    metrics.input_token_details = {
      ...(metrics.input_token_details ?? {}),
      cache_read: modelAttr.usage?.promptCacheHitTokens,
    };
  }
  if (modelAttr.usage?.promptCacheMissTokens !== undefined) {
    metrics.input_token_details = {
      ...(metrics.input_token_details ?? {}),
      cache_write: modelAttr.usage?.promptCacheMissTokens,
    };
  }

  return metrics;
}
