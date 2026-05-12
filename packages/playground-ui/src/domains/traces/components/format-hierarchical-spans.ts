import type { UISpan } from '../types';

/** Minimal span fields required for building the hierarchical timeline tree. */
type TimelineSpan = {
  spanId: string;
  name: string;
  spanType: string;
  startedAt: Date | string;
  endedAt?: Date | string | null;
  parentSpanId?: string | null;
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

  const spanMap = new Map<string, UISpan>();
  const rootSpans: UISpan[] = [];

  spans.forEach(spanRecord => {
    const startDate = new Date(spanRecord.startedAt);
    const endDate = spanRecord.endedAt ? new Date(spanRecord.endedAt) : undefined;

    const uiSpan: UISpan = {
      id: spanRecord.spanId,
      name: spanRecord.name,
      type: spanRecord.spanType,
      latency: endDate ? endDate.getTime() - startDate.getTime() : 0,
      startTime: startDate.toISOString(),
      endTime: endDate ? endDate.toISOString() : undefined,
      spans: [],
      parentSpanId: spanRecord.parentSpanId,
    };

    spanMap.set(spanRecord.spanId, uiSpan);
  });

  const isAnchor = (spanRecord: TimelineSpan) =>
    anchorSpanId ? spanRecord.spanId === anchorSpanId : spanRecord?.parentSpanId == null;

  spans.forEach(spanRecord => {
    const uiSpan = spanMap.get(spanRecord.spanId)!;

    if (isAnchor(spanRecord)) {
      if (overallEndDate && uiSpan.endTime && overallEndDate > new Date(uiSpan.endTime)) {
        uiSpan.endTime = overallEndDate.toISOString();
        const overallEndTime = new Date(overallEndDate).getTime();
        const spanStartTime = new Date(uiSpan.startTime).getTime();
        uiSpan.latency = overallEndTime - spanStartTime;
      }
      rootSpans.push(uiSpan);
    } else {
      const parent = spanRecord.parentSpanId ? spanMap.get(spanRecord.parentSpanId) : undefined;
      if (parent) {
        parent.spans!.push(uiSpan);
      } else {
        // Orphan: either the parent isn't in the supplied set (branch subtree boundary), or
        // the span has no parent yet wasn't picked as the anchor (rare when `anchorSpanId`
        // is specified). Surface it at the displayed root rather than dropping it.
        rootSpans.push(uiSpan);
      }
    }
  });

  const sortSpansByStartTime = (spans: UISpan[]): UISpan[] => {
    return spans.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  };

  const sortedRootSpans = sortSpansByStartTime(rootSpans);

  const sortNestedSpans = (spans: UISpan[]): void => {
    spans.forEach(span => {
      if (span.spans && span.spans.length > 0) {
        span.spans = sortSpansByStartTime(span.spans);
        sortNestedSpans(span.spans);
      }
    });
  };

  sortNestedSpans(sortedRootSpans);

  return sortedRootSpans;
};
