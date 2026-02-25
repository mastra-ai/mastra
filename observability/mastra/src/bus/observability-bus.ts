/**
 * ObservabilityBus - Unified event bus for all observability signals.
 *
 * Routes events to registered exporters based on event type. Each exporter
 * declares which signals it supports by implementing the corresponding handler
 * method (onTracingEvent, onLogEvent, onMetricEvent, onScoreEvent, onFeedbackEvent).
 *
 * Handler presence = signal support. If an exporter does not implement a handler,
 * events of that type are silently skipped for that exporter.
 */

import type {
  ObservabilityExporter,
  TracingEvent,
  ScoreEvent,
  FeedbackEvent,
  ObservabilityEvent,
} from '@mastra/core/observability';
import { TracingEventType } from '@mastra/core/observability';

import { AutoExtractedMetrics } from '../metrics/auto-extract';
import { BaseObservabilityEventBus } from './base';
import { routeToHandler } from './route-event';

function isTracingEvent(event: ObservabilityEvent): event is TracingEvent {
  return (
    event.type === TracingEventType.SPAN_STARTED ||
    event.type === TracingEventType.SPAN_UPDATED ||
    event.type === TracingEventType.SPAN_ENDED
  );
}

export class ObservabilityBus extends BaseObservabilityEventBus<ObservabilityEvent> {
  private exporters: ObservabilityExporter[] = [];
  private autoExtractor?: AutoExtractedMetrics;

  constructor() {
    super({ name: 'ObservabilityBus' });
  }

  /**
   * Enable auto-extraction of metrics from tracing, score, and feedback events.
   * When enabled, span lifecycle events automatically generate counter/histogram
   * metrics (e.g., mastra_agent_runs_started, mastra_model_duration_ms).
   */
  enableAutoExtractedMetrics(): void {
    this.autoExtractor = new AutoExtractedMetrics(this);
  }

  /**
   * Register an exporter to receive routed events.
   * The bus will call the appropriate handler on each exporter
   * based on the event type.
   */
  registerExporter(exporter: ObservabilityExporter): void {
    this.exporters.push(exporter);
  }

  /**
   * Unregister an exporter. Returns true if the exporter was found and removed.
   */
  unregisterExporter(exporter: ObservabilityExporter): boolean {
    const index = this.exporters.indexOf(exporter);
    if (index !== -1) {
      this.exporters.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get registered exporters (read-only snapshot).
   */
  getExporters(): readonly ObservabilityExporter[] {
    return [...this.exporters];
  }

  /**
   * Emit an event: route to exporter handlers, run auto-extraction,
   * then forward to base class for subscriber delivery.
   */
  emit(event: ObservabilityEvent): void {
    // Route to appropriate handler on each registered exporter
    for (const exporter of this.exporters) {
      routeToHandler(exporter, event, this.logger);
    }

    // Auto-extract metrics from tracing, score, and feedback events
    if (this.autoExtractor) {
      if (isTracingEvent(event)) {
        this.autoExtractor.processTracingEvent(event);
      } else if (event.type === 'score') {
        this.autoExtractor.processScoreEvent(event as ScoreEvent);
      } else if (event.type === 'feedback') {
        this.autoExtractor.processFeedbackEvent(event as FeedbackEvent);
      }
    }

    // Deliver to subscribers
    super.emit(event);
  }
}
