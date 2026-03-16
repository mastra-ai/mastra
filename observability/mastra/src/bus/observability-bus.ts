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
  ObservabilityEvent,
  ExportedMetric,
  MetricEvent,
} from '@mastra/core/observability';
import { TracingEventType } from '@mastra/core/observability';

import { AutoExtractedMetrics } from '../metrics/auto-extract';
import { CardinalityFilter } from '../metrics/cardinality';
import { BaseObservabilityEventBus } from './base';
import { routeToHandler } from './route-event';

/** Max flush drain iterations before bailing — prevents infinite loops when handlers re-emit. */
const MAX_FLUSH_ITERATIONS = 3;

/** Type guard that narrows an ObservabilityEvent to a TracingEvent. */
function isTracingEvent(event: ObservabilityEvent): event is TracingEvent {
  return (
    event.type === TracingEventType.SPAN_STARTED ||
    event.type === TracingEventType.SPAN_UPDATED ||
    event.type === TracingEventType.SPAN_ENDED
  );
}

/** Configuration for the ObservabilityBus. */
export interface ObservabilityBusConfig {
  /** Cardinality filter applied to all metric labels. When omitted, a default filter is used. */
  cardinalityFilter?: CardinalityFilter;
  /** Whether to auto-extract metrics from tracing spans (duration, token usage). Defaults to true. */
  autoExtractMetrics?: boolean;
}

/**
 * Unified event bus for all observability signals (tracing, logs, metrics, scores, feedback).
 * Routes events to registered exporters and an optional bridge, with support for
 * auto-extracted metrics from tracing spans.
 */
export class ObservabilityBus extends BaseObservabilityEventBus<ObservabilityEvent> {
  private exporters: ObservabilityExporter[] = [];
  private bridge?: ObservabilityBridge;
  private autoExtractor?: AutoExtractedMetrics;
  private cardinalityFilter: CardinalityFilter;

  /** In-flight handler promises from routeToHandler. Self-cleaning via .finally(). */
  private pendingHandlers: Set<Promise<void>> = new Set();

  constructor(config?: ObservabilityBusConfig) {
    super({ name: 'ObservabilityBus' });
    this.cardinalityFilter = config?.cardinalityFilter ?? new CardinalityFilter();
    if (config?.autoExtractMetrics !== false) {
      this.autoExtractor = new AutoExtractedMetrics(this);
    }
  }

  /**
   * Emit a metric event with validation and cardinality filtering.
   * Non-finite or negative values are silently dropped.
   * This is the single entry point for all metric emission (auto-extracted and user-defined).
   */
  emitMetric(name: string, value: number, labels: Record<string, string>): void {
    if (!Number.isFinite(value) || value < 0) return;

    const filteredLabels = this.cardinalityFilter.filterLabels(labels);
    const exportedMetric: ExportedMetric = {
      timestamp: new Date(),
      name,
      value,
      labels: filteredLabels,
    };

    const event: MetricEvent = { type: 'metric', metric: exportedMetric };
    this.emit(event);
  }

  /**
   * Register an exporter to receive routed events.
   * Duplicate registrations (same instance) are silently ignored.
   *
   * @param exporter - The exporter to register.
   */
  registerExporter(exporter: ObservabilityExporter): void {
    if (this.exporters.includes(exporter)) {
      return;
    }
    this.exporters.push(exporter);
  }

  /**
   * Unregister an exporter.
   *
   * @param exporter - The exporter instance to remove.
   * @returns `true` if the exporter was found and removed, `false` otherwise.
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
   * Only one bridge can be registered at a time; replacing an existing bridge
   * logs a warning.
   *
   * @param bridge - The bridge to register.
   */
  registerBridge(bridge: ObservabilityBridge): void {
    if (this.bridge) {
      this.logger.warn(`[ObservabilityBus] Replacing existing bridge with new bridge`);
    }
    this.bridge = bridge;
  }

  /**
   * Unregister the bridge.
   *
   * @returns `true` if a bridge was registered and removed, `false` otherwise.
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

    // Auto-extract metrics from tracing events (duration, token usage).
    // Wrapped in try-catch so a failing extractor never prevents subscriber delivery.
    if (this.autoExtractor && isTracingEvent(event)) {
      try {
        this.autoExtractor.processTracingEvent(event);
      } catch (err) {
        this.logger.error('[ObservabilityBus] Auto-extraction error:', err);
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
   * Two-phase flush to ensure all observability data is fully exported.
   *
   * **Phase 1 — Delivery:** Await all in-flight handler promises (exporters,
   * bridge, and base-class subscribers). After this resolves, all event data
   * has been delivered to handler methods.
   *
   * **Phase 2 — Buffer drain:** Call flush() on each exporter and bridge to
   * drain their SDK-internal buffers (e.g., OTEL BatchSpanProcessor, Langfuse
   * client queue). Phases are sequential — Phase 2 must not start until
   * Phase 1 completes, otherwise exporters would flush empty buffers.
   */
  async flush(): Promise<void> {
    // Phase 1: Await in-flight handler delivery promises, draining until empty.
    let iterations = 0;
    while (this.pendingHandlers.size > 0) {
      await Promise.allSettled([...this.pendingHandlers]);
      iterations++;
      if (iterations >= MAX_FLUSH_ITERATIONS) {
        this.logger.error(
          `[ObservabilityBus] flush() exceeded ${MAX_FLUSH_ITERATIONS} drain iterations — ` +
            `${this.pendingHandlers.size} promises still pending. Handlers may be re-emitting during flush.`,
        );
        // Final settlement pass: ensure every remaining promise has settled
        // before moving to Phase 2, even if new promises keep appearing.
        if (this.pendingHandlers.size > 0) {
          await Promise.allSettled([...this.pendingHandlers]);
        }
        break;
      }
    }
    await super.flush();

    // Phase 2: Drain exporter and bridge SDK-internal buffers.
    const bufferFlushPromises: Promise<void>[] = this.exporters.map(e => e.flush());
    if (this.bridge) {
      bufferFlushPromises.push(this.bridge.flush());
    }
    if (bufferFlushPromises.length > 0) {
      await Promise.allSettled(bufferFlushPromises);
    }
  }

  /** Flush all pending events and exporter buffers, then clear subscribers. */
  async shutdown(): Promise<void> {
    await this.flush();
    await super.shutdown();
  }
}
