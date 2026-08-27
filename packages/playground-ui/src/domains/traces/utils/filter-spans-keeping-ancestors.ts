import type { LightSpanRecord } from '@mastra/core/storage';

/**
 * Filter a flat span list down to the spans matching `predicate`, plus every
 * ancestor needed to keep those spans connected to their root, plus the whole
 * subtree below each match — a matching span is shown intact, not truncated.
 *
 * The output preserves the input's relative order, so it can be fed straight
 * into `formatHierarchicalSpans`.
 *
 * Precondition: `spans` is ordered parent-before-child (the order the API
 * returns them). Both passes depend on it: the forward pass inherits matches
 * downwards and needs parents first, the reverse pass propagates ancestors
 * upwards and needs children first.
 */
export function filterSpansKeepingAncestors(
  spans: LightSpanRecord[],
  predicate: (span: LightSpanRecord) => boolean,
): LightSpanRecord[] {
  if (!spans || spans.length === 0) {
    return [];
  }

  // Forward pass: mark matches, and let them inherit down to their descendants.
  const inMatchedSubtree = new Set<string>();

  for (const span of spans) {
    if (!span) continue;

    if (predicate(span) || (span.parentSpanId && inMatchedSubtree.has(span.parentSpanId))) {
      inMatchedSubtree.add(span.spanId);
    }
  }

  // Reverse pass: keep the marked spans and pull in the ancestors they need.
  const requiredParentIds = new Set<string>();
  const kept: LightSpanRecord[] = [];

  for (let i = spans.length - 1; i >= 0; i--) {
    const span = spans[i];
    if (!span) continue;

    if (!inMatchedSubtree.has(span.spanId) && !requiredParentIds.has(span.spanId)) continue;

    if (span.parentSpanId) requiredParentIds.add(span.parentSpanId);
    kept.push(span);
  }

  return kept.reverse();
}
