import type { Span, SpanType, GetOrCreateSpanOptions } from './types';

/**
 * Creates or gets a child span from existing tracing context or starts a new trace.
 * This helper consolidates the common pattern of creating spans that can either be:
 * 1. Children of an existing span (when tracingContext.currentSpan exists)
 * 2. New root spans (when no current span exists)
 *
 * @param options - Configuration object for span creation
 * @returns The created Span or undefined if tracing is disabled
 */
export function getOrCreateSpan<T extends SpanType>(options: GetOrCreateSpanOptions<T>): Span<T> | undefined {
  const { type, attributes, tracingContext, requestContext, tracingOptions, ...rest } = options;

  const metadata = {
    ...(rest.metadata ?? {}),
    ...(tracingOptions?.metadata ?? {}),
  };

  // If we have a current span, create a child span
  if (tracingContext?.currentSpan) {
    return tracingContext.currentSpan.createChildSpan({
      type,
      attributes,
      ...rest,
      metadata,
    });
  }

  // Get instance once - used for both bridge access and span creation
  const instance = options.mastra?.observability?.getSelectedInstance({ requestContext });
  if (!instance) {
    return undefined;
  }

  // Try to get OTEL context from bridge if no explicit traceId
  let finalTracingOptions = tracingOptions;

  if (!tracingOptions?.traceId) {
    const bridge = instance.getBridge();

    if (bridge) {
      try {
        const bridgeContext = bridge.getCurrentContext(requestContext);

        if (bridgeContext) {
          // Respect OTEL sampling decision
          if (!bridgeContext.isSampled) {
            return undefined; // Don't create span
          }

          // Inject OTEL context
          finalTracingOptions = {
            ...tracingOptions,
            traceId: bridgeContext.traceId,
            parentSpanId: bridgeContext.parentSpanId,
          };
        }
      } catch (error) {
        // Log warning and continue with new trace
        instance.getLogger().warn('Failed to get OTEL context from bridge, creating new trace:', error);
      }
    }
  }

  // Create new root span with potentially enhanced options
  return instance.startSpan<T>({
    type,
    attributes,
    ...rest,
    metadata,
    requestContext,
    tracingOptions: finalTracingOptions,
    traceId: finalTracingOptions?.traceId,
    parentSpanId: finalTracingOptions?.parentSpanId,
    customSamplerOptions: {
      requestContext,
      metadata,
    },
  });
}
