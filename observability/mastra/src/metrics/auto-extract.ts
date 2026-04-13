/**
 * Emits metrics derived from live spans.
 */

import { SpanType } from '@mastra/core/observability';
import type { AnySpan, CostContext, MetricsContext, ModelGenerationAttributes } from '@mastra/core/observability';
import { estimateCosts } from './estimator';
import type { TokenMetrics } from './types';
import { getTokenMetricSamples } from './usage-metrics';

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

  for (const sample of getTokenMetricSamples(usage)) {
    emit(sample.name, sample.value);
  }
}

function getDurationMetricName(span: AnySpan): string | null {
  switch (span.type) {
    case SpanType.AGENT_RUN:
      return 'mastra_agent_duration_ms';
    case SpanType.TOOL_CALL:
    case SpanType.MCP_TOOL_CALL:
      return 'mastra_tool_duration_ms';
    case SpanType.CLIENT_TOOL_CALL:
      // CLIENT_TOOL_CALL is an event span (no endTime) so the
      // duration cannot be derived from the live span here.
      // The actual mastra_tool_duration_ms metric for client tools is
      // emitted by the client observability proxy in
      // observability/mastra/src/client/proxy.ts using the
      // wall-clock duration the collector measured on the client.
      // It uses the same metric name with a `toolType: 'client'`
      // label to distinguish it from server-side tool durations.
      return null;
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
