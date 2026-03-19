/**
 * Emits metrics derived from live spans.
 */

import { SpanType } from '@mastra/core/observability';
import type {
  AnySpan,
  CostContext,
  MetricsContext,
  ModelGenerationAttributes,
  UsageStats,
} from '@mastra/core/observability';
import { estimateMetricCost } from './estimator';
import type { CostEstimator } from './estimator';

const defaultCostEstimator: CostEstimator = {
  estimateCost: () => {
    throw new Error('estimateCost is not used by auto-extract');
  },
  estimateMetricCost,
};

/** Emit duration metrics for a live span. */
export function emitDurationMetrics(span: AnySpan, metrics: MetricsContext): void {
  const durationMetricName = getDurationMetricName(span);
  if (!durationMetricName || !span.startTime || !span.endTime) {
    return;
  }

  const durationMs = span.endTime.getTime() - span.startTime.getTime();
  metrics.emit(durationMetricName, durationMs, {
    status: span.errorInfo ? 'error' : 'ok',
  });
}

/** Emit token usage metrics for a model-generation span. */
export function emitTokenMetrics(
  span: AnySpan,
  metrics: MetricsContext,
  costEstimator: CostEstimator = defaultCostEstimator,
): void {
  if (span.type !== SpanType.MODEL_GENERATION) {
    return;
  }

  const attrs = span.attributes as ModelGenerationAttributes | undefined;
  if (!attrs?.usage) {
    return;
  }

  emitUsageMetrics(attrs, attrs.usage, metrics, costEstimator);
}

/** Emit all auto-extracted metrics for a live span end. */
export function emitAutoExtractedMetrics(
  span: AnySpan,
  metrics: MetricsContext,
  costEstimator: CostEstimator = defaultCostEstimator,
): void {
  emitDurationMetrics(span, metrics);
  emitTokenMetrics(span, metrics, costEstimator);
}

function emitUsageMetrics(
  attrs: ModelGenerationAttributes,
  usage: UsageStats,
  metrics: MetricsContext,
  costEstimator: CostEstimator,
): void {
  const emit = (name: string, value: number) =>
    metrics.emit(name, value, undefined, {
      costContext: buildCostContext({
        attrs,
        metricName: name,
        value,
        usage,
        costEstimator,
      }),
    });
  const emitNonZero = (name: string, value: number) => {
    if (value > 0) emit(name, value);
  };

  emit('mastra_model_total_input_tokens', usage.inputTokens ?? 0);
  emit('mastra_model_total_output_tokens', usage.outputTokens ?? 0);

  if (usage.inputDetails) {
    emitNonZero('mastra_model_input_text_tokens', usage.inputDetails.text ?? 0);
    emitNonZero('mastra_model_input_cache_read_tokens', usage.inputDetails.cacheRead ?? 0);
    emitNonZero('mastra_model_input_cache_write_tokens', usage.inputDetails.cacheWrite ?? 0);
    emitNonZero('mastra_model_input_audio_tokens', usage.inputDetails.audio ?? 0);
    emitNonZero('mastra_model_input_image_tokens', usage.inputDetails.image ?? 0);
  }

  if (usage.outputDetails) {
    emitNonZero('mastra_model_output_text_tokens', usage.outputDetails.text ?? 0);
    emitNonZero('mastra_model_output_reasoning_tokens', usage.outputDetails.reasoning ?? 0);
    emitNonZero('mastra_model_output_audio_tokens', usage.outputDetails.audio ?? 0);
    emitNonZero('mastra_model_output_image_tokens', usage.outputDetails.image ?? 0);
  }
}

function buildCostContext({
  attrs,
  metricName,
  value,
  usage,
  costEstimator,
}: {
  attrs: ModelGenerationAttributes;
  metricName: string;
  value: number;
  usage: UsageStats;
  costEstimator: CostEstimator;
}): CostContext | undefined {
  const provider = attrs.provider;
  const model = attrs.responseModel ?? attrs.model;

  if (!provider && !model) {
    return undefined;
  }

  const estimate = costEstimator.estimateMetricCost({
    provider,
    model,
    metricName,
    value,
    totalInputTokens: usage.inputTokens,
    totalOutputTokens: usage.outputTokens,
  });

  return {
    provider,
    model,
    estimatedCost: estimate.estimatedCost ?? undefined,
    costUnit: estimate.costUnit ?? undefined,
    costMetadata: {
      estimationStatus: estimate.status,
      ...(estimate.costMetadata ?? {}),
    },
  };
}

function getDurationMetricName(span: AnySpan): string | null {
  switch (span.type) {
    case SpanType.AGENT_RUN:
      return 'mastra_agent_duration_ms';
    case SpanType.TOOL_CALL:
      return 'mastra_tool_duration_ms';
    case SpanType.WORKFLOW_RUN:
      return 'mastra_workflow_duration_ms';
    case SpanType.MODEL_GENERATION:
      return 'mastra_model_duration_ms';
    default:
      return null;
  }
}
