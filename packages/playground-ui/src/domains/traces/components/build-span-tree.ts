/** Minimal span fields required to place a record in the tree. */
export type TreeableSpan = {
  spanId: string;
  parentSpanId?: string | null;
  startedAt?: Date | string | null;
};

export type SpanNode<T> = {
  span: T;
  children: SpanNode<T>[];
};

const startTime = (span: TreeableSpan): number => {
  if (!span.startedAt) return 0;
  const time = span.startedAt instanceof Date ? span.startedAt.getTime() : new Date(span.startedAt).getTime();
  return Number.isNaN(time) ? 0 : time;
};

/**
 * Rebuilds the parent/child structure a trace already carries in `parentSpanId`, sorting siblings
 * chronologically at every level.
 *
 * When `anchorSpanId` is provided, that span is treated as the displayed root regardless of its
 * `parentSpanId` -- the branch-subtree case, where the anchor has a real parent outside the
 * returned set. Without it, the roots are the spans with no parent.
 *
 * Spans whose parent is absent from `spans` are surfaced at the root rather than dropped, so a
 * partial or truncated trace never loses rows.
 */
export function buildSpanTree<T extends TreeableSpan>(
  spans: T[] | null | undefined,
  anchorSpanId?: string,
): SpanNode<T>[] {
  if (!spans || spans.length === 0) return [];

  const nodes = new Map<string, SpanNode<T>>();
  for (const span of spans) {
    nodes.set(span.spanId, { span, children: [] });
  }

  const roots: SpanNode<T>[] = [];
  for (const span of spans) {
    const node = nodes.get(span.spanId);
    if (!node) continue;

    const isAnchor = anchorSpanId ? span.spanId === anchorSpanId : span.parentSpanId == null;
    const parent = !isAnchor && span.parentSpanId ? nodes.get(span.parentSpanId) : undefined;

    if (parent && parent !== node) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sort = (level: SpanNode<T>[]) => {
    level.sort((a, b) => startTime(a.span) - startTime(b.span));
    for (const node of level) sort(node.children);
  };
  sort(roots);

  return roots;
}

/** Depth-first walk in display order, i.e. a parent immediately followed by its subtree. */
export function flattenSpanTree<T>(nodes: SpanNode<T>[]): T[] {
  return nodes.flatMap(node => [node.span, ...flattenSpanTree(node.children)]);
}
