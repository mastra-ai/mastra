import type { ModelGenerationAttributes } from '@mastra/core/observability';
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
  time_to_first_token?: number;
  [key: string]: number | undefined;
}

export function normalizeUsageMetrics(modelAttr: ModelGenerationAttributes): BraintrustUsageMetrics {
  const metrics: BraintrustUsageMetrics = {};
  const usage = modelAttr.usage;

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

  // Time to first token (TTFT) for streaming responses
  if (modelAttr.completionStartTime) {
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
