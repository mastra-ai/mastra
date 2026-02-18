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

export class AutoExtractedMetrics {
  constructor(private observabilityBus: ObservabilityBus) {}

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

  private onSpanStarted(span: AnyExportedSpan): void {
    const labels = this.extractLabels(span);
    const metricName = this.getStartedMetricName(span);
    if (metricName) {
      this.emit(metricName, 'counter', 1, labels);
    }
  }

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
      const durationMs = span.endTime.getTime() - span.startTime.getTime();
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

  private extractLabels(span: AnyExportedSpan): Record<string, string> {
    const labels: Record<string, string> = {};

    switch (span.type) {
      case SpanType.AGENT_RUN:
        labels.agent = span.entityName ?? 'unknown';
        break;
      case SpanType.TOOL_CALL:
        labels.tool = span.entityName ?? 'unknown';
        break;
      case SpanType.WORKFLOW_RUN:
        labels.workflow = span.entityName ?? 'unknown';
        break;
      case SpanType.MODEL_GENERATION: {
        const attrs = span.attributes as Record<string, unknown> | undefined;
        if (attrs?.model) labels.model = String(attrs.model);
        if (attrs?.provider) labels.provider = String(attrs.provider);
        // Include agent name if available from parent context
        if (span.entityName) labels.agent = span.entityName;
        break;
      }
    }
    return labels;
  }

  private extractTokenMetrics(span: AnyExportedSpan, labels: Record<string, string>): void {
    const attrs = span.attributes as Record<string, unknown> | undefined;
    const usage = attrs?.usage as Record<string, unknown> | undefined;
    if (!usage) return;

    if (usage.inputTokens !== undefined) {
      this.emit('mastra_model_input_tokens', 'counter', Number(usage.inputTokens), labels);
    }
    if (usage.outputTokens !== undefined) {
      this.emit('mastra_model_output_tokens', 'counter', Number(usage.outputTokens), labels);
    }

    const inputDetails = usage.inputDetails as Record<string, unknown> | undefined;
    if (inputDetails?.cacheRead !== undefined) {
      this.emit('mastra_model_cache_read_tokens', 'counter', Number(inputDetails.cacheRead), labels);
    }
    if (inputDetails?.cacheWrite !== undefined) {
      this.emit('mastra_model_cache_write_tokens', 'counter', Number(inputDetails.cacheWrite), labels);
    }
  }

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

  private emit(name: string, metricType: MetricType, value: number, labels: Record<string, string>): void {
    const exportedMetric: ExportedMetric = {
      timestamp: new Date(),
      name,
      metricType,
      value,
      labels,
    };

    const event: MetricEvent = { type: 'metric', metric: exportedMetric };
    this.observabilityBus.emit(event);
  }
}
