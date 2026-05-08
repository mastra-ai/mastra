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
  ObservabilityEvent,
  ObservabilityDropEvent,
  SerializationOptions,
} from '@mastra/core/observability';

import type { DeepCleanOptions } from '../spans/serialization';
import { deepClean, mergeSerializationOptions } from '../spans/serialization';
import { BaseObservabilityEventBus } from './base';
import { routeDropToHandler, routeToHandler } from './route-event';

/**
 * Apply deepClean() to non-tracing observability events. Tracing events are
 * already deep-cleaned at span construction time (see spans/base.ts and
 * spans/default.ts), so they pass through unchanged.
 *
 * For log/metric/score/feedback we clean the entire exported payload object
 * (not just the freeform sub-fields) so every user-supplied field — top-level
 * strings like `message`/`reason`/`comment`, arrays like `tags`, nested
 * `metadata`/`data`/`costMetadata`, and any future fields — is bounded,
 * stripped of circular refs/functions/symbols, and safe for JSON.stringify
 * before exporters or bridges see it.
 *
 * Identity scalars (timestamps, numeric score/value, IDs) are passed through
 * by deepClean unchanged, so the cleaned object is structurally identical to
 * the input for well-formed events.
 */
function cleanEvent(event: ObservabilityEvent, options: DeepCleanOptions): ObservabilityEvent {
  switch (event.type) {
    case 'log':
      return { type: 'log', log: deepClean(event.log, options) };
    case 'metric':
      return { type: 'metric', metric: deepClean(event.metric, options) };
    case 'score':
      return { type: 'score', score: deepClean(event.score, options) };
    case 'feedback':
      return { type: 'feedback', feedback: deepClean(event.feedback, options) };
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

  private handlerBufferFlushDepth = 0;
  private dropEventsEmittedDuringHandlerFlush = 0;

  /** Resolved deepClean options applied to non-tracing events before fan-out. */
  private deepCleanOptions: DeepCleanOptions;

  constructor(opts?: { serializationOptions?: SerializationOptions }) {
    super({ name: 'ObservabilityBus' });
    this.deepCleanOptions = mergeSerializationOptions(opts?.serializationOptions);
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
    const cleaned = cleanEvent(event, this.deepCleanOptions);

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
   * Emit exporter pipeline drop events to exporters and the bridge.
   *
   * Drop events describe exporter health, not user observability data, so they
   * are intentionally not delivered to generic event-bus subscribers.
   */
  emitDropEvent(event: ObservabilityDropEvent): void {
    if (this.handlerBufferFlushDepth > 0) {
      this.dropEventsEmittedDuringHandlerFlush++;
    }

    for (const exporter of this.exporters) {
      this.trackPromise(routeDropToHandler(exporter, event, this.logger));
    }

    if (this.bridge) {
      this.trackPromise(routeDropToHandler(this.bridge, event, this.logger));
    }
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

  /** Await in-flight routed handler promises, draining until empty. */
  private async drainPendingHandlers(): Promise<void> {
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
        // before moving on, even if new promises keep appearing.
        if (this.pendingHandlers.size > 0) {
          await Promise.allSettled([...this.pendingHandlers]);
        }
        break;
      }
    }
  }

  /** Drain exporter and bridge SDK-internal buffers. */
  private async flushHandlerBuffers(): Promise<boolean> {
    const initialDropCount = this.dropEventsEmittedDuringHandlerFlush;
    this.handlerBufferFlushDepth++;
    try {
      const bufferFlushPromises: Promise<void>[] = this.exporters.map(e => e.flush());
      if (this.bridge) {
        bufferFlushPromises.push(this.bridge.flush());
      }
      if (bufferFlushPromises.length > 0) {
        await Promise.allSettled(bufferFlushPromises);
      }
      return this.dropEventsEmittedDuringHandlerFlush > initialDropCount;
    } finally {
      this.handlerBufferFlushDepth--;
    }
  }

  /**
   * Multi-phase flush to ensure all observability data is fully exported.
   *
   * **Phase 1 — Delivery:** Await all in-flight handler promises (exporters,
   * bridge, and base-class subscribers). After this resolves, all event data
   * has been delivered to handler methods.
   *
   * **Phase 2 — Buffer drain:** Call flush() on each exporter and bridge to
   * drain their SDK-internal buffers (e.g., OTEL BatchSpanProcessor, Langfuse
   * client queue). Phases are sequential — buffer drains must not start until
   * delivery completes, otherwise exporters would flush empty buffers.
   *
   * Exporter flushes can emit drop events. When that happens, flush loops
   * through delivery and buffer drain again so alerting integrations that buffer
   * drop notifications are drained before returning.
   */
  async flush(): Promise<void> {
    // Phase 1: Await in-flight handler delivery promises, draining until empty.
    await this.drainPendingHandlers();
    await super.flush();

    for (let iterations = 0; iterations < MAX_FLUSH_ITERATIONS; iterations++) {
      const emittedDropEvents = await this.flushHandlerBuffers();
      if (!emittedDropEvents && this.pendingHandlers.size === 0) {
        return;
      }

      await this.drainPendingHandlers();
      await super.flush();
    }

    this.logger.error(
      `[ObservabilityBus] flush() exceeded ${MAX_FLUSH_ITERATIONS} buffer drain iterations. ` +
        `Handlers may be emitting drop events during every flush.`,
    );
  }

  /** Flush all pending events and exporter buffers, then clear subscribers. */
  async shutdown(): Promise<void> {
    await this.flush();
    await super.shutdown();
  }
}
