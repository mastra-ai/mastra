/**
 * OpenTelemetry Bridge for Mastra Observability
 *
 * This bridge enables Mastra to integrate with existing OpenTelemetry infrastructure by:
 * 1. Extracting OTEL trace context (traceId, parentSpanId) from active context or headers
 * 2. Injecting that context into Mastra span creation
 * 3. Exporting Mastra spans to OTEL collectors
 */

import { trace, context as otelContext } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { BaseExporter } from '@mastra/observability';
import type { ObservabilityBridge, TracingEvent, InitBridgeOptions } from '@mastra/core/observability';
import { TracingEventType } from '@mastra/core/observability';
import type { RequestContext } from '@mastra/core/di';

/**
 * Configuration for the OtelBridge
 */
export interface OtelBridgeConfig {
  /**
   * Where to extract OTEL context from
   * - 'active-context': From trace.getSpan(context.active())
   * - 'headers': From RequestContext with 'otel.headers' key
   * - 'both': Try active context first, then headers (DEFAULT)
   */
  extractFrom?: 'active-context' | 'headers' | 'both';

  /**
   * Log level for the bridge
   */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * OpenTelemetry Bridge implementation
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
 *         bridge: new OtelBridge({
 *           extractFrom: 'both',  // Default
 *         }),
 *       }
 *     }
 *   }
 * });
 * ```
 */
export class OtelBridge extends BaseExporter implements ObservabilityBridge {
  name = 'otel-bridge';

  private config: Required<OtelBridgeConfig>;
  private propagator: W3CTraceContextPropagator;

  constructor(config: OtelBridgeConfig = {}) {
    super({ logLevel: config.logLevel });

    this.config = {
      extractFrom: config.extractFrom ?? 'both',
      logLevel: config.logLevel ?? 'info',
    };

    // Use OTEL's standard W3C propagator
    this.propagator = new W3CTraceContextPropagator();
  }

  /**
   * Get current OTEL context for span creation
   *
   * @param requestContext - Optional request context with headers
   * @returns OTEL context or undefined if not available
   */
  getCurrentContext(requestContext?: RequestContext):
    | {
        traceId: string;
        parentSpanId?: string;
        isSampled: boolean;
      }
    | undefined {
    const { extractFrom } = this.config;

    // Strategy 1: Try active OTEL context (Scenario B)
    if (extractFrom === 'active-context' || extractFrom === 'both') {
      const activeContext = this.getActiveContext();
      if (activeContext) {
        this.logger.debug(`[OtelBridge] Extracted context from active span [traceId=${activeContext.traceId}]`);
        return activeContext;
      }
    }

    // Strategy 2: Try W3C headers from RequestContext (Scenario A)
    if (extractFrom === 'headers' || extractFrom === 'both') {
      const headerContext = this.getHeaderContext(requestContext);
      if (headerContext) {
        this.logger.debug(`[OtelBridge] Extracted context from headers [traceId=${headerContext.traceId}]`);
        return headerContext;
      }
    }

    this.logger.debug('[OtelBridge] No OTEL context found');
    return undefined;
  }

  /**
   * Extract context from active OTEL span (Scenario B)
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
   * Extract context from W3C headers via RequestContext (Scenario A)
   */
  private getHeaderContext(requestContext?: RequestContext):
    | {
        traceId: string;
        parentSpanId?: string;
        isSampled: boolean;
      }
    | undefined {
    if (!requestContext) {
      return undefined;
    }

    try {
      // Look for headers in RequestContext
      // Convention: headers stored under 'otel.headers' key
      const headers = requestContext.get('otel.headers') as { traceparent?: string; tracestate?: string } | undefined;
      if (!headers?.traceparent) {
        return undefined;
      }

      // Extract context using W3C propagator
      const extractedContext = this.propagator.extract(otelContext.active(), headers, {
        get: (carrier: any, key: string) => carrier[key],
        keys: (carrier: any) => Object.keys(carrier),
      });

      // Get span from extracted context
      const span = trace.getSpan(extractedContext);
      if (!span) {
        return undefined;
      }

      const spanContext = span.spanContext();
      return {
        traceId: spanContext.traceId,
        parentSpanId: spanContext.spanId,
        isSampled: (spanContext.traceFlags & 1) === 1,
      };
    } catch (error) {
      this.logger.debug('[OtelBridge] Failed to extract context from headers:', error);
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
