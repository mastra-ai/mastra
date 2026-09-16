import type { MastraUnion } from "@mastra/core/tools";
import { SpanType, type TracingContext } from "@mastra/core/observability";

/**
 * Mastra deliberately does not create a span when application code invokes a
 * registered tool's execute function directly.  The operational workflow does
 * that for its deterministic ports, so instrument the actual boundary here
 * instead of mistaking model-provider spans for commerce/support health.
 */
export async function traceOperationalPort<T>(input: {
  mastra?: MastraUnion;
  tracingContext?: TracingContext;
  /** Durable owner trace for work performed by a background worker. */
  traceId?: string;
  kind: "provider" | "tool";
  operation: string;
  run: () => Promise<T>;
}): Promise<T> {
  const observability = input.mastra?.observability.getSelectedInstance({});
  const options = {
    name: input.operation,
    type: SpanType.TOOL_CALL,
    attributes: { toolType: input.kind, success: false },
    // This deliberately carries no customer/provider payload. It is a stable,
    // low-cardinality label for the dashboard and alert aggregation.
    metadata: { operationalKind: input.kind, operation: input.operation },
  } as const;
  const span = input.tracingContext?.currentSpan
    ? input.tracingContext.currentSpan.createChildSpan(options)
    : observability?.startSpan({
        ...options,
        // A worker must never inherit an unrelated caller's current span.
        ...(input.traceId ? { traceId: input.traceId } : {}),
      });
  try {
    const result = await input.run();
    span?.end({ attributes: { success: true }, output: { completed: true } });
    return result;
  } catch (error) {
    span?.error({
      error: error instanceof Error ? error : new Error(String(error)),
      endSpan: true,
    });
    throw error;
  }
}
