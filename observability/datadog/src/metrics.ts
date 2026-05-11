import type { UsageStats } from '@mastra/core/observability';
import type tracer from 'dd-trace';

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
    result.reasoningOutputTokens = usage.outputDetails.reasoning;
  }

  const cacheReadTokens = usage?.inputDetails?.cacheRead;
  if (cacheReadTokens !== undefined) {
    result.cacheReadTokens = cacheReadTokens;
  }

  const cacheWriteTokens = usage?.inputDetails?.cacheWrite;
  if (cacheWriteTokens !== undefined) {
    result.cacheWriteTokens = cacheWriteTokens;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}
