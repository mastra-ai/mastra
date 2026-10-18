import type { UISpan } from '../types';

/** Minimal span fields required for building the hierarchical timeline tree. */
type TimelineSpan = {
  spanId: string;
  name: string;
  spanType: string;
  startedAt: Date | string;
  endedAt?: Date | string | null;
  parentSpanId?: string | null;
  matchedInPayloadOnly?: boolean;
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
      matchedInPayloadOnly: spanRecord.matchedInPayloadOnly,
    };

    spanMap.set(spanRecord.spanId, uiSpan);
  });

  const isAnchor = (spanRecord: TimelineSpan) =>
    anchorSpanId ? spanRecord.spanId === anchorSpanId : spanRecord?.parentSpanId == null;

  spans.forEach(spanRecord => {
    const uiSpan = spanMap.get(spanRecord.spanId);
    if (!uiSpan) return;

    if (isAnchor(spanRecord)) {
      rootSpans.push(uiSpan);
    } else {
      const parent = spanRecord.parentSpanId ? spanMap.get(spanRecord.parentSpanId) : undefined;
      if (parent) {
        parent.spans ??= [];
        parent.spans.push(uiSpan);
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

  const getLatestEndTime = (span: UISpan): number =>
    (span.spans ?? []).reduce(
      (latest, child) => Math.max(latest, getLatestEndTime(child)),
      span.endTime ? new Date(span.endTime).getTime() : 0,
    );

  // A root recorded as ending before one of its descendants is widened to cover its own subtree only.
  sortedRootSpans.forEach(rootSpan => {
    if (!rootSpan.endTime) return;
    const latestEndTime = getLatestEndTime(rootSpan);
    if (latestEndTime > new Date(rootSpan.endTime).getTime()) {
      rootSpan.endTime = new Date(latestEndTime).toISOString();
      rootSpan.latency = latestEndTime - new Date(rootSpan.startTime).getTime();
    }
  });

  return sortedRootSpans;
};
