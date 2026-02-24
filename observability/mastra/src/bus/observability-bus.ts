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
  LogEvent,
  MetricEvent,
  ScoreEvent,
  FeedbackEvent,
  ObservabilityEvent,
} from '@mastra/core/observability';
import { TracingEventType } from '@mastra/core/observability';

import { AutoExtractedMetrics } from '../metrics/auto-extract';
import { BaseObservabilityEventBus } from './base';
import type { BaseObservabilityEventBusOptions } from './base';

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

  constructor(options?: BaseObservabilityEventBusOptions) {
    super(options);
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
   * Override emit to route events to exporter handlers immediately,
   * then pass to the base class for buffered subscriber delivery.
   */
  emit(event: ObservabilityEvent): void {
    // Route to appropriate handler on each registered exporter
    for (const exporter of this.exporters) {
      this.routeToHandler(exporter, event);
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

    // Also buffer for subscriber-based batch processing
    super.emit(event);
  }

  /**
   * Route a single event to the appropriate handler on an exporter.
   * If the exporter does not implement the handler, the event is silently skipped.
   */
  private routeToHandler(exporter: ObservabilityExporter, event: ObservabilityEvent): void {
    try {
      switch (event.type) {
        // TracingEvent uses TracingEventType enum (snake_case values)
        case TracingEventType.SPAN_STARTED:
        case TracingEventType.SPAN_UPDATED:
        case TracingEventType.SPAN_ENDED: {
          // Prefer onTracingEvent if available, fall back to exportTracingEvent.
          // This ensures exporters that only implement the required exportTracingEvent
          // (without the optional onTracingEvent handler) still receive tracing events.
          const handler = exporter.onTracingEvent
            ? exporter.onTracingEvent.bind(exporter)
            : exporter.exportTracingEvent.bind(exporter);
          const result = handler(event as TracingEvent);
          // Handle async handlers - catch errors without blocking
          if (result && typeof (result as Promise<void>).catch === 'function') {
            (result as Promise<void>).catch(err => {
              console.error(`[ObservabilityBus] Tracing handler error [exporter=${exporter.name}]:`, err);
            });
          }
          break;
        }

        case 'log':
          if (exporter.onLogEvent) {
            const result = exporter.onLogEvent(event as LogEvent);
            if (result && typeof (result as Promise<void>).catch === 'function') {
              (result as Promise<void>).catch(err => {
                console.error(`[ObservabilityBus] Log handler error [exporter=${exporter.name}]:`, err);
              });
            }
          }
          break;

        case 'metric':
          if (exporter.onMetricEvent) {
            const result = exporter.onMetricEvent(event as MetricEvent);
            if (result && typeof (result as Promise<void>).catch === 'function') {
              (result as Promise<void>).catch(err => {
                console.error(`[ObservabilityBus] Metric handler error [exporter=${exporter.name}]:`, err);
              });
            }
          }
          break;

        case 'score':
          if (exporter.onScoreEvent) {
            const result = exporter.onScoreEvent(event as ScoreEvent);
            if (result && typeof (result as Promise<void>).catch === 'function') {
              (result as Promise<void>).catch(err => {
                console.error(`[ObservabilityBus] Score handler error [exporter=${exporter.name}]:`, err);
              });
            }
          }
          break;

        case 'feedback':
          if (exporter.onFeedbackEvent) {
            const result = exporter.onFeedbackEvent(event as FeedbackEvent);
            if (result && typeof (result as Promise<void>).catch === 'function') {
              (result as Promise<void>).catch(err => {
                console.error(`[ObservabilityBus] Feedback handler error [exporter=${exporter.name}]:`, err);
              });
            }
          }
          break;
      }
    } catch (err) {
      console.error(`[ObservabilityBus] Sync handler error [exporter=${exporter.name}]:`, err);
    }
  }
}
