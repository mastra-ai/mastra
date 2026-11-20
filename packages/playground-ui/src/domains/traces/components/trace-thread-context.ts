import { SpanType } from '@mastra/core/observability';
import type { TracePanelSpan as TraceSpan } from '@/domains/traces/components/trace-panel/trace-panel-context';

/**
 * The thread a trace belongs to, when it can be shown as a reconstructed agent turn:
 * only for a complete `AGENT_RUN` root (never a branch anchor) that carries a thread id.
 */
export function getTraceThreadId(rootSpan: TraceSpan | undefined, anchorSpanId?: string): string | undefined {
  if (anchorSpanId || rootSpan?.spanType !== SpanType.AGENT_RUN) return undefined;
  return 'threadId' in rootSpan && typeof rootSpan.threadId === 'string' ? rootSpan.threadId : undefined;
}

/** The span the panel treats as the trace's root: the branch anchor when one is given, else the parentless span. */
export function getTraceRootSpan<Span extends TraceSpan>(
  spans: Span[] | undefined,
  anchorSpanId?: string,
): Span | undefined {
  return anchorSpanId
    ? spans?.find(span => span.spanId === anchorSpanId)
    : spans?.find(span => span.parentSpanId == null);
}
