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

import type { RequestContext } from '@mastra/core/di';
import type { ObservabilityBridge, TracingEvent } from '@mastra/core/observability';
import { TracingEventType } from '@mastra/core/observability';
import { BaseExporter } from '@mastra/observability';
import { trace, context as otelContext, type Context, type Span, SpanStatusCode, SpanKind } from '@opentelemetry/api';

/**
 * Configuration for the OtelBridge
 */
export interface OtelBridgeConfig {
  // Currently no configuration options
  // Log level is inherited from observability instance configuration
}

/**
 * Map Mastra span types to OTEL span kinds for better trace visualization
 */
function mapSpanKind(mastraType: string): SpanKind {
  switch (mastraType) {
    // Entry points - spans that receive requests
    case 'agent_run':
    case 'workflow_run':
      return SpanKind.SERVER;

    // Outbound calls - spans that make requests to external services
    case 'tool_call':
    case 'mcp_tool_call':
    case 'model_generation':
    case 'model_step':
      return SpanKind.CLIENT;

    // Internal operations - everything else
    default:
      return SpanKind.INTERNAL;
  }
}

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
  name = 'otel-bridge';
  private tracer = trace.getTracer('@mastra/otel-bridge', '1.0.0');
  private spanMap = new Map<string, { otelSpan: Span; otelContext: Context }>();

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
   * Get OTEL context for a specific Mastra span
   *
   * This allows Mastra core to execute user code (tools, workflow steps, etc.)
   * within the OTEL span context, enabling proper parent-child relationships
   * for any OTEL-instrumented operations (DB calls, HTTP requests, etc.).
   *
   * @param spanId - Mastra span ID
   * @returns OTEL context for the span, or undefined if not found
   */
  getSpanContext(spanId: string): Context | undefined {
    return this.spanMap.get(spanId)?.otelContext;
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
   * Handle Mastra tracing events
   *
   * Creates OTEL spans when Mastra spans start, and ends them when Mastra spans end.
   * This maintains proper span hierarchy and allows OTEL-instrumented code within
   * Mastra spans to have correct parent-child relationships.
   */
  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    if (event.type === TracingEventType.SPAN_STARTED) {
      await this.handleSpanStarted(event);
    } else if (event.type === TracingEventType.SPAN_ENDED) {
      await this.handleSpanEnded(event);
    }
  }

  /**
   * Handle SPAN_STARTED event
   *
   * Creates an OTEL span and stores it with its context for later use.
   * The span is created within the current OTEL context, maintaining
   * parent-child relationships.
   */
  private async handleSpanStarted(event: TracingEvent): Promise<void> {
    try {
      const mastraSpan = event.exportedSpan;

      // Determine parent context: use Mastra parent span's context if available,
      // otherwise use active OTEL context (HTTP request span)
      let parentContext: Context;
      if (mastraSpan.parentSpanId) {
        const parentEntry = this.spanMap.get(mastraSpan.parentSpanId);
        if (parentEntry) {
          parentContext = parentEntry.otelContext;
          this.logger.debug(
            `[OtelBridge] Using parent span context [parentId=${mastraSpan.parentSpanId}] for [id=${mastraSpan.id}]`,
          );
        } else {
          // Parent not found in map, fall back to active context
          parentContext = otelContext.active();
          this.logger.debug(
            `[OtelBridge] Parent span not found [parentId=${mastraSpan.parentSpanId}], using active context for [id=${mastraSpan.id}]`,
          );
        }
      } else {
        // No parent span ID, this is a root Mastra span
        parentContext = otelContext.active();
        this.logger.debug(`[OtelBridge] No parent span, using active context for root span [id=${mastraSpan.id}]`);
      }

      this.logger.debug(
        `[OtelBridge] Creating OTEL span for Mastra span [id=${mastraSpan.id}] [name=${mastraSpan.name}]`,
      );

      // Create OTEL span with minimal info (final attributes set at SPAN_ENDED)
      const otelSpan = this.tracer.startSpan(
        mastraSpan.name,
        {
          startTime: mastraSpan.startTime,
          kind: mapSpanKind(mastraSpan.type),
        },
        parentContext,
      );

      // Set mastra.span.type immediately so it's available for identification
      otelSpan.setAttribute('mastra.span.type', mastraSpan.type);
      otelSpan.setAttribute('mastra.span.id', mastraSpan.id);

      // Create context with this span active
      const spanContext = trace.setSpan(parentContext, otelSpan);

      // Store for later retrieval
      this.spanMap.set(mastraSpan.id, { otelSpan, otelContext: spanContext });

      this.logger.debug(
        `[OtelBridge] Created OTEL span [mastraId=${mastraSpan.id}] [otelSpanId=${otelSpan.spanContext().spanId}]`,
      );
    } catch (error) {
      this.logger.error('[OtelBridge] Failed to handle SPAN_STARTED:', error);
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
      const entry = this.spanMap.get(mastraSpan.id);

      if (!entry) {
        this.logger.warn(
          `[OtelBridge] No OTEL span found for Mastra span [id=${mastraSpan.id}]. ` +
            'This can happen if the span started before the bridge was initialized.',
        );
        return;
      }

      const { otelSpan } = entry;

      this.logger.debug(`[OtelBridge] Ending OTEL span [mastraId=${mastraSpan.id}] [name=${mastraSpan.name}]`);

      // Set all final attributes
      if (mastraSpan.attributes) {
        for (const [key, value] of Object.entries(mastraSpan.attributes)) {
          if (value !== undefined && value !== null) {
            otelSpan.setAttribute(key, value);
          }
        }
      }

      // Set status based on errorInfo
      if (mastraSpan.errorInfo) {
        otelSpan.setStatus({
          code: SpanStatusCode.ERROR,
          message: mastraSpan.errorInfo.message,
        });

        // Record exception with error details
        const error = new Error(mastraSpan.errorInfo.message);
        if (mastraSpan.errorInfo.id) {
          (error as any).id = mastraSpan.errorInfo.id;
        }
        if (mastraSpan.errorInfo.domain) {
          (error as any).domain = mastraSpan.errorInfo.domain;
        }
        if (mastraSpan.errorInfo.category) {
          (error as any).category = mastraSpan.errorInfo.category;
        }
        if (mastraSpan.errorInfo.details) {
          (error as any).details = mastraSpan.errorInfo.details;
        }
        otelSpan.recordException(error);
      } else {
        otelSpan.setStatus({ code: SpanStatusCode.OK });
      }

      // Add input/output as attributes (if present and serializable)
      if (mastraSpan.input) {
        try {
          otelSpan.setAttribute('mastra.input', JSON.stringify(mastraSpan.input));
        } catch (error) {
          this.logger.debug('[OtelBridge] Failed to serialize span input:', error);
        }
      }
      if (mastraSpan.output) {
        try {
          otelSpan.setAttribute('mastra.output', JSON.stringify(mastraSpan.output));
        } catch (error) {
          this.logger.debug('[OtelBridge] Failed to serialize span output:', error);
        }
      }

      // End the span with the actual end time
      otelSpan.end(mastraSpan.endTime);

      // Clean up
      this.spanMap.delete(mastraSpan.id);

      this.logger.debug(
        `[OtelBridge] Completed OTEL span [mastraId=${mastraSpan.id}] [traceId=${otelSpan.spanContext().traceId}]`,
      );
    } catch (error) {
      this.logger.error('[OtelBridge] Failed to handle SPAN_ENDED:', error);
    }
  }

  /**
   * Shutdown the bridge and clean up resources
   */
  async shutdown(): Promise<void> {
    // End any remaining spans
    for (const [spanId, { otelSpan }] of this.spanMap.entries()) {
      this.logger.warn(`[OtelBridge] Force-ending span that was not properly closed [id=${spanId}]`);
      otelSpan.end();
    }
    this.spanMap.clear();
    this.logger.info('[OtelBridge] Shutdown complete');
  }
}
