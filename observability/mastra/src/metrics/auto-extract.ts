/**
 * Emits metrics derived from live spans.
 */

import { SpanType } from '@mastra/core/observability';
import type { AnySpan, CostContext, MetricsContext, ModelGenerationAttributes } from '@mastra/core/observability';
import { estimateCosts } from './estimator';
import { TokenMetrics } from './types';

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
export function emitTokenMetrics(span: AnySpan, metrics: MetricsContext): void {
  if (span.type !== SpanType.MODEL_GENERATION) {
    return;
  }

  const attrs = span.attributes as ModelGenerationAttributes | undefined;
  if (!attrs?.usage) {
    return;
  }

  emitUsageMetrics(attrs, attrs.usage, metrics);
}

/** Emit all auto-extracted metrics for a live span end. */
export function emitAutoExtractedMetrics(span: AnySpan, metrics: MetricsContext): void {
  emitDurationMetrics(span, metrics);
  emitTokenMetrics(span, metrics);
}

function emitUsageMetrics(
  attrs: ModelGenerationAttributes,
  usage: NonNullable<ModelGenerationAttributes['usage']>,
  metrics: MetricsContext,
): void {
  let metricCosts = new Map<TokenMetrics, CostContext>();
  try {
    const provider = attrs.provider;
    const model = attrs.responseModel ?? attrs.model;

    if (provider && model) {
      metricCosts = estimateCosts({
        provider,
        model,
        usage,
      });
    }
  } catch {
    metricCosts = new Map();
  }

  const emit = (name: TokenMetrics, value: number) => {
    const costContext = metricCosts.get(name);
    if (!costContext) {
      metrics.emit(name, value);
      return;
    }

    metrics.emit(name, value, undefined, { costContext });
  };

  emit(TokenMetrics.TOTAL_INPUT, usage.inputTokens ?? 0);
  emit(TokenMetrics.TOTAL_OUTPUT, usage.outputTokens ?? 0);

  if (usage.inputDetails) {
    if ((usage.inputDetails.text ?? 0) > 0) emit(TokenMetrics.INPUT_TEXT, usage.inputDetails.text ?? 0);
    if ((usage.inputDetails.cacheRead ?? 0) > 0) emit(TokenMetrics.INPUT_CACHE_READ, usage.inputDetails.cacheRead ?? 0);
    if ((usage.inputDetails.cacheWrite ?? 0) > 0)
      emit(TokenMetrics.INPUT_CACHE_WRITE, usage.inputDetails.cacheWrite ?? 0);
    if ((usage.inputDetails.audio ?? 0) > 0) emit(TokenMetrics.INPUT_AUDIO, usage.inputDetails.audio ?? 0);
    if ((usage.inputDetails.image ?? 0) > 0) emit(TokenMetrics.INPUT_IMAGE, usage.inputDetails.image ?? 0);
  }

  if (usage.outputDetails) {
    if ((usage.outputDetails.text ?? 0) > 0) emit(TokenMetrics.OUTPUT_TEXT, usage.outputDetails.text ?? 0);
    if ((usage.outputDetails.reasoning ?? 0) > 0)
      emit(TokenMetrics.OUTPUT_REASONING, usage.outputDetails.reasoning ?? 0);
    if ((usage.outputDetails.audio ?? 0) > 0) emit(TokenMetrics.OUTPUT_AUDIO, usage.outputDetails.audio ?? 0);
    if ((usage.outputDetails.image ?? 0) > 0) emit(TokenMetrics.OUTPUT_IMAGE, usage.outputDetails.image ?? 0);
  }
}

function getDurationMetricName(span: AnySpan): string | null {
  switch (span.type) {
    case SpanType.AGENT_RUN:
      return 'mastra_agent_duration_ms';
    case SpanType.TOOL_CALL:
    case SpanType.MCP_TOOL_CALL:
      return 'mastra_tool_duration_ms';
    case SpanType.WORKFLOW_RUN:
      return 'mastra_workflow_duration_ms';
    case SpanType.MODEL_GENERATION:
      return 'mastra_model_duration_ms';
    case SpanType.PROCESSOR_RUN:
      return 'mastra_processor_duration_ms';
    default:
      return null;
  }
}
