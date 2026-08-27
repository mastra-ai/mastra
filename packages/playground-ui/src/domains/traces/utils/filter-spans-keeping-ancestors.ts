import type { LightSpanRecord } from '@mastra/core/storage';

/**
 * Filter a flat span list down to the spans matching `predicate`, plus every
 * ancestor needed to keep those spans connected to their root.
 *
 * Descendants of a matching span are not kept unless they match themselves.
 * The output preserves the input's relative order, so it can be fed straight
 * into `formatHierarchicalSpans`.
 *
 * Precondition: `spans` is ordered parent-before-child (the order the API
 * returns them). The single reverse pass relies on visiting children before
 * their parents.
 */
export function filterSpansKeepingAncestors(
  spans: LightSpanRecord[],
  predicate: (span: LightSpanRecord) => boolean,
): LightSpanRecord[] {
  if (!spans || spans.length === 0) {
    return [];
  }

  const requiredParentIds = new Set<string>();
  const kept: LightSpanRecord[] = [];

  for (let i = spans.length - 1; i >= 0; i--) {
    const span = spans[i];
    if (!span) continue;

    const isRequiredAncestor = requiredParentIds.has(span.spanId);

    if (!isRequiredAncestor && !predicate(span)) continue;

    if (span.parentSpanId) requiredParentIds.add(span.parentSpanId);
    kept.push(span);
  }

  return kept.reverse();
}
