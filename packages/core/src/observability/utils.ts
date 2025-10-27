import type { AISpan, AISpanType, GetOrCreateSpanOptions } from './types';

/**
 * Creates or gets a child span from existing tracing context or starts a new trace.
 * This helper consolidates the common pattern of creating spans that can either be:
 * 1. Children of an existing span (when tracingContext.currentSpan exists)
 * 2. New root spans (when no current span exists)
 *
 * @param options - Configuration object for span creation
 * @returns The created AI span or undefined if tracing is disabled
 */
export function getOrCreateSpan<T extends AISpanType>(options: GetOrCreateSpanOptions<T>): AISpan<T> | undefined {
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

  // Otherwise, try to create a new root span
  const aiTracing = options.mastra?.observability.getSelectedObservability({ requestContext });

  return aiTracing?.startSpan<T>({
    type,
    attributes,
    ...rest,
    metadata,
    requestContext,
    tracingOptions,
    traceId: tracingOptions?.traceId,
    parentSpanId: tracingOptions?.parentSpanId,
    customSamplerOptions: {
      requestContext,
      metadata,
    },
  });
}
