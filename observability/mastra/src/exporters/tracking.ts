/**
 * Tracking Exporter Base Class
 *
 * Provides common trace and span tracking functionality for exporters that
 * need to maintain state for each trace (e.g., vendor SDK objects, span hierarchies).
 *
 * Features:
 * - Map-based trace tracking with automatic cleanup
 * - Reference counting for active spans
 * - Automatic trace cleanup when all spans end
 * - Common logging patterns for missing trace/span data
 *
 * Subclasses must implement:
 * - `createTraceData()` - Create vendor-specific trace data structure
 * - `handleSpanStarted()` - Handle span start events
 * - `handleSpanUpdated()` - Handle span update events
 * - `handleSpanEnded()` - Handle span end events
 * - `handleEventSpan()` - Handle event-type spans
 * - `cleanupTraceData()` - Cleanup vendor resources when trace is removed
 */

import type { TracingEvent, AnyExportedSpan } from '@mastra/core/observability';
import type { BaseExporterConfig } from './base';
import { BaseExporter } from './base';

/**
 * Base interface for trace data that all implementations must include.
 * Subclasses extend this with vendor-specific fields.
 */
export interface BaseTraceData {
  /** Set of span IDs that have started but not yet ended */
  activeSpanIds: Set<string>;
}

export interface TrackingExporterConfig extends BaseExporterConfig {
  // Subclasses can extend this with vendor-specific config
}

/**
 * Context passed to span handlers for logging and debugging.
 */
export interface SpanContext {
  span: AnyExportedSpan;
  method: string;
}

/**
 * Abstract base class for exporters that track trace/span state.
 *
 * @typeParam TTraceData - The type of data stored per trace (must extend BaseTraceData)
 * @typeParam TConfig - Configuration type (must extend TrackingExporterConfig)
 */
export abstract class TrackingExporter<
  TTraceData extends BaseTraceData,
  TConfig extends TrackingExporterConfig = TrackingExporterConfig,
