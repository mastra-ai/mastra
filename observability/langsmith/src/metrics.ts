import type { LLMGenerationAttributes } from '@mastra/core/ai-tracing';
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

export function normalizeUsageMetrics(llmAttr: LLMGenerationAttributes): LangSmithUsageMetrics {
  const metrics: LangSmithUsageMetrics = {};

  if (llmAttr.usage?.inputTokens !== undefined) {
    metrics.input_tokens = llmAttr.usage?.inputTokens;
  } else if (llmAttr.usage?.promptTokens !== undefined) {
    metrics.input_tokens = llmAttr.usage?.promptTokens;
  }

  if (llmAttr.usage?.outputTokens !== undefined) {
    metrics.output_tokens = llmAttr.usage?.outputTokens;
  } else if (llmAttr.usage?.completionTokens !== undefined) {
    metrics.output_tokens = llmAttr.usage?.completionTokens;
  }

  if (llmAttr.usage?.totalTokens !== undefined) {
    metrics.total_tokens = llmAttr.usage?.totalTokens;
  } else if (typeof llmAttr.usage?.inputTokens === 'number' && typeof llmAttr.usage?.outputTokens === 'number') {
    metrics.total_tokens = llmAttr.usage?.inputTokens + llmAttr.usage?.outputTokens;
  }
  if (llmAttr.usage?.reasoningTokens !== undefined) {
    metrics.output_token_details = {
      ...(metrics.output_token_details ?? {}),
      reasoning_tokens: llmAttr.usage?.reasoningTokens,
    };
  }
  if (llmAttr.usage?.promptCacheHitTokens !== undefined) {
    metrics.input_token_details = {
      ...(metrics.input_token_details ?? {}),
      cache_read: llmAttr.usage?.promptCacheHitTokens,
    };
  }
  if (llmAttr.usage?.promptCacheMissTokens !== undefined) {
    metrics.input_token_details = {
      ...(metrics.input_token_details ?? {}),
      cache_write: llmAttr.usage?.promptCacheMissTokens,
    };
  }

  return metrics;
}
