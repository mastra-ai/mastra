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
  const labels = { status: span.errorInfo ? 'error' : 'ok' };

  // Tag MODEL_GENERATION duration with provider+model so the metric row carries
  // the same model dimension as the token metrics emitted alongside it. Other
  // span types intentionally skip this — a single agent/workflow/tool run can
  // involve multiple models, so attributing the duration to one is misleading.
  const costContext =
    span.type === SpanType.MODEL_GENERATION
      ? deriveBaseCostContext(span.attributes as ModelGenerationAttributes | undefined)
      : undefined;

  metrics.emit(durationMetricName, durationMs, labels, costContext ? { costContext } : undefined);
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

/**
 * Emit token usage metrics from an explicit usage payload, using the supplied
 * metrics context (which carries entity / parent / root labels) and the
 * supplied provider+model for cost lookup.
 *
 * Used when an internal MODEL_GENERATION's usage is rolled up to a visible
 * ancestor span: the metric labels come from the ancestor's context, the
 * cost calculation still uses the original model that incurred the tokens.
 */
export function emitTokenMetricsForUsage(
  usage: UsageStats,
  provider: string | undefined,
  model: string | undefined,
  metrics: MetricsContext,
): void {
  emitUsageMetrics({ provider, model } as ModelGenerationAttributes, usage, metrics);
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
  const baseCostContext = deriveBaseCostContext(attrs);

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
    // Fall back to a provider+model-only context so the metric row keeps the
    // model dimension queryable even when pricing lookup is skipped (no model)
    // or throws.
    const costContext = metricCosts.get(name) ?? baseCostContext;
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

function deriveBaseCostContext(attrs: ModelGenerationAttributes | undefined): CostContext | undefined {
  const provider = attrs?.provider;
  const model = attrs?.responseModel ?? attrs?.model;
  if (!provider && !model) return undefined;
  return { provider, model };
}

function getDurationMetricName(span: AnySpan): string | null {
  switch (span.type) {
    case SpanType.AGENT_RUN:
      return 'mastra_agent_duration_ms';
    case SpanType.TOOL_CALL:
    case SpanType.MCP_TOOL_CALL:
      return 'mastra_tool_duration_ms';
    case SpanType.CLIENT_TOOL_CALL:
      // The CLIENT_TOOL_CALL server span measures only carrier emission
      // and args capture. The actual client execution duration is
      // emitted by the client observability proxy using the wall-clock
      // duration measured in @mastra/client-js.
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
