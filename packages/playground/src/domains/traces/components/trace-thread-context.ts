import { SpanType } from '@mastra/core/observability';
import type { TraceDataPanelView } from '@mastra/playground-ui/domains/traces/components/trace-data-panel-view';
import type { ComponentProps } from 'react';

type TraceSpan = NonNullable<ComponentProps<typeof TraceDataPanelView>['spans']>[number];

/**
 * The thread a trace belongs to, when it can be shown as a reconstructed agent turn:
 * only for a complete `AGENT_RUN` root (never a branch anchor) that carries a thread id.
 */
export function getTraceThreadId(rootSpan: TraceSpan | undefined, anchorSpanId?: string): string | undefined {
  if (anchorSpanId || rootSpan?.spanType !== SpanType.AGENT_RUN) return undefined;
  return 'threadId' in rootSpan && typeof rootSpan.threadId === 'string' ? rootSpan.threadId : undefined;
}
