import type { ObservabilityContext } from '@mastra/core/observability';
import { EntityType, resolveCurrentSpan, SpanType } from '@mastra/core/observability';

/**
 * Env var that opts into deep OM instrumentation child spans for hot-path
 * internals (`step.prepare`, `getStatus`, `getOrCreateRecord`). Off by default.
 *
 * Set to `1` or `true` to enable. When unset, `withOmDebugSpan` is a pass-through
 * with no span construction overhead.
 *
 * @see https://github.com/mastra-ai/mastra/issues/15677
 */
export const OM_DEBUG_TRACE_ENV = 'MASTRA_OM_DEBUG_TRACE';

function isOmDebugTraceEnabled(): boolean {
  const v = process.env[OM_DEBUG_TRACE_ENV];
  return v === '1' || v === 'true';
}

/**
 * Wrap an OM internal call with a debug-trace child span when
 * `MASTRA_OM_DEBUG_TRACE` is set. When unset, returns `fn()` directly with no
 * observability overhead.
 *
 * The span attaches to `observabilityContext.tracingContext.currentSpan` if
 * provided, otherwise falls back to the AsyncLocalStorage-resolved current
 * span. Calls inside the `fn` callback inherit this span as parent via
 * `executeInContext`, so nested instrumented OM ops nest correctly without
 * threading context through every call site.
 */
export async function withOmDebugSpan<T>(
  name: string,
  observabilityContext: ObservabilityContext | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  if (!isOmDebugTraceEnabled()) return fn();

  const parent = observabilityContext?.tracingContext?.currentSpan ?? resolveCurrentSpan();
  if (!parent) return fn();

  const span = parent.createChildSpan({
    type: SpanType.MEMORY_OPERATION,
    name,
    entityType: EntityType.MEMORY,
    entityName: 'ObservationalMemory',
    attributes: {},
  });

  if (!span) return fn();

  try {
    const result = await span.executeInContext(() => fn());
    span.end({});
    return result;
  } catch (error) {
    span.error({ error: error instanceof Error ? error : new Error(String(error)), endSpan: true });
    throw error;
  }
}
