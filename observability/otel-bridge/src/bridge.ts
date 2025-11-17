/**
 * OpenTelemetry Bridge for Mastra Observability
 *
 * This bridge enables bidirectional integration with OpenTelemetry infrastructure:
 * 1. Reads OTEL trace context from active spans (via AsyncLocalStorage)
 * 2. Injects that context into Mastra span creation (parent-child relationships)
 * 3. Exports Mastra spans back to OTEL through the active TracerProvider
 *
 * This creates complete distributed traces where Mastra spans are properly
 * nested within OTEL spans from auto-instrumentation.
 */

import type { RequestContext } from '@mastra/core/di';
import type { ObservabilityBridge, TracingEvent } from '@mastra/core/observability';
import { TracingEventType } from '@mastra/core/observability';
import { BaseExporter } from '@mastra/observability';
import { SpanConverter } from '@mastra/otel-exporter';
import { trace, context as otelContext } from '@opentelemetry/api';
import type { ReadableSpan, SpanProcessor } from '@opentelemetry/sdk-trace-base';

/**
 * Configuration for the OtelBridge
 */
export interface OtelBridgeConfig {
  // Currently no configuration options
  // Log level is inherited from observability instance configuration
}

/**
 * OpenTelemetry Bridge implementation
 *
 * Extracts trace context from active OTEL spans using AsyncLocalStorage.
 * Requires OTEL auto-instrumentation to be configured in your application.
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
  name = 'otel-bridge';
  private spanConverter: SpanConverter;
  private cachedProcessor?: SpanProcessor | null;

  constructor(config: OtelBridgeConfig = {}) {
    super(config);
    this.spanConverter = new SpanConverter();
  }

  /**
   * Get current OTEL context for span creation
   *
   * Extracts context from the active OTEL span using AsyncLocalStorage.
   * Requires OTEL auto-instrumentation to be configured.
   *
   * @param _requestContext - Unused, kept for compatibility
   * @returns OTEL context or undefined if not available
   */
  getCurrentContext(_requestContext?: RequestContext):
    | {
        traceId: string;
        parentSpanId?: string;
        isSampled: boolean;
      }
    | undefined {
    const activeContext = this.getActiveContext();
    if (activeContext) {
      this.logger.debug(`[OtelBridge] Extracted context from active span [traceId=${activeContext.traceId}]`);
      return activeContext;
    }

    this.logger.debug('[OtelBridge] No OTEL context found');
    return undefined;
  }

  /**
   * Extract context from active OTEL span
   */
  private getActiveContext():
    | {
        traceId: string;
        parentSpanId?: string;
        isSampled: boolean;
      }
    | undefined {
    try {
      // Use standard OTEL API to get active span
      const activeSpan = trace.getSpan(otelContext.active());
      if (!activeSpan) {
        return undefined;
      }

      const spanContext = activeSpan.spanContext();
      if (!spanContext) {
        return undefined;
      }

      return {
        traceId: spanContext.traceId,
        parentSpanId: spanContext.spanId,
        isSampled: (spanContext.traceFlags & 1) === 1,
      };
    } catch (error) {
      this.logger.debug('[OtelBridge] Failed to get active OTEL context:', error);
      return undefined;
    }
  }

  /**
   * Export Mastra tracing events to OTEL infrastructure
   *
   * Converts Mastra spans to OTEL format and exports them through the
   * active TracerProvider's span processor. This allows Mastra spans to
   * appear in the same trace as OTEL auto-instrumentation spans.
   */
  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    // Only export completed spans to OTEL
    // OTEL expects spans with both start and end times
    if (event.type !== TracingEventType.SPAN_ENDED) {
      return;
    }

    try {
      // Get the active OTEL span processor
      const processor = this.getActiveSpanProcessor();

      if (!processor) {
        // No active OTEL setup - log once and skip
        if (this.cachedProcessor === undefined) {
          this.logger.debug(
            '[OtelBridge] No active OTEL TracerProvider found. Mastra spans will not be exported to OTEL. ' +
              'Ensure OTEL SDK is initialized before Mastra.',
          );
          this.cachedProcessor = null; // Mark as checked to avoid repeated logs
        }
        return;
      }

      // Convert Mastra span to OTEL ReadableSpan format
      const readableSpan = this.spanConverter.convertSpan(event.exportedSpan);

      // Export the span through OTEL's processor
      // This will batch and send to whatever exporter the user configured
      processor.onEnd(readableSpan);

      this.logger.debug(
        `[OtelBridge] Exported span [id=${event.exportedSpan.id}] [traceId=${event.exportedSpan.traceId}] [type=${event.exportedSpan.type}]`,
      );
    } catch (error) {
      this.logger.error('[OtelBridge] Failed to export span to OTEL:', error);
    }
  }

  /**
   * Get the active OTEL span processor from the TracerProvider
   *
   * This accesses the user's existing OTEL SDK configuration to export
   * Mastra spans through their configured pipeline.
   */
  private getActiveSpanProcessor(): SpanProcessor | undefined {
    // Return cached result if we already checked
    if (this.cachedProcessor !== undefined) {
      return this.cachedProcessor || undefined;
    }

    try {
      let provider = trace.getTracerProvider();

      // Check if it's a real TracerProvider (not NoopTracerProvider)
      if (!provider || provider.constructor.name === 'NoopTracerProvider') {
        this.cachedProcessor = null;
        return undefined;
      }

      // If it's a ProxyTracerProvider, get the delegate (the real NodeTracerProvider)
      if (provider.constructor.name === 'ProxyTracerProvider') {
        const delegate = (provider as any).getDelegate?.() || (provider as any)._delegate;
        if (delegate) {
          provider = delegate;
        }
      }

      // Access the active span processor
      // Different ways OTEL SDKs expose the processor:
      // - NodeTracerProvider: _activeSpanProcessor (with underscore!)
      // - Some older versions: activeSpanProcessor or _registeredSpanProcessors
      const activeSpanProcessor =
        (provider as any)._activeSpanProcessor ||
        (provider as any).activeSpanProcessor ||
        (provider as any)._registeredSpanProcessors?.[0];

      if (activeSpanProcessor) {
        this.cachedProcessor = activeSpanProcessor;
        this.logger.debug('[OtelBridge] Found active OTEL span processor');
        return activeSpanProcessor;
      }

      this.cachedProcessor = null;
      return undefined;
    } catch (error) {
      this.logger.debug('[OtelBridge] Failed to get active OTEL span processor:', error);
      this.cachedProcessor = null;
      return undefined;
    }
  }

  /**
   * Shutdown the bridge and clean up resources
   */
  async shutdown(): Promise<void> {
    this.logger.info('[OtelBridge] Shutdown complete');
  }
}
