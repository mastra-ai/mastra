import type { ModelGenerationAttributes, UsageStats } from '@mastra/core/observability';
import type tracer from 'dd-trace';

/**
 * Normalizes AI SDK v4/v5 token usage to Datadog format.
 */
// type DatadogUsage = ModelGenerationAttributes['usage'] & {
//   promptTokens?: number;
//   completionTokens?: number;
//   totalTokens?: number;
//   reasoningTokens?: number;
//   cachedInputTokens?: number;
//   promptCacheHitTokens?: number;
// };

type DatadogAnnotationMetrics = tracer.llmobs.AnnotationOptions['metrics'];

export function formatUsageMetrics(usage?: UsageStats): DatadogAnnotationMetrics | undefined {
  if (!usage) return undefined;

  const result: DatadogAnnotationMetrics = {};

  const inputTokens = usage.inputTokens;
  if (inputTokens !== undefined) result.inputTokens = inputTokens;

  const outputTokens = usage.outputTokens;
  if (outputTokens !== undefined) result.outputTokens = outputTokens;

  if (inputTokens !== undefined && outputTokens !== undefined) {
    result.totalTokens = inputTokens + outputTokens;
  }

  if (usage?.outputDetails?.reasoning !== undefined) {
    result.reasoningTokens = usage.outputDetails.reasoning;
  }

  const cachedTokens = usage?.inputDetails?.cacheRead;
  if (cachedTokens !== undefined) {
    result.cachedInputTokens = cachedTokens;
  }

  const cachedOutputTokens = usage?.inputDetails?.cacheWrite;
  if (cachedOutputTokens !== undefined) {
    result.cachedOutputTokens = cachedOutputTokens;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}
