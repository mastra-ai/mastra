/**
 * OpenTelemetry Bridge for Mastra Observability
 *
 * This bridge enables bidirectional integration with OpenTelemetry infrastructure:
 * 1. Reads OTEL trace context from active spans (via AsyncLocalStorage)
 * 2. Creates real OTEL spans when Mastra spans are created
 * 3. Maintains span context for proper parent-child relationships
 * 4. Allows OTEL-instrumented code (DB, HTTP clients) in tools/workflows to have correct parents
 *
 * This creates complete distributed traces where Mastra spans are properly
 * nested within OTEL spans from auto-instrumentation, and any OTEL-instrumented
 * operations within Mastra spans maintain the correct hierarchy.
 */

import type {
  ObservabilityBridge,
  TracingEvent,
  CreateSpanOptions,
  SpanType,
  SpanIds,
  InitExporterOptions,
} from '@mastra/core/observability';
import { TracingEventType } from '@mastra/core/observability';
import { BaseExporter, getExternalParentId } from '@mastra/observability';
import { SpanConverter, getSpanKind } from '@mastra/otel-exporter';
import { trace as otelTrace, context as otelContext } from '@opentelemetry/api';
import type { Span as OtelSpan, Context as OtelContext } from '@opentelemetry/api';

/**
 * Configuration for the OtelBridge
 */

export type OtelBridgeConfig = {
  // Currently no configuration options - placeholder for future options
};

/**
 * OpenTelemetry Bridge implementation
 *
 * Creates real OTEL spans when Mastra spans are created, maintaining proper
 * context propagation for nested instrumentation.
 *
 * @example
 * ```typescript
 * import { OtelBridge } from '@mastra/otel-bridge';
 * import { Mastra } from '@mastra/core';
 *
 * const mastra = new Mastra({
 *   agents: { myAgent },
 *   observability: {
 *     configs: {
 *       default: {
 *         serviceName: 'my-service',
 *         bridge: new OtelBridge(),
 *       }
 *     }
 *   }
 * });
 * ```
 */
export class OtelBridge extends BaseExporter implements ObservabilityBridge {
  name = 'otel';
  private otelTracer = otelTrace.getTracer('@mastra/otel-bridge', '1.0.0');
  private otelSpanMap = new Map<string, { otelSpan: OtelSpan; otelContext: OtelContext }>();
  private spanConverter?: SpanConverter;

  constructor(config: OtelBridgeConfig = {}) {
    super(config);
  }

