/**
 * AutoExtractedMetrics - Converts TracingEvent, ScoreEvent, and FeedbackEvent
 * into MetricEvents automatically.
 *
 * Cross-emission pattern: When a tracing span ends, this class emits
 * metric events for agent runs, tool calls, workflow runs, and model
 * generation stats (including token usage).
 */

import { SpanType, TracingEventType } from '@mastra/core/observability';
import type {
  TracingEvent,
  ScoreEvent,
  FeedbackEvent,
  ExportedMetric,
  MetricEvent,
  MetricType,
  AnyExportedSpan,
} from '@mastra/core/observability';

import type { ObservabilityBus } from '../bus';
import type { CardinalityFilter } from './cardinality';

export class AutoExtractedMetrics {
  /**
   * @param observabilityBus - Bus used to emit derived MetricEvents.
   * @param cardinalityFilter - Optional filter applied to metric labels before emission.
   */
  constructor(
    private observabilityBus: ObservabilityBus,
    private cardinalityFilter?: CardinalityFilter,
  ) {}

  /**
   * Route a tracing event to the appropriate span lifecycle handler.
   * SPAN_STARTED increments a started counter; SPAN_ENDED emits ended counter,
   * duration histogram, and (for model spans) token counters.
   */
  processTracingEvent(event: TracingEvent): void {
    switch (event.type) {
      case TracingEventType.SPAN_STARTED:
        this.onSpanStarted(event.exportedSpan);
        break;
      case TracingEventType.SPAN_ENDED:
        this.onSpanEnded(event.exportedSpan);
        break;
    }
  }

  /** Emit a `mastra_scores_total` counter for a score event. */
  processScoreEvent(event: ScoreEvent): void {
    const labels: Record<string, string> = {
      scorer: event.score.scorerName,
    };
    if (event.score.metadata?.entityType) {
      labels.entity_type = String(event.score.metadata.entityType);
    }
    if (event.score.experimentId) {
      labels.experiment = event.score.experimentId;
    }
    this.emit('mastra_scores_total', 'counter', 1, labels);
  }

  /** Emit a `mastra_feedback_total` counter for a feedback event. */
  processFeedbackEvent(event: FeedbackEvent): void {
    const labels: Record<string, string> = {
      feedback_type: event.feedback.feedbackType,
      source: event.feedback.source,
    };
    if (event.feedback.metadata?.entityType) {
      labels.entity_type = String(event.feedback.metadata.entityType);
    }
    if (event.feedback.experimentId) {
      labels.experiment = event.feedback.experimentId;
    }
    this.emit('mastra_feedback_total', 'counter', 1, labels);
  }

  /** Emit a started counter (e.g. `mastra_agent_runs_started`) for the span type. */
  private onSpanStarted(span: AnyExportedSpan): void {
    const labels = this.extractLabels(span);
    const metricName = this.getStartedMetricName(span);
    if (metricName) {
      this.emit(metricName, 'counter', 1, labels);
    }
  }

  /** Emit ended counter, duration histogram, and token counters (for model spans). */
  private onSpanEnded(span: AnyExportedSpan): void {
    const labels = this.extractLabels(span);

    // Ended counter
    const endedMetricName = this.getEndedMetricName(span);
    if (endedMetricName) {
      const endedLabels = { ...labels };
      if (span.errorInfo) {
        endedLabels.status = 'error';
      } else {
        endedLabels.status = 'ok';
      }
      this.emit(endedMetricName, 'counter', 1, endedLabels);
    }

    // Duration histogram
    const durationMetricName = this.getDurationMetricName(span);
    if (durationMetricName && span.startTime && span.endTime) {
      const durationMs = Math.max(0, span.endTime.getTime() - span.startTime.getTime());
      const durationLabels = { ...labels };
      if (span.errorInfo) {
        durationLabels.status = 'error';
      } else {
        durationLabels.status = 'ok';
      }
      this.emit(durationMetricName, 'histogram', durationMs, durationLabels);
    }

    // Token metrics for model generation spans
    if (span.type === SpanType.MODEL_GENERATION) {
      this.extractTokenMetrics(span, labels);
    }
  }

