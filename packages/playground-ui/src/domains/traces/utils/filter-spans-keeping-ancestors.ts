import type { LightSpanRecord } from '@mastra/core/storage';

/**
 * Filter a flat span list down to the spans matching `predicate`, plus every
 * ancestor needed to keep those spans connected to their root, plus the whole
 * subtree below each match — a matching span is shown intact, not truncated.
 *
 * `spans` may arrive in any order. Trace payloads are flat lists sorted by
 * `startedAt` (and the list API defaults to `direction: 'DESC'`), so children
 * routinely precede their parents; the traversal below indexes the list up
 * front rather than assuming a topological order.
 *
 * The output preserves the input's relative order, so it can be fed straight
 * into `formatHierarchicalSpans`. `predicate` is called exactly once per span.
 *
 * Generic over the span type: only `spanId` and `parentSpanId` are read, and the
 * exact input type comes back out, so enriched spans such as `SearchableSpan`
 * survive the filter instead of being widened to `LightSpanRecord`.
 */
export function filterSpansKeepingAncestors<T extends Pick<LightSpanRecord, 'spanId' | 'parentSpanId'>>(
  spans: T[],
  predicate: (span: T) => boolean,
): T[] {
  if (!spans || spans.length === 0) {
    return [];
  }

  const byId = new Map<string, T>();
  const childrenByParent = new Map<string, T[]>();
  const matches: T[] = [];

  for (const span of spans) {
    if (!span) continue;

    byId.set(span.spanId, span);

    if (span.parentSpanId) {
      const siblings = childrenByParent.get(span.parentSpanId);
      if (siblings) siblings.push(span);
      else childrenByParent.set(span.parentSpanId, [span]);
    }

    if (predicate(span)) matches.push(span);
  }

  if (matches.length === 0) {
    return [];
  }

  const kept = new Set<string>();

  // Downwards: every descendant of every match. `kept` doubles as the visited
  // set, so cycles and self-parented spans terminate.
  const stack = [...matches];
  while (stack.length > 0) {
    const span = stack.pop();
    if (!span || kept.has(span.spanId)) continue;

    kept.add(span.spanId);

    const children = childrenByParent.get(span.spanId);
    if (children) stack.push(...children);
  }

  // Upwards: the ancestor chain of every match, stopping at the first span
  // already kept or at a parent that isn't in the list (branch boundary).
  for (const match of matches) {
    let parentSpanId = match.parentSpanId;

    while (parentSpanId && !kept.has(parentSpanId)) {
      const parent = byId.get(parentSpanId);
      if (!parent) break;

      kept.add(parent.spanId);
      parentSpanId = parent.parentSpanId;
    }
  }

  return spans.filter(span => span && kept.has(span.spanId));
}
