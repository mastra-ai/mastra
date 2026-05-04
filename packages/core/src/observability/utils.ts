/**
 * Browser-safe observability utilities.
 *
 * Functions that depend on AsyncLocalStorage (getCurrentSpan, executeWithContext,
 * executeWithContextSync) are in context-storage.ts and should only be imported
 * by server-side code.
 */

import { EntityType, SpanType } from './types';
import type { Span, GetOrCreateSpanOptions, AnySpan } from './types';

const entityTypeValues = new Set<EntityType>(Object.values(EntityType));
let currentSpanResolver: (() => AnySpan | undefined) | undefined;

export function setCurrentSpanResolver(resolver: (() => AnySpan | undefined) | undefined): void {
  currentSpanResolver = resolver;
}

export function resolveCurrentSpan(): AnySpan | undefined {
  return currentSpanResolver?.();
}

/** Generate a unique id for an observability signal (log, metric, score, feedback). */
export function generateSignalId(): string {
  return crypto.randomUUID();
}

// --- Lazy resolvers for executeWithContext / executeWithContextSync ---
// The real implementations live in context-storage.ts (which imports AsyncLocalStorage).
// context-storage.ts registers them at import time so that consumer code can call these
// browser-safe wrappers without pulling async_hooks into shared chunks.

type ExecuteWithContextFn = <T>(params: { span?: AnySpan; fn: () => Promise<T> }) => Promise<T>;
type ExecuteWithContextSyncFn = <T>(params: { span?: AnySpan; fn: () => T }) => T;

let executeWithContextImpl: ExecuteWithContextFn | undefined;
let executeWithContextSyncImpl: ExecuteWithContextSyncFn | undefined;

export function setExecuteWithContext(impl: ExecuteWithContextFn): void {
  executeWithContextImpl = impl;
}

export function setExecuteWithContextSync(impl: ExecuteWithContextSyncFn): void {
  executeWithContextSyncImpl = impl;
}

/**
 * Execute an async function within a span's tracing context.
 * Falls back to direct execution if no context-storage implementation is registered or no span exists.
 */
export async function executeWithContext<T>(params: { span?: AnySpan; fn: () => Promise<T> }): Promise<T> {
  if (executeWithContextImpl) {
    return executeWithContextImpl(params);
  }
  const { span, fn } = params;
  if (span?.executeInContext) {
    return span.executeInContext(fn);
  }
  return fn();
}

/**
 * Execute a sync function within a span's tracing context.
 * Falls back to direct execution if no context-storage implementation is registered or no span exists.
 */
export function executeWithContextSync<T>(params: { span?: AnySpan; fn: () => T }): T {
  if (executeWithContextSyncImpl) {
    return executeWithContextSyncImpl(params);
  }
  const { span, fn } = params;
  if (span?.executeInContextSync) {
    return span.executeInContextSync(fn);
  }
  return fn();
}

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

/**
 * Resolves the best available entity type for a span-like record.
 *
 * Prefers an explicit `entityType` when present and valid, then falls back to the
 * span type for common observability entities.
 */
export function getEntityTypeForSpan(span: {
  entityType?: string | null;
  spanType?: SpanType | string | null;
}): EntityType | undefined {
  if (span.entityType && entityTypeValues.has(span.entityType as EntityType)) {
    return span.entityType as EntityType;
  }

  switch (span.spanType) {
    case SpanType.AGENT_RUN:
      return EntityType.AGENT;
    case SpanType.RAG_INGESTION:
      return EntityType.RAG_INGESTION;
    case SpanType.SCORER_RUN:
    case SpanType.SCORER_STEP:
      return EntityType.SCORER;
    case SpanType.WORKFLOW_RUN:
      return EntityType.WORKFLOW_RUN;
    case SpanType.WORKFLOW_STEP:
      return EntityType.WORKFLOW_STEP;
    case SpanType.TOOL_CALL:
    case SpanType.MCP_TOOL_CALL:
      return EntityType.TOOL;
    case SpanType.PROCESSOR_RUN:
      return EntityType.OUTPUT_PROCESSOR;
    default:
      return undefined;
  }
}
