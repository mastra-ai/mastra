/**
 * ObservabilityBus - Unified event bus for all observability signals.
 *
 * Routes events to registered exporters and an optional bridge based on event
 * type. Each handler declares which signals it supports by implementing the
 * corresponding method (onTracingEvent, onLogEvent, onMetricEvent,
 * onScoreEvent, onFeedbackEvent).
 *
 * Handler presence = signal support. If a handler does not implement a method,
 * events of that type are silently skipped for that handler.
 */

import type {
  ObservabilityExporter,
  ObservabilityBridge,
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
  private bridge?: ObservabilityBridge;
  private autoExtractor?: AutoExtractedMetrics;

  /** In-flight handler promises from routeToHandler. Self-cleaning via .finally(). */
  private pendingHandlers: Set<Promise<void>> = new Set();

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
   * Register a bridge to receive all routed events alongside exporters.
   * Only one bridge can be registered at a time.
   */
  registerBridge(bridge: ObservabilityBridge): void {
    this.bridge = bridge;
  }

  /**
   * Unregister the bridge. Returns true if a bridge was registered and removed.
   */
  unregisterBridge(): boolean {
    if (this.bridge) {
      this.bridge = undefined;
      return true;
    }
    return false;
  }

  /**
   * Get the registered bridge, if any.
   */
  getBridge(): ObservabilityBridge | undefined {
    return this.bridge;
  }

  /**
   * Emit an event: route to exporter/bridge handlers, run auto-extraction,
   * then forward to base class for subscriber delivery.
   *
   * emit() is synchronous — async handler promises are tracked internally
   * and can be drained via flush().
   */
  emit(event: ObservabilityEvent): void {
    // Route to appropriate handler on each registered exporter
    for (const exporter of this.exporters) {
      this.trackPromise(routeToHandler(exporter, event, this.logger));
    }

    // Route to bridge (same routing logic as exporters)
    if (this.bridge) {
      this.trackPromise(routeToHandler(this.bridge, event, this.logger));
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

    // Deliver to subscribers (base class tracks its own pending promises)
    super.emit(event);
  }

  /**
   * Track an async handler promise so flush() can await it.
   * No-ops for sync (void) results.
   */
  private trackPromise(result: void | Promise<void>): void {
    if (result && typeof (result as Promise<void>).then === 'function') {
      const promise = result as Promise<void>;
      this.pendingHandlers.add(promise);
      void promise.finally(() => this.pendingHandlers.delete(promise));
    }
  }

  /**
   * Await all in-flight handler delivery promises (exporters + bridge),
   * then flush base class subscriber promises.
   *
   * After flush() resolves, all event data has been delivered to handler
   * methods. Callers should then call exporter.flush() / bridge.flush()
   * to drain SDK-internal buffers.
   */
  async flush(): Promise<void> {
    if (this.pendingHandlers.size > 0) {
      await Promise.allSettled([...this.pendingHandlers]);
    }
    await super.flush();
  }

  async shutdown(): Promise<void> {
    await this.flush();
    await super.shutdown();
  }
}
