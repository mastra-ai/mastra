import type { UISpan } from '../types';
import { buildSpanTree, type SpanNode } from './build-span-tree';

/** Minimal span fields required for building the hierarchical timeline tree. */
type TimelineSpan = {
  spanId: string;
  name: string;
  spanType: string;
  startedAt: Date | string;
  endedAt?: Date | string | null;
  parentSpanId?: string | null;
};

const toUISpan = (node: SpanNode<TimelineSpan>): UISpan => {
  const { span } = node;
  const startDate = new Date(span.startedAt);
  const endDate = span.endedAt ? new Date(span.endedAt) : undefined;

  return {
    id: span.spanId,
    name: span.name,
    type: span.spanType,
    latency: endDate ? endDate.getTime() - startDate.getTime() : 0,
    startTime: startDate.toISOString(),
    endTime: endDate ? endDate.toISOString() : undefined,
    spans: node.children.map(toUISpan),
    parentSpanId: span.parentSpanId,
  };
};

/**
 * When `anchorSpanId` is provided, that span is treated as the displayed root
 * regardless of its `parentSpanId` -- the branch-subtree case from `getBranch`,
 * where the anchor has a real parent that's outside the returned set. Without
 * it, the displayed roots are the spans with no parent (the trace case).
 */
export const formatHierarchicalSpans = (spans: TimelineSpan[], anchorSpanId?: string): UISpan[] => {
  if (!spans || spans.length === 0) {
    return [];
  }

  const overallEndDate = spans.reduce(
    (latest, span) => {
      const endDate = span?.endedAt ? new Date(span.endedAt) : undefined;
      return endDate && (!latest || endDate > latest) ? endDate : latest;
    },
    null as Date | null,
  );

  const roots = buildSpanTree(spans, anchorSpanId).map(toUISpan);

  // A root's own `endedAt` can predate spans that outlived it; stretch it so the timeline bar spans
  // the whole trace.
  for (const root of roots) {
    if (overallEndDate && root.endTime && overallEndDate > new Date(root.endTime)) {
      root.endTime = overallEndDate.toISOString();
      root.latency = overallEndDate.getTime() - new Date(root.startTime).getTime();
    }
  }

  return roots;
};
