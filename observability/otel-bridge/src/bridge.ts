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
import type { ObservabilityBridge, TracingEvent, AnySpan } from '@mastra/core/observability';
import { TracingEventType } from '@mastra/core/observability';
import { BaseExporter } from '@mastra/observability';
import { trace as otelTrace, context as otelContext, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import type { Span as OtelSpan, Context as OtelContext, SpanContext as OtelSpanContext } from '@opentelemetry/api';

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
  private otelTracer = otelTrace.getTracer('@mastra/otel-bridge', '1.0.0');
  private otelSpanMap = new Map<string, { otelSpan: OtelSpan; otelContext: OtelContext; spanType: string }>();

  constructor(config: OtelBridgeConfig = {}) {
    super(config);
  }

  /**
   * Get current OTEL context for span creation
   *
   * Extracts context from the active OTEL span using AsyncLocalStorage.
   * Requires OTEL auto-instrumentation to be configured.
   *
   * @returns OTEL context or undefined if not available
   */
  getCurrentContext():
    | {
        traceId: string;
        parentSpanId?: string;
        isSampled: boolean;
      }
    | undefined {
    try {
      // Use standard OTEL API to get active span
      const activeSpan = otelTrace.getSpan(otelContext.active());
      if (!activeSpan) {
        return undefined;
      }

      const spanContext = activeSpan.spanContext();
      if (!spanContext) {
        return undefined;
      }
      this.logger.debug(`[OtelBridge] Extracted context from active span [traceId=${activeContext.traceId}]`);

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
   * Callback invoked when a Mastra span is created.
   * Registers specific user-facing span types so they're available for context wrapping.
   *
   * @param span - The Mastra span that was just created
   */
  onSpanCreated(span: AnySpan): void {
    // Only register spans where user code might execute
    const shouldRegister =
      span.type === 'tool_call' ||
      span.type === 'mcp_tool_call' ||
      span.type === 'workflow_step' ||
      span.type === 'workflow_conditional_eval';

    if (shouldRegister) {
      this.registerSpan(span.id, span.getParentSpanId(), span.type, span.name, span.startTime);
    } else {
      console.log(
        `[OtelBridge.onSpanCreated] Skipping registration for span [type=${span.type}] [id=${span.id}] [name=${span.name}]`,
      );
    }
  }

  /**
   * Synchronously register a span for context wrapping.
   * This is called immediately when a span is created (before user code executes),
   * ensuring the span is available for executeInContext/executeInContextSync.
   *
   * @param spanId - Mastra span ID
   * @param parentSpanId - Parent Mastra span ID (if any)
   * @param spanType - Type of span (for determining OTEL span kind)
   * @param spanName - Name of the span
   * @param startTime - When the span started
   */
  private registerSpan(
    spanId: string,
    parentSpanId: string | undefined,
    spanType: string,
    spanName: string,
    startTime: Date,
  ): void {
    try {
      // Determine parent context
      let parentOtelContext: OtelContext;
      if (parentSpanId) {
        const parentEntry = this.otelSpanMap.get(parentSpanId);
        if (parentEntry) {
          parentOtelContext = parentEntry.otelContext;
        } else {
          parentOtelContext = otelContext.active();
        }
      } else {
        parentOtelContext = otelContext.active();
      }

      // Create OTEL span
      const otelSpan = this.otelTracer.startSpan(
        spanName,
        {
          startTime,
          kind: mapSpanKind(spanType),
        },
        parentOtelContext,
      );

      // Set identifying attributes
      otelSpan.setAttribute('mastra.span.type', spanType);
      otelSpan.setAttribute('mastra.span.id', spanId);

      // Create context with this span active
      const spanContext = otelTrace.setSpan(parentOtelContext, otelSpan);

      // Store for later retrieval
      this.otelSpanMap.set(spanId, { otelSpan, otelContext: spanContext, spanType });

      console.log(
        `[OtelBridge.registerSpan] Registered span [mastraId=${spanId}] [otelSpanId=${otelSpan.spanContext().spanId}] ` +
          `[type=${spanType}] [mapSize=${this.otelSpanMap.size}]`,
      );
    } catch (error) {
      this.logger.error('[OtelBridge] Failed to register span:', error);
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

      // Skip if already registered synchronously
      if (this.otelSpanMap.has(mastraSpan.id)) {
        this.logger.debug(`[OtelBridge] Span already registered [id=${mastraSpan.id}], skipping async registration`);
        return;
      }

      // Register the span (for spans that weren't registered synchronously)
      this.registerSpan(mastraSpan.id, mastraSpan.parentSpanId, mastraSpan.type, mastraSpan.name, mastraSpan.startTime);
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
      const entry = this.otelSpanMap.get(mastraSpan.id);

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
      this.otelSpanMap.delete(mastraSpan.id);

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

    // Debug logging
    const activeSpan = otelTrace.getSpan(otelContext.active());
    const spanType = entry?.spanType || 'unknown';
    console.log(
      `[OtelBridge.executeWithSpanContext] spanId=${spanId}, ` +
        `type=${spanType}, ` +
        `inMap=${!!entry}, ` +
        `activeOtelSpan=${activeSpan?.spanContext().spanId || 'none'}, ` +
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
