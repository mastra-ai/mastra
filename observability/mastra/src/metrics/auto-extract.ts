/**
 * AutoExtractedMetrics - Converts TracingEvents into MetricEvents automatically.
 *
 * When a tracing span ends, this class emits metric events for duration
 * and token usage (for model spans).
 */

import { SpanType, TracingEventType } from '@mastra/core/observability';
import type { TracingEvent, AnyExportedSpan, ModelGenerationAttributes, UsageStats } from '@mastra/core/observability';

import type { ObservabilityBus } from '../bus';

/**
 * Converts tracing span lifecycle events into metric events automatically.
 * Emits duration metrics for agent, tool, workflow, and model spans, plus
 * token usage metrics for model generation spans.
 */
export class AutoExtractedMetrics {
  constructor(private observabilityBus: ObservabilityBus) {}

  /**
   * Route a tracing event to the appropriate handler.
   * SPAN_ENDED emits duration and token metrics (for model spans).
   */
  processTracingEvent(event: TracingEvent): void {
    if (event.type === TracingEventType.SPAN_ENDED) {
      this.onSpanEnded(event.exportedSpan);
    }
  }

  /** Emit duration and token metrics when a span ends. */
  private onSpanEnded(span: AnyExportedSpan): void {
    const labels = this.extractLabels(span);

    // Duration
    const durationMetricName = this.getDurationMetricName(span);
    if (durationMetricName && span.startTime && span.endTime) {
      const durationMs = span.endTime.getTime() - span.startTime.getTime();
      const durationLabels = { ...labels };
      durationLabels.status = span.errorInfo ? 'error' : 'ok';
      this.observabilityBus.emitMetric(durationMetricName, durationMs, durationLabels);
    }

    // Token metrics for model generation spans
    if (span.type === SpanType.MODEL_GENERATION) {
      const attrs = span.attributes as ModelGenerationAttributes | undefined;
      if (attrs?.usage) {
        this.extractTokenMetrics(attrs.usage, labels);
      }
    }
  }

  /** Build base metric labels from a span's entity and model attributes. */
  private extractLabels(span: AnyExportedSpan): Record<string, string> {
    const labels: Record<string, string> = {};

    if (span.entityType) labels.entity_type = span.entityType;
    const entityName = span.entityName ?? span.entityId;
    if (entityName) labels.entity_name = entityName;

    // Model-specific labels (only on MODEL_GENERATION spans)
    if (span.type === SpanType.MODEL_GENERATION) {
      const attrs = span.attributes as ModelGenerationAttributes | undefined;
      if (attrs?.model) labels.model = attrs.model;
      if (attrs?.provider) labels.provider = attrs.provider;
    }

    return labels;
  }

  /** Emit token usage metrics from UsageStats. */
  private extractTokenMetrics(usage: UsageStats, labels: Record<string, string>): void {
    const emit = (name: string, value: number) => this.observabilityBus.emitMetric(name, value, labels);
    const emitNonZero = (name: string, value: number) => {
      if (value > 0) emit(name, value);
    };

    // Top-level token counts (always emit, even if zero)
    emit('mastra_model_total_input_tokens', usage.inputTokens ?? 0);
    emit('mastra_model_total_output_tokens', usage.outputTokens ?? 0);

    // Input token details (skip zeros)
    if (usage.inputDetails) {
      emitNonZero('mastra_model_input_text_tokens', usage.inputDetails.text ?? 0);
      emitNonZero('mastra_model_input_cache_read_tokens', usage.inputDetails.cacheRead ?? 0);
      emitNonZero('mastra_model_input_cache_write_tokens', usage.inputDetails.cacheWrite ?? 0);
      emitNonZero('mastra_model_input_audio_tokens', usage.inputDetails.audio ?? 0);
      emitNonZero('mastra_model_input_image_tokens', usage.inputDetails.image ?? 0);
    }

    // Output token details (skip zeros)
    if (usage.outputDetails) {
      emitNonZero('mastra_model_output_text_tokens', usage.outputDetails.text ?? 0);
      emitNonZero('mastra_model_output_reasoning_tokens', usage.outputDetails.reasoning ?? 0);
      emitNonZero('mastra_model_output_audio_tokens', usage.outputDetails.audio ?? 0);
      emitNonZero('mastra_model_output_image_tokens', usage.outputDetails.image ?? 0);
    }
  }

  /** Map a span type to its `*_duration_ms` metric name, or `null` for unsupported types. */
  private getDurationMetricName(span: AnyExportedSpan): string | null {
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
}
