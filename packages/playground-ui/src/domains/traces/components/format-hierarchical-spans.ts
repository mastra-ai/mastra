import type { UISpan } from '../types';

/** Minimal span fields required for building the hierarchical timeline tree. */
type TimelineSpan = {
  spanId: string;
  name: string;
  spanType: string;
  startedAt: Date | string;
  endedAt?: Date | string | null;
  parentSpanId?: string | null;
  /** Id of the span outside Mastra (e.g. an OTel request span) that started this root. */
  externalParentSpanId?: string | null;
  matchedInPayloadOnly?: boolean;
};

export type FormatHierarchicalSpansOptions = {
  /**
   * Wraps top-level spans that share an `externalParentSpanId` (two or more) in one virtual
   * "Started outside Mastra" node. Only for views that render the tree as-is.
   */
  groupExternalRoots?: boolean;
};

/** Span type of the virtual node grouping roots started by the same span outside Mastra. */
const EXTERNAL_PARENT_SPAN_TYPE = 'external_parent';

const EXTERNAL_PARENT_ID_PREFIX = 'external:';

/** True for ids of virtual nodes, which have no span record (no details, no navigation, no URL). */
export const isVirtualSpanId = (id: string | null | undefined) => !!id?.startsWith(EXTERNAL_PARENT_ID_PREFIX);

const toTime = (value: string) => new Date(value).getTime();

/** Latest end of the span or anything below it; undefined when nothing has ended. */
const getLatestEnd = (span: UISpan): number | undefined => {
  let latest = span.endTime ? toTime(span.endTime) : undefined;
  for (const child of span.spans ?? []) {
    const childEnd = getLatestEnd(child);
    if (childEnd !== undefined && (latest === undefined || childEnd > latest)) latest = childEnd;
  }
  return latest;
};

const groupExternalRoots = (roots: UISpan[], externalParentBySpanId: Map<string, string>): UISpan[] => {
  const members = new Map<string, UISpan[]>();
  for (const root of roots) {
    const externalParentSpanId = externalParentBySpanId.get(root.id);
    if (externalParentSpanId) members.set(externalParentSpanId, [...(members.get(externalParentSpanId) ?? []), root]);
  }

  // Roots are sorted by start, so each group takes the place of its earliest root.
  return roots.flatMap(root => {
    const externalParentSpanId = externalParentBySpanId.get(root.id);
    const group = externalParentSpanId ? members.get(externalParentSpanId) : undefined;
    if (!externalParentSpanId || !group || group.length < 2) return [root];
    if (group[0] !== root) return [];

    const startTime = root.startTime;
    const ends = group.flatMap(member => (member.endTime ? [toTime(member.endTime)] : []));
    const end = ends.length > 0 ? Math.max(...ends) : undefined;
    return [
      {
        id: `${EXTERNAL_PARENT_ID_PREFIX}${externalParentSpanId}`,
        name: 'Started outside Mastra',
        type: EXTERNAL_PARENT_SPAN_TYPE,
        latency: end !== undefined ? end - toTime(startTime) : 0,
        startTime,
        endTime: end !== undefined ? new Date(end).toISOString() : undefined,
        spans: group,
        parentSpanId: null,
        externalParentSpanId,
        isVirtual: true,
      },
    ];
  });
};

/**
 * When `anchorSpanId` is provided, that span is treated as the displayed root
 * regardless of its `parentSpanId` -- the branch-subtree case from `getBranch`,
 * where the anchor has a real parent that's outside the returned set. Without
 * it, the displayed roots are the spans with no parent (the trace case).
 */
export const formatHierarchicalSpans = (
  spans: TimelineSpan[],
  anchorSpanId?: string,
  options?: FormatHierarchicalSpansOptions,
): UISpan[] => {
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

  // A root recorded as ending before one of its descendants is widened to cover its own
  // subtree, never another root's. A still-running root keeps no end time.
  for (const root of sortedRootSpans) {
    const latestEnd = getLatestEnd(root);
    if (root.endTime && latestEnd !== undefined && latestEnd > toTime(root.endTime)) {
      root.endTime = new Date(latestEnd).toISOString();
      root.latency = latestEnd - toTime(root.startTime);
    }
  }

  if (!options?.groupExternalRoots) return sortedRootSpans;

  const externalParentBySpanId = new Map<string, string>();
  for (const span of spans) {
    if (span.externalParentSpanId) externalParentBySpanId.set(span.spanId, span.externalParentSpanId);
  }
  return groupExternalRoots(sortedRootSpans, externalParentBySpanId);
};