  /** Build base metric labels from a span's entity and model attributes. */
  private extractLabels(span: AnyExportedSpan): Record<string, string> {
    const labels: Record<string, string> = {};

    // Use generic entity_type / entity_name for all span types
    if (span.entityType) labels.entity_type = span.entityType;
    if (span.entityName) labels.entity_name = span.entityName;

    // Model-specific labels (only on MODEL_GENERATION spans)
    if (span.type === SpanType.MODEL_GENERATION) {
      const attrs = span.attributes as Record<string, unknown> | undefined;
      if (attrs?.model) labels.model = String(attrs.model);
      if (attrs?.provider) labels.provider = String(attrs.provider);
    }

    return labels;
  }

  /** Emit token usage counters from a MODEL_GENERATION span's `usage` attributes. Negative and non-finite values are skipped. */
  private extractTokenMetrics(span: AnyExportedSpan, labels: Record<string, string>): void {
    const attrs = span.attributes as Record<string, unknown> | undefined;
    const usage = attrs?.usage as Record<string, unknown> | undefined;
    if (!usage) return;

    const inputTokens = Number(usage.inputTokens);
    if (Number.isFinite(inputTokens) && inputTokens >= 0) {
      this.emit('mastra_model_input_tokens', 'counter', inputTokens, labels);
    }
    const outputTokens = Number(usage.outputTokens);
    if (Number.isFinite(outputTokens) && outputTokens >= 0) {
      this.emit('mastra_model_output_tokens', 'counter', outputTokens, labels);
    }

    const inputDetails = usage.inputDetails as Record<string, unknown> | undefined;
    const cacheRead = Number(inputDetails?.cacheRead);
    if (Number.isFinite(cacheRead) && cacheRead >= 0) {
      this.emit('mastra_model_cache_read_tokens', 'counter', cacheRead, labels);
    }
    const cacheWrite = Number(inputDetails?.cacheWrite);
    if (Number.isFinite(cacheWrite) && cacheWrite >= 0) {
      this.emit('mastra_model_cache_write_tokens', 'counter', cacheWrite, labels);
    }
  }

  /** Map a span type to its `*_started` counter metric name, or `null` for unsupported types. */
  private getStartedMetricName(span: AnyExportedSpan): string | null {
    switch (span.type) {
      case SpanType.AGENT_RUN:
        return 'mastra_agent_runs_started';
      case SpanType.TOOL_CALL:
        return 'mastra_tool_calls_started';
      case SpanType.WORKFLOW_RUN:
        return 'mastra_workflow_runs_started';
      case SpanType.MODEL_GENERATION:
        return 'mastra_model_requests_started';
      default:
        return null;
    }
  }

  /** Map a span type to its `*_ended` counter metric name, or `null` for unsupported types. */
  private getEndedMetricName(span: AnyExportedSpan): string | null {
    switch (span.type) {
      case SpanType.AGENT_RUN:
        return 'mastra_agent_runs_ended';
      case SpanType.TOOL_CALL:
        return 'mastra_tool_calls_ended';
      case SpanType.WORKFLOW_RUN:
        return 'mastra_workflow_runs_ended';
      case SpanType.MODEL_GENERATION:
        return 'mastra_model_requests_ended';
      default:
        return null;
    }
  }

  /** Map a span type to its `*_duration_ms` histogram metric name, or `null` for unsupported types. */
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

  /** Build an ExportedMetric, apply cardinality filtering, and emit it through the bus. */
  private emit(name: string, metricType: MetricType, value: number, labels: Record<string, string>): void {
    const filteredLabels = this.cardinalityFilter ? this.cardinalityFilter.filterLabels(labels) : labels;
    const exportedMetric: ExportedMetric = {
      timestamp: new Date(),
      name,
      metricType,
      value,
      labels: filteredLabels,
    };

    const event: MetricEvent = { type: 'metric', metric: exportedMetric };
    this.observabilityBus.emit(event);
  }
}
