import { assert, describe, it, expect } from 'vitest';
import { formatHierarchicalSpans } from '../format-hierarchical-spans';

type Span = Parameters<typeof formatHierarchicalSpans>[0][number];
type FormattedSpan = ReturnType<typeof formatHierarchicalSpans>[number];

function getAt<T>(items: readonly T[], index: number): T {
  const item = items[index];
  assert(item !== undefined, `Expected item at index ${index}`);
  return item;
}

function getChildren(span: FormattedSpan): FormattedSpan[] {
  const children = span.spans;
  assert(children, `Expected ${span.id} to have child spans`);
  return children;
}

function span(spanId: string, parentSpanId: string | null, overrides: Partial<Span> = {}): Span {
  return {
    spanId,
    name: spanId,
    spanType: 'AGENT_RUN',
    startedAt: '2026-05-12T10:00:00.000Z',
    endedAt: '2026-05-12T10:00:01.000Z',
    parentSpanId,
    ...overrides,
  };
}

describe('formatHierarchicalSpans', () => {
  it('returns an empty array for empty input', () => {
    expect(formatHierarchicalSpans([])).toEqual([]);
  });

  describe('without anchorSpanId (trace mode)', () => {
    it('uses spans with parentSpanId == null as roots', () => {
      const result = formatHierarchicalSpans([span('root', null), span('child', 'root')]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('root');
      expect(result[0].spans).toHaveLength(1);
      expect(getAt(getChildren(result[0]), 0).id).toBe('child');
    });

    it('nests descendants under the correct parent across multiple levels', () => {
      const result = formatHierarchicalSpans([span('root', null), span('a', 'root'), span('b', 'a'), span('c', 'b')]);
      expect(result).toHaveLength(1);
      const a = getAt(getChildren(result[0]), 0);
      expect(a.id).toBe('a');
      const b = getAt(getChildren(a), 0);
      expect(b.id).toBe('b');
      expect(getAt(getChildren(b), 0).id).toBe('c');
    });

    it('surfaces orphans (parent not present in spans) as additional roots', () => {
      const result = formatHierarchicalSpans([span('root', null), span('orphan', 'parent-not-in-list')]);
      expect(result.map(r => r.id).sort()).toEqual(['orphan', 'root']);
    });
  });

  describe('with anchorSpanId (branch-subtree mode)', () => {
    it('treats the named span as the displayed root regardless of its parentSpanId', () => {
      // Anchor has a non-null parent that is intentionally NOT in the spans array —
      // simulates the `getBranch` response shape.
      const result = formatHierarchicalSpans(
        [span('anchor', 'parent-outside-subtree'), span('child', 'anchor')],
        'anchor',
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('anchor');
      expect(result[0].spans).toHaveLength(1);
      expect(getAt(getChildren(result[0]), 0).id).toBe('child');
    });

    it('nests descendants of the anchor under it (multi-level subtree)', () => {
      const result = formatHierarchicalSpans(
        [span('anchor', 'outside-parent'), span('a', 'anchor'), span('b', 'a'), span('c', 'a')],
        'anchor',
      );
      const anchorRoot = result[0];
      expect(anchorRoot.id).toBe('anchor');
      const a = getAt(getChildren(anchorRoot), 0);
      expect(a.id).toBe('a');
      expect(
        getChildren(a)
          .map(s => s.id)
          .sort(),
      ).toEqual(['b', 'c']);
    });

    it('does not promote a parentSpanId==null sibling to root when an anchor is specified', () => {
      // Unusual but possible: anchor is the named root of the subtree, but a span with
      // parentSpanId == null also appears (e.g. defensive payload). The anchor stays the root;
      // the unrelated null-parent span is treated as an orphan (also surfaces, but not promoted
      // ahead of the anchor).
      const result = formatHierarchicalSpans(
        [span('anchor', 'outside-parent'), span('unrelated-root', null)],
        'anchor',
      );
      expect(result.map(r => r.id).sort()).toEqual(['anchor', 'unrelated-root']);
    });
  });

  it('orders sibling spans by start time at every level of the tree', () => {
    const result = formatHierarchicalSpans([
      span('root', null, { startedAt: '2026-05-12T10:00:00.000Z' }),
      span('late-child', 'root', { startedAt: '2026-05-12T10:00:03.000Z' }),
      span('early-child', 'root', { startedAt: '2026-05-12T10:00:01.000Z' }),
      span('late-grandchild', 'early-child', { startedAt: '2026-05-12T10:00:04.000Z' }),
      span('early-grandchild', 'early-child', { startedAt: '2026-05-12T10:00:02.000Z' }),
    ]);

    const children = getChildren(getAt(result, 0));
    expect(children.map(child => child.id)).toEqual(['early-child', 'late-child']);
    expect(getChildren(getAt(children, 0)).map(grandchild => grandchild.id)).toEqual([
      'early-grandchild',
      'late-grandchild',
    ]);
  });

  it('orders the displayed roots by start time', () => {
    const result = formatHierarchicalSpans([
      span('late-root', null, { startedAt: '2026-05-12T10:00:03.000Z' }),
      span('early-root', null, { startedAt: '2026-05-12T10:00:01.000Z' }),
      span('orphan', 'parent-not-in-list', { startedAt: '2026-05-12T10:00:02.000Z' }),
    ]);

    expect(result.map(root => root.id)).toEqual(['early-root', 'orphan', 'late-root']);
  });

  it('reports each span latency as the time it actually ran', () => {
    const result = formatHierarchicalSpans([
      span('root', null, { startedAt: '2026-05-12T10:00:00.000Z', endedAt: '2026-05-12T10:00:09.000Z' }),
      span('child', 'root', { startedAt: '2026-05-12T10:00:02.000Z', endedAt: '2026-05-12T10:00:05.500Z' }),
    ]);

    expect(getAt(result, 0).latency).toBe(9000);
    expect(getAt(getChildren(getAt(result, 0)), 0).latency).toBe(3500);
  });

  it('keeps the latest endedAt when later spans end earlier or are still running', () => {
    const result = formatHierarchicalSpans([
      span('root', null, { endedAt: '2026-05-12T10:00:01.000Z' }),
      span('latest-child', 'root', { endedAt: '2026-05-12T10:00:05.000Z' }),
      span('earlier-child', 'root', { endedAt: '2026-05-12T10:00:02.000Z' }),
      span('running-child', 'root', { endedAt: null }),
    ]);

    expect(getAt(result, 0).endTime).toBe('2026-05-12T10:00:05.000Z');
  });

  it('leaves a still-running root without an end time', () => {
    const result = formatHierarchicalSpans([
      span('root', null, { endedAt: null }),
      span('child', 'root', { endedAt: '2026-05-12T10:00:05.000Z' }),
    ]);

    // The root bar must stay open-ended rather than borrow the child's end.
    expect(getAt(result, 0).endTime).toBeUndefined();
    expect(getAt(result, 0).latency).toBe(0);
  });

  it('extends the displayed root endTime to the overall latest endedAt across the spans', () => {
    // When the anchor recorded ending before a descendant, the timeline is widened so the
    // root bar covers the whole subtree.
    const result = formatHierarchicalSpans([
      span('root', null, { endedAt: '2026-05-12T10:00:01.000Z' }),
      span('late-child', 'root', { endedAt: '2026-05-12T10:00:05.000Z' }),
    ]);
    expect(result[0].endTime).toBe('2026-05-12T10:00:05.000Z');
    // Latency follows: 5s = 5000ms.
    expect(result[0].latency).toBe(5000);
  });

  it('applies the same endTime extension when an anchorSpanId is the root', () => {
    const result = formatHierarchicalSpans(
      [
        span('anchor', 'outside-parent', { endedAt: '2026-05-12T10:00:01.000Z' }),
        span('late-child', 'anchor', { endedAt: '2026-05-12T10:00:03.000Z' }),
      ],
      'anchor',
    );
    expect(result[0].id).toBe('anchor');
    expect(result[0].endTime).toBe('2026-05-12T10:00:03.000Z');
  });
});