> extends BaseExporter {
  /**
   * Map of traceId to trace-specific data.
   * Contains vendor SDK objects, span maps, and active span tracking.
   */
  protected traceMap = new Map<string, TTraceData>();

  /**
   * Subclass configuration (typed for subclass-specific options)
   */
  protected readonly exporterConfig: TConfig;

  constructor(config: TConfig) {
    super(config);
    this.exporterConfig = config;
  }

  /**
   * Create the initial trace data structure for a new trace.
   * Called when the first root span of a trace is encountered.
   *
   * @param span - The root span that initiated the trace
   * @returns The initial trace data structure
   */
  protected abstract createTraceData(span: AnyExportedSpan): TTraceData | Promise<TTraceData>;

  /**
   * Handle a span_started event.
   *
   * @param span - The span that started
   * @param traceData - The trace data for this span's trace
   */
  protected abstract handleSpanStarted(span: AnyExportedSpan, traceData: TTraceData): void | Promise<void>;

  /**
   * Handle a span_updated event.
   *
   * @param span - The span that was updated
   * @param traceData - The trace data for this span's trace
   */
  protected abstract handleSpanUpdated(span: AnyExportedSpan, traceData: TTraceData): void | Promise<void>;

  /**
   * Handle a span_ended event.
   *
   * @param span - The span that ended
   * @param traceData - The trace data for this span's trace
   */
  protected abstract handleSpanEnded(span: AnyExportedSpan, traceData: TTraceData): void | Promise<void>;

  /**
   * Handle an event-type span (isEvent = true).
   * Event spans typically only emit a single event and have zero duration.
   *
   * @param span - The event span
   * @param traceData - The trace data for this span's trace
   */
  protected abstract handleEventSpan(span: AnyExportedSpan, traceData: TTraceData): void | Promise<void>;

  /**
   * Cleanup vendor-specific resources when a trace is removed.
   * Called before the trace is deleted from the map.
   *
   * @param traceData - The trace data being cleaned up
   * @param traceId - The ID of the trace being cleaned up
   */
  protected abstract cleanupTraceData(traceData: TTraceData, traceId: string): void | Promise<void>;

  /**
   * Initialize trace data for a root span.
   * Creates the trace entry if it doesn't exist.
   *
   * @param span - The root span
   * @returns The trace data (existing or newly created)
   */
  protected async initTrace(span: AnyExportedSpan): Promise<TTraceData> {
    // Check if trace already exists - reuse it
    const existing = this.traceMap.get(span.traceId);
    if (existing) {
      this.logger.debug(`${this.name}: Reusing existing trace from local map`, {
        traceId: span.traceId,
        spanId: span.id,
        spanName: span.name,
      });
      return existing;
    }

    // Create new trace data
    const traceData = await this.createTraceData(span);
    this.traceMap.set(span.traceId, traceData);

    this.logger.debug(`${this.name}: Created new trace`, {
      traceId: span.traceId,
      spanId: span.id,
      spanName: span.name,
    });

    return traceData;
  }

  /**
   * Get trace data for a span, logging a warning if not found.
   *
   * @param context - The span context for logging
   * @returns The trace data, or undefined if not found
   */
  protected getTraceData(context: SpanContext): TTraceData | undefined {
    const { span, method } = context;

    const traceData = this.traceMap.get(span.traceId);
    if (traceData) {
      return traceData;
    }

    this.logger.warn(`${this.name}: No trace data found for span`, {
      traceId: span.traceId,
      spanId: span.id,
      spanName: span.name,
      spanType: span.type,
      isRootSpan: span.isRootSpan,
      parentSpanId: span.parentSpanId,
      method,
    });

    return undefined;
  }

  /**
   * Mark a span as active (started but not ended).
   * Used for reference counting to know when to clean up traces.
   *
   * @param traceData - The trace data
   * @param spanId - The span ID to mark as active
   */
  protected markSpanActive(traceData: TTraceData, spanId: string): void {
    traceData.activeSpanIds.add(spanId);
  }

  /**
   * Mark a span as ended and potentially clean up the trace.
   * If no more active spans remain, the trace is cleaned up.
   *
   * @param traceId - The trace ID
   * @param traceData - The trace data
   * @param spanId - The span ID that ended
   * @returns true if the trace was cleaned up, false otherwise
   */
  protected async markSpanEnded(traceId: string, traceData: TTraceData, spanId: string): Promise<boolean> {
    traceData.activeSpanIds.delete(spanId);

    // Clean up trace if no more active spans
    if (traceData.activeSpanIds.size === 0) {
      await this.removeTrace(traceId, traceData);
      return true;
    }

    return false;
  }

  /**
   * Remove a trace from the map and clean up resources.
   *
   * @param traceId - The trace ID to remove
   * @param traceData - The trace data (optional, will be looked up if not provided)
   */
  protected async removeTrace(traceId: string, traceData?: TTraceData): Promise<void> {
    const data = traceData ?? this.traceMap.get(traceId);
    if (data) {
      await this.cleanupTraceData(data, traceId);
    }
    this.traceMap.delete(traceId);
  }

  /**
   * Check if a trace exists in the map.
   */
  protected hasTrace(traceId: string): boolean {
    return this.traceMap.has(traceId);
  }

  /**
   * Get the number of active traces.
   */
  protected getActiveTraceCount(): number {
    return this.traceMap.size;
  }

  /**
   * Handle incoming tracing events with automatic routing.
   */
  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    const span = event.exportedSpan;

    // Handle event-type spans separately (they only emit once)
    if (span.isEvent) {
      // Initialize trace if this is a root event span
      if (span.isRootSpan) {
        await this.initTrace(span);
      }

      const traceData = this.getTraceData({ span, method: 'handleEventSpan' });
      if (traceData) {
        await this.handleEventSpan(span, traceData);
      }
      return;
    }

    // Route to appropriate handler based on event type
    switch (event.type) {
      case 'span_started': {
        // Initialize trace for root spans
        if (span.isRootSpan) {
          await this.initTrace(span);
        }

        const traceData = this.getTraceData({ span, method: 'handleSpanStarted' });
        if (traceData) {
          // Mark span as active before handling (for non-event spans)
          this.markSpanActive(traceData, span.id);
          await this.handleSpanStarted(span, traceData);
        }
        break;
      }

      case 'span_updated': {
        const traceData = this.getTraceData({ span, method: 'handleSpanUpdated' });
        if (traceData) {
          await this.handleSpanUpdated(span, traceData);
        }
        break;
      }

      case 'span_ended': {
        const traceData = this.getTraceData({ span, method: 'handleSpanEnded' });
        if (traceData) {
          await this.handleSpanEnded(span, traceData);
          // Mark span as ended (may trigger trace cleanup)
          await this.markSpanEnded(span.traceId, traceData, span.id);
        }
        break;
      }
    }
  }

  /**
   * Shutdown the exporter, cleaning up all traces.
   */
  async shutdown(): Promise<void> {
    // Clean up all active traces
    for (const [traceId, traceData] of this.traceMap) {
      try {
        await this.cleanupTraceData(traceData, traceId);
      } catch (error) {
        this.logger.error(`${this.name}: Error cleaning up trace during shutdown`, {
          traceId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.traceMap.clear();
    await super.shutdown();
  }
}
