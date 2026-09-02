import { SpanType } from '../../observability';
import type { ObservabilityContext } from '../../observability';
import { noopObserve } from '../types';
import type { ToolObserve } from '../types';

/**
 * Builds a real {@link ToolObserve} from the tool's observability context so
 * that `observe.span()` creates trace-correlated child spans and `observe.log()`
 * emits trace-correlated structured logs.
 *
 * The `observe` helper is a thin façade over the same span that backs the
 * context's `tracing` / `loggerVNext` surfaces:
 * - `span(name, fn)` opens a {@link SpanType.GENERIC} child under the current
 *   span, runs `fn`, then ends the child with its output (or records the error).
 * - `log(level, message, data)` forwards to the span-derived `loggerVNext`, so
 *   entries are correlated to the active trace.
 *
 * When no span is active (observability disabled, or no tracing context on this
 * path) the derived logger/span are already no-ops, so we return the shared
 * {@link noopObserve} and callers still never need to null-check `observe`.
 */
export function deriveToolObserve(observabilityContext: ObservabilityContext): ToolObserve {
  const parentSpan = observabilityContext.tracingContext?.currentSpan;

  // No active span → nothing to correlate to. Return the shared no-op so
  // `observe.span` still runs the function and `observe.log` stays inert.
  if (!parentSpan) {
    return noopObserve;
  }

  const logger = observabilityContext.loggerVNext;

  return {
    async span<T>(name: string, fn: () => Promise<T> | T, attributes?: Record<string, unknown>): Promise<T> {
      // Arbitrary user data belongs in `metadata` (Record<string, any>); the
      // typed `attributes` slot is reserved for span-type-specific fields.
      const childSpan = parentSpan.createChildSpan({
        type: SpanType.GENERIC,
        name,
        metadata: attributes,
      });

      try {
        const result = await childSpan.executeInContext(async () => fn());
        childSpan.end({ output: result });
        return result;
      } catch (error) {
        childSpan.error({ error: error as Error });
        throw error;
      }
    },
    log(level, message, data) {
      logger[level](message, data);
    },
  };
}
