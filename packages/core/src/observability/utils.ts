import type { Span, SpanType, GetOrCreateSpanOptions, AnySpan, AnyExportedSpan, CorrelationContext } from './types';

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
      requestContext,
    });
  }

  // Otherwise, try to create a new root span
  const instance = options.mastra?.observability?.getSelectedInstance({ requestContext });

  return instance?.startSpan<T>({
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

/**
 * Execute an async function within the span's tracing context if available.
 * Falls back to direct execution if no span exists.
 *
 * When a bridge is configured, this enables auto-instrumented operations
 * (HTTP requests, database queries, etc.) to be properly nested under the
 * current span in the external tracing system.
 *
 * @param span - The span to use as context (or undefined to execute without context)
 * @param fn - The async function to execute
 * @returns The result of the function execution
 *
 * @example
 * ```typescript
 * const result = await executeWithContext(llmSpan, async () =>
 *   model.generateText(args)
 * );
 * ```
 */
export async function executeWithContext<T>(params: { span?: AnySpan; fn: () => Promise<T> }): Promise<T> {
  const { span, fn } = params;

  if (span?.executeInContext) {
    return span.executeInContext(fn);
  }

  return fn();
}

/**
 * Execute a synchronous function within the span's tracing context if available.
 * Falls back to direct execution if no span exists.
 *
 * When a bridge is configured, this enables auto-instrumented operations
 * (HTTP requests, database queries, etc.) to be properly nested under the
 * current span in the external tracing system.
 *
 * @param span - The span to use as context (or undefined to execute without context)
 * @param fn - The synchronous function to execute
 * @returns The result of the function execution
 *
 * @example
 * ```typescript
 * const result = executeWithContextSync(llmSpan, () =>
 *   model.streamText(args)
 * );
 * ```
 */
export function executeWithContextSync<T>(params: { span?: AnySpan; fn: () => T }): T {
  const { span, fn } = params;

  if (span?.executeInContextSync) {
    return span.executeInContextSync(fn);
  }

  return fn();
}

/**
 * Returns the top-most non-internal span that would appear in exported tracing output.
 *
 * Public API results should use this span for trace/span correlation because internal Mastra
 * workflow spans are omitted from external exporters.
 */
export function getRootExportSpan(span?: AnySpan): AnySpan | undefined {
  if (!span?.isValid) {
    return undefined;
  }

  let current: AnySpan | undefined = span;
  let rootExportSpan: AnySpan | undefined = span.isInternal ? undefined : span;

  while (current?.parent) {
    current = current.parent;

    if (!current.isInternal) {
      rootExportSpan = current;
    }
  }

  return rootExportSpan;
}

/** Extract correlation context from an exported span. */
export function buildCorrelationContext(span: AnyExportedSpan): CorrelationContext {
  const metadata = span.metadata ?? {};

  return {
    traceId: span.traceId,
    spanId: span.id,
    entityType: span.entityType,
    entityId: span.entityId,
    entityName: span.entityName,
    userId: typeof metadata.userId === 'string' ? metadata.userId : undefined,
    organizationId: typeof metadata.organizationId === 'string' ? metadata.organizationId : undefined,
    resourceId: typeof metadata.resourceId === 'string' ? metadata.resourceId : undefined,
    runId: typeof metadata.runId === 'string' ? metadata.runId : undefined,
    sessionId: typeof metadata.sessionId === 'string' ? metadata.sessionId : undefined,
    threadId: typeof metadata.threadId === 'string' ? metadata.threadId : undefined,
    requestId: typeof metadata.requestId === 'string' ? metadata.requestId : undefined,
    environment: typeof metadata.environment === 'string' ? metadata.environment : undefined,
    source: typeof metadata.source === 'string' ? metadata.source : undefined,
    serviceName: typeof metadata.serviceName === 'string' ? metadata.serviceName : undefined,
    experimentId: typeof metadata.experimentId === 'string' ? metadata.experimentId : undefined,
  };
}
