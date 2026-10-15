// @vitest-environment jsdom
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

  it('extends a single root endTime to a descendant that ends after it', () => {
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

  it('extends each root only to the end of its own subtree when a trace has several roots', () => {
    const result = formatHierarchicalSpans([
      span('first-root', null, { startedAt: '2026-05-12T10:00:00.000Z', endedAt: '2026-05-12T10:00:01.000Z' }),
      span('late-child', 'first-root', { startedAt: '2026-05-12T10:00:00.500Z', endedAt: '2026-05-12T10:00:02.000Z' }),
      span('second-root', null, { startedAt: '2026-05-12T10:00:03.000Z', endedAt: '2026-05-12T10:00:09.000Z' }),
    ]);

    expect(result.map(root => [root.id, root.endTime, root.latency])).toEqual([
      ['first-root', '2026-05-12T10:00:02.000Z', 2000],
      ['second-root', '2026-05-12T10:00:09.000Z', 6000],
    ]);
  });

  describe('grouping roots started outside Mastra', () => {
    /** A one-second root starting `second` seconds into the trace. */
    const at = (spanId: string, second: number, overrides: Partial<Span> = {}) =>
      span(spanId, null, {
        startedAt: `2026-05-12T10:00:0${second}.000Z`,
        endedAt: `2026-05-12T10:00:0${second + 1}.000Z`,
        ...overrides,
      });

    const sharedParentRoots = [
      span('second-run', null, {
        startedAt: '2026-05-12T10:00:02.000Z',
        endedAt: '2026-05-12T10:00:05.000Z',
        externalParentSpanId: 'abcdef0123456789',
      }),
      span('first-run', null, {
        startedAt: '2026-05-12T10:00:00.000Z',
        endedAt: '2026-05-12T10:00:01.000Z',
        externalParentSpanId: 'abcdef0123456789',
      }),
      span('tool', 'first-run', { startedAt: '2026-05-12T10:00:00.200Z', endedAt: '2026-05-12T10:00:00.800Z' }),
    ];

    it('wraps roots that share an outside parent in one virtual node', () => {
      const result = formatHierarchicalSpans(sharedParentRoots, undefined, { groupExternalRoots: true });

      expect(result).toHaveLength(1);
      const group = getAt(result, 0);
      expect(group).toMatchObject({
        id: 'external:abcdef0123456789',
        name: 'Started outside Mastra',
        type: 'external_parent',
        isVirtual: true,
        externalParentSpanId: 'abcdef0123456789',
        startTime: '2026-05-12T10:00:00.000Z',
        endTime: '2026-05-12T10:00:05.000Z',
        latency: 5000,
      });
      expect(getChildren(group).map(root => root.id)).toEqual(['first-run', 'second-run']);
      expect(getChildren(getAt(getChildren(group), 0)).map(child => child.id)).toEqual(['tool']);
    });

    it('leaves the roots at the top level unless grouping is asked for', () => {
      const result = formatHierarchicalSpans(sharedParentRoots);

      expect(result.map(root => root.id)).toEqual(['first-run', 'second-run']);
      expect(result.some(root => root.isVirtual)).toBe(false);
    });

    it('does not wrap a single root that has an outside parent', () => {
      const result = formatHierarchicalSpans(
        [span('only-run', null, { externalParentSpanId: 'abcdef0123456789' })],
        undefined,
        {
          groupExternalRoots: true,
        },
      );

      expect(result.map(root => root.id)).toEqual(['only-run']);
    });

    it('does not merge roots whose outside parents differ', () => {
      const result = formatHierarchicalSpans(
        [at('run-a', 0, { externalParentSpanId: 'parent-a' }), at('run-b', 2, { externalParentSpanId: 'parent-b' })],
        undefined,
        { groupExternalRoots: true },
      );

      expect(result.map(root => root.id)).toEqual(['run-a', 'run-b']);
    });

    it('places the group where its earliest root starts, among the other roots', () => {
      const result = formatHierarchicalSpans(
        [
          at('grouped-late', 4, { externalParentSpanId: 'shared' }),
          at('ungrouped', 2),
          at('grouped-early', 1, { externalParentSpanId: 'shared' }),
          at('before-all', 0),
        ],
        undefined,
        { groupExternalRoots: true },
      );

      expect(result.map(root => root.id)).toEqual(['before-all', 'external:shared', 'ungrouped']);
      expect(getChildren(getAt(result, 1)).map(root => root.id)).toEqual(['grouped-early', 'grouped-late']);
    });
  });
});
