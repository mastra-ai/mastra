/**
 * OpenTelemetry Bridge for Mastra Observability
 *
 * This bridge enables Mastra to integrate with existing OpenTelemetry infrastructure by:
 * 1. Extracting OTEL trace context (traceId, parentSpanId) from active context or headers
 * 2. Injecting that context into Mastra span creation
 * 3. Exporting Mastra spans to OTEL collectors
 */

import type { RequestContext } from '@mastra/core/di';
import type { ObservabilityBridge, TracingEvent } from '@mastra/core/observability';
import { TracingEventType } from '@mastra/core/observability';
import { BaseExporter } from '@mastra/observability';
import { trace, context as otelContext } from '@opentelemetry/api';

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

  constructor(config: OtelBridgeConfig = {}) {
    super(config);
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
   * For Phase 1, we log the spans but don't export them yet.
   * Full export implementation will come in a later phase.
   */
  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    // Only log for now - full export implementation coming in Phase 2
    if (event.type === TracingEventType.SPAN_ENDED) {
      this.logger.debug(
        `[OtelBridge] Would export span [id=${event.exportedSpan.id}] [traceId=${event.exportedSpan.traceId}] [type=${event.exportedSpan.type}]`,
      );
    }

    // TODO: Implement full span export in Phase 2
    // - Convert Mastra span to OTEL ReadableSpan
    // - Export through BatchSpanProcessor
    // - Support both active provider and standalone exporter
  }

  /**
   * Shutdown the bridge and clean up resources
   */
  async shutdown(): Promise<void> {
    this.logger.info('[OtelBridge] Shutdown complete');
  }
}
