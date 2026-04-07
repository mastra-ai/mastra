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

import type { ObservabilityExporter, ObservabilityBridge, ObservabilityEvent } from '@mastra/core/observability';

import { deepClean } from '../spans/serialization';
import { BaseObservabilityEventBus } from './base';
import { routeToHandler } from './route-event';

/**
 * Apply deepClean() to free-form payload fields on non-tracing observability
 * events. Tracing events are already deep-cleaned at span construction time
 * (see spans/base.ts and spans/default.ts), so they pass through unchanged.
 *
 * This guarantees every signal leaving the bus has been sanitized for
 * circular references, oversized strings, functions, and other non-
 * serializable values before being handed to exporters/bridges.
 */
function cleanEvent(event: ObservabilityEvent): ObservabilityEvent {
  switch (event.type) {
    case 'log': {
      const log = event.log;
      return {
        type: 'log',
        log: {
          ...log,
          data: log.data ? deepClean(log.data) : log.data,
          metadata: log.metadata ? deepClean(log.metadata) : log.metadata,
        },
      };
    }
    case 'metric': {
      const metric = event.metric;
      const costContext = metric.costContext;
      return {
        type: 'metric',
        metric: {
          ...metric,
          metadata: metric.metadata ? deepClean(metric.metadata) : metric.metadata,
          costContext:
            costContext && costContext.costMetadata
              ? { ...costContext, costMetadata: deepClean(costContext.costMetadata) }
              : costContext,
        },
      };
    }
    case 'score': {
      const score = event.score;
      return {
        type: 'score',
        score: {
          ...score,
          metadata: score.metadata ? deepClean(score.metadata) : score.metadata,
        },
      };
    }
    case 'feedback': {
      const feedback = event.feedback;
      return {
        type: 'feedback',
        feedback: {
          ...feedback,
          metadata: feedback.metadata ? deepClean(feedback.metadata) : feedback.metadata,
        },
      };
    }
    default:
      // Tracing events are already cleaned at span construction.
      return event;
  }
}

/** Max flush drain iterations before bailing — prevents infinite loops when handlers re-emit. */
const MAX_FLUSH_ITERATIONS = 3;

/**
 * Unified event bus for all observability signals (tracing, logs, metrics, scores, feedback).
 * Routes events to registered exporters and an optional bridge.
 */
export class ObservabilityBus extends BaseObservabilityEventBus<ObservabilityEvent> {
  private exporters: ObservabilityExporter[] = [];
  private bridge?: ObservabilityBridge;

  /** In-flight handler promises from routeToHandler. Self-cleaning via .finally(). */
  private pendingHandlers: Set<Promise<void>> = new Set();

  constructor() {
    super({ name: 'ObservabilityBus' });
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
   * Emit an event: route to exporter/bridge handlers, then forward to base
   * class for subscriber delivery.
   *
   * emit() is synchronous — async handler promises are tracked internally
   * and can be drained via flush().
   */
  emit(event: ObservabilityEvent): void {
    // Sanitize free-form payload fields on non-tracing signals before
    // fanning out. Tracing events are already deep-cleaned at span
    // construction, so cleanEvent() returns them unchanged.
    const cleaned = cleanEvent(event);

    // Route to appropriate handler on each registered exporter
    for (const exporter of this.exporters) {
      this.trackPromise(routeToHandler(exporter, cleaned, this.logger));
    }

    // Route to bridge (same routing logic as exporters)
    if (this.bridge) {
      this.trackPromise(routeToHandler(this.bridge, cleaned, this.logger));
    }

    // Deliver to subscribers (base class tracks its own pending promises)
    super.emit(cleaned);
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
