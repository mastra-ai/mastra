/**
 * Emits metrics derived from live spans.
 */

import { EntityType, SpanType } from '@mastra/core/observability';
import type {
  AnySpan,
  CostContext,
  MetricsContext,
  ModelGenerationAttributes,
  ProcessorPipelineAttributes,
  UsageStats,
} from '@mastra/core/observability';
import { resolveModelId } from '../model-id';
import { estimateCosts } from './estimator';
import { TokenMetrics } from './types';
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

/** Estimate costs and emit token usage metrics for a model-generation span. */
function emitUsageMetrics(
  attrs: ModelGenerationAttributes,
  usage: NonNullable<ModelGenerationAttributes['usage']>,
  metrics: MetricsContext,
): void {
  let metricCosts = new Map<TokenMetrics, CostContext>();
  const providedCostContext = getProvidedCostContext(attrs, usage);
  if (providedCostContext) {
    metricCosts = providedCostContext;
  } else {
    try {
      const provider = attrs.provider;
      const model = resolveModelId(attrs.responseModel, attrs.model);

      if (provider && model) {
        metricCosts = estimateCosts({
          provider,
          model,
          usage,
        });

        if (isNoMatchingModelResult(metricCosts) && attrs.model && attrs.model !== model) {
          const configuredModelCosts = estimateCosts({
            provider,
            model: attrs.model,
            usage,
          });

          if (!isNoMatchingModelResult(configuredModelCosts)) {
            metricCosts = configuredModelCosts;
          }
        }
      }
    } catch {
      metricCosts = new Map();
    }
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

function isNoMatchingModelResult(metricCosts: Map<TokenMetrics, CostContext>): boolean {
  return (
    metricCosts.size > 0 &&
    [...metricCosts.values()].every(costContext => costContext.costMetadata?.error === 'no_matching_model')
  );
}

function getProvidedCostContext(
  attrs: ModelGenerationAttributes,
  usage: NonNullable<ModelGenerationAttributes['usage']>,
): Map<TokenMetrics, CostContext> | undefined {
  const costContext = attrs.costContext;
  if (typeof costContext?.estimatedCost !== 'number') {
    return undefined;
  }

  const carrierMetric = usage.inputTokens !== undefined ? TokenMetrics.TOTAL_INPUT : TokenMetrics.TOTAL_OUTPUT;
  const provider = costContext.provider ?? attrs.provider;
  const model = resolveModelId(costContext.model, attrs.responseModel, attrs.model);
  const contexts = new Map<TokenMetrics, CostContext>();

  for (const sample of getTokenMetricSamples(usage)) {
    contexts.set(sample.name, {
      provider,
      model,
    });
  }

  contexts.set(carrierMetric, {
    ...costContext,
    provider,
    model,
    costMetadata: {
      ...costContext.costMetadata,
      allocation: 'query_total',
    },
  });

  return contexts;
}

/**
 * Entity types the processor runner assigns to the spans it creates, one per
 * pipeline phase.
 */
const PROCESSOR_ENTITY_TYPES = new Set<EntityType>([
  EntityType.INPUT_PROCESSOR,
  EntityType.INPUT_STEP_PROCESSOR,
  EntityType.OUTPUT_PROCESSOR,
  EntityType.OUTPUT_STEP_PROCESSOR,
  EntityType.TOOL_RESULT_PROCESSOR,
]);

/**
 * Whether this span measures a processor running, for `mastra_processor_duration_ms`.
 *
 * A processor may declare a domain span type (e.g. the skills processor emits
 * `SKILL_ACTION`), so `PROCESSOR_RUN` alone no longer identifies one. A
 * processor entity type alone is not enough either: spans that are not
 * processors borrow one — observational memory wraps its observer and reflector
 * model calls in a `GENERIC` span tagged `OUTPUT_STEP_PROCESSOR`, and counting
 * those model-call durations would swamp a metric measuring processor overhead.
 *
 * So require the pipeline attribute the runner stamps on every processor span
 * it creates ('legacy' from the runner, 'workflow' from processor workflows),
 * which spans merely borrowing the entity type do not set.
 */
function isProcessorSpan(span: AnySpan): boolean {
  if (!span.entityType || !PROCESSOR_ENTITY_TYPES.has(span.entityType)) return false;
  if (span.type === SpanType.PROCESSOR_RUN) return true;
  return Boolean((span.attributes as ProcessorPipelineAttributes | undefined)?.processorExecutor);
}

function getDurationMetricName(span: AnySpan): string | null {
  if (isProcessorSpan(span)) {
    return 'mastra_processor_duration_ms';
  }
  switch (span.type) {
    case SpanType.AGENT_RUN:
      return 'mastra_agent_duration_ms';
    case SpanType.TOOL_CALL:
    case SpanType.MCP_TOOL_CALL:
    case SpanType.PROVIDER_TOOL_CALL:
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