  /**
   * Handle Mastra tracing events
   *
   * Ships OTEL spans when Mastra spans end.
   * This maintains proper span hierarchy and allows OTEL-instrumented code within
   * Mastra spans to have correct parent-child relationships.
   * Note: OTEL spans are created when registerSpan is called when the span is first created.
   */
  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    if (event.type === TracingEventType.SPAN_ENDED) {
      await this.handleSpanEnded(event);
    }
  }

  /**
   * Initialize with tracing configuration
   */
  init(options: InitExporterOptions) {
    this.spanConverter = new SpanConverter({
      packageName: '@mastra/otel-bridge',
      serviceName: options.config?.serviceName,
      format: 'GenAI_v1_38_0',
    });
  }

  /**
   * Create a span in the bridge's tracing system.
   * Called during Mastra span construction to get bridge-generated identifiers.
   *
   * @param options - Span creation options from Mastra
   * @returns Span identifiers (spanId, traceId, parentSpanId) from bridge, or undefined if creation fails
   */
  createSpan(options: CreateSpanOptions<SpanType>): SpanIds | undefined {
    try {
      // Determine parent context
      let parentOtelContext = otelContext.active();

      // Get external parent ID (walks up chain to find non-internal parent)
      const externalParentId = getExternalParentId(options);
      if (externalParentId) {
        // Look up external parent's OTEL span from map
        const parentEntry = this.otelSpanMap.get(externalParentId);
        if (parentEntry) {
          parentOtelContext = parentEntry.otelContext;
        }
      }

      // Create OTEL span with SpanKind (must be set at creation, immutable)
      const otelSpan = this.otelTracer.startSpan(
        options.name,
        {
          kind: getSpanKind(options.type),
        },
        parentOtelContext,
      );

      // Create context with this span active
      const spanContext = otelTrace.setSpan(parentOtelContext, otelSpan);

      // Get OTEL span identifiers
      const otelSpanContext = otelSpan.spanContext();
      const spanId = otelSpanContext.spanId;
      const traceId = otelSpanContext.traceId;

      // Store for later retrieval (for executeWithSpanContext and event handling)
      this.otelSpanMap.set(spanId, { otelSpan, otelContext: spanContext });

      // Get parentSpanId from parent context if available
      const parentSpan = otelTrace.getSpan(parentOtelContext);
      const parentSpanId = parentSpan?.spanContext().spanId;

      this.logger.debug(
        `[OtelBridge.createSpan] Created span [spanId=${spanId}] [traceId=${traceId}] ` +
          `[parentSpanId=${parentSpanId}] [type=${options.type}] [mapSize=${this.otelSpanMap.size}]`,
      );

      return { spanId, traceId, parentSpanId };
    } catch (error) {
      this.logger.error('[OtelBridge] Failed to create span:', error);
      return undefined;
    }
  }

  /**
   * Handle SPAN_ENDED event
   *
   * Retrieves the OTEL span created at SPAN_STARTED, sets all final attributes,
   * events, and status, then ends the span. Cleans up the span map entry.
   */
  private async handleSpanEnded(event: TracingEvent): Promise<void> {
    try {
      const mastraSpan = event.exportedSpan;
      const entry = this.otelSpanMap.get(mastraSpan.id);

      if (!entry) {
        this.logger.warn(`[OtelBridge] No OTEL span found for Mastra span [id=${mastraSpan.id}].`);
        return;
      }

      // Remove from map immediately to prevent memory leak
      this.otelSpanMap.delete(mastraSpan.id);

      if (!this.spanConverter) {
        return;
      }

      const { otelSpan } = entry;

      this.logger.debug(`[OtelBridge] Ending OTEL span [mastraId=${mastraSpan.id}] [name=${mastraSpan.name}]`);

      // Use SpanConverter to get consistent span formatting with otel-exporter
      const readableSpan = await this.spanConverter!.convertSpan(mastraSpan);

      // Update span name to match the converter's formatting
      otelSpan.updateName(readableSpan.name);

      // Set all attributes from the converter (includes OTEL semantic conventions)
      for (const [key, value] of Object.entries(readableSpan.attributes)) {
        if (value !== undefined && value !== null && typeof value !== 'object') {
          otelSpan.setAttribute(key, value);
        }
      }

      // Set status from the converter
      otelSpan.setStatus(readableSpan.status);

      // Add exception events if present
      for (const event of readableSpan.events) {
        if (event.name === 'exception' && event.attributes) {
          const error = new Error(event.attributes['exception.message'] as string);
          otelSpan.recordException(error);
        }
      }

      // End the span with the actual end time
      otelSpan.end(mastraSpan.endTime);

      this.logger.debug(
        `[OtelBridge] Completed OTEL span [mastraId=${mastraSpan.id}] [traceId=${otelSpan.spanContext().traceId}]`,
      );
    } catch (error) {
      this.logger.error('[OtelBridge] Failed to handle SPAN_ENDED:', error);
    }
  }

  /**
   * Execute a function (sync or async) within the OTEL context of a Mastra span.
   * Retrieves the stored OTEL context for the span and executes the function within it.
   *
   * This is the core implementation used by both executeInContext and executeInContextSync.
   *
   * @param spanId - The ID of the Mastra span to use as context
   * @param fn - The function to execute within the span context
   * @returns The result of the function execution
   */
  private executeWithSpanContext<T>(spanId: string, fn: () => T): T {
    const entry = this.otelSpanMap.get(spanId);

    this.logger.debug(
      `[OtelBridge.executeWithSpanContext] spanId=${spanId}, ` +
        `inMap=${!!entry}, ` +
        `storedOtelSpan=${entry?.otelSpan.spanContext().spanId || 'none'}`,
    );

    const spanContext = entry?.otelContext;
    if (spanContext) {
      return otelContext.with(spanContext, fn);
    }
    return fn();
  }

  /**
   * Execute an async function within the OTEL context of a Mastra span.
   *
   * @param spanId - The ID of the Mastra span to use as context
   * @param fn - The async function to execute within the span context
   * @returns The result of the function execution
   */
  executeInContext<T>(spanId: string, fn: () => Promise<T>): Promise<T> {
    return this.executeWithSpanContext(spanId, fn);
  }

  /**
   * Execute a synchronous function within the OTEL context of a Mastra span.
   *
   * @param spanId - The ID of the Mastra span to use as context
   * @param fn - The synchronous function to execute within the span context
   * @returns The result of the function execution
   */
  executeInContextSync<T>(spanId: string, fn: () => T): T {
    return this.executeWithSpanContext(spanId, fn);
  }

  /**
   * Shutdown the bridge and clean up resources
   */
  async shutdown(): Promise<void> {
    // End any remaining spans
    for (const [spanId, { otelSpan }] of this.otelSpanMap.entries()) {
      this.logger.warn(`[OtelBridge] Force-ending span that was not properly closed [id=${spanId}]`);
      otelSpan.end();
    }
    this.otelSpanMap.clear();
    this.logger.info('[OtelBridge] Shutdown complete');
  }
}
