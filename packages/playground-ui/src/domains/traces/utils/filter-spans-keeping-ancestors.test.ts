import { SpanType } from '@mastra/core/observability';
import type { LightSpanRecord } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { filterSpansKeepingAncestors } from './filter-spans-keeping-ancestors';

const timestamp = new Date('2026-06-10T00:00:00.000Z');

function makeSpan(
  spanId: string,
  parentSpanId: string | null,
  overrides: Partial<LightSpanRecord> = {},
): LightSpanRecord {
  return {
    traceId: 'trace-1',
    spanId,
    parentSpanId,
    name: spanId,
    spanType: SpanType.AGENT_RUN,
    isEvent: false,
    startedAt: timestamp,
    endedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

const ids = (spans: LightSpanRecord[]) => spans.map(span => span.spanId);

/** Match by span id, the shorthand every matrix case uses. */
const matching =
  (...wanted: string[]) =>
  (span: LightSpanRecord) =>
    wanted.includes(span.spanId);

describe('filterSpansKeepingAncestors', () => {
  it('returns an empty list for empty input', () => {
    expect(filterSpansKeepingAncestors([], () => true)).toEqual([]);
  });

  it('treats undefined parentSpanId like null', () => {
    const spans = [makeSpan('root', undefined as unknown as null), makeSpan('leaf', 'root')];
    const result = filterSpansKeepingAncestors(spans, span => span.spanId === 'leaf');
    expect(ids(result)).toEqual(['root', 'leaf']);
  });
});

/**
 * Fixture A — the general case. 4 levels, 3 branches, uneven depth, so that
 * "leaf", "middle" and "root" are all genuinely distinct positions.
 *
 * root
 * ├── a          (middle)
 * │   ├── a1     (middle)
 * │   │   ├── a1x (leaf)
 * │   │   └── a1y (leaf)
 * │   └── a2     (leaf)
 * ├── b          (middle)
 * │   └── b1     (middle)
 * │       └── b1x (leaf)
 * └── c          (leaf, directly under root)
 */
const deepTree = [
  makeSpan('root', null),
  makeSpan('a', 'root'),
  makeSpan('a1', 'a'),
  makeSpan('a1x', 'a1'),
  makeSpan('a1y', 'a1'),
  makeSpan('a2', 'a'),
  makeSpan('b', 'root'),
  makeSpan('b1', 'b'),
  makeSpan('b1x', 'b1'),
  makeSpan('c', 'root'),
];

const allDeepTreeIds = ids(deepTree);

/** Reorders a span list by id, so orderings can be declared explicitly. */
function orderBy(spans: LightSpanRecord[], order: string[]): LightSpanRecord[] {
  return order.map(id => {
    const span = spans.find(candidate => candidate.spanId === id);
    if (!span) throw new Error(`orderBy: unknown span id "${id}"`);
    return span;
  });
}

/** The expected output in a given input order: the input, filtered. */
function expectedIn(inputOrder: LightSpanRecord[], expectedIds: string[]): string[] {
  return ids(inputOrder).filter(id => expectedIds.includes(id));
}

type MatchCase = {
  label: string;
  match: string[];
  expected: string[];
};

/**
 * Axis 1 — where the match sits in the tree.
 * The contract: a match keeps its full ancestor chain AND its entire subtree.
 */
const matchCases: MatchCase[] = [
  { label: 'a single leaf', match: ['a1x'], expected: ['root', 'a', 'a1', 'a1x'] },
  { label: 'several leafs under the same parent', match: ['a1x', 'a1y'], expected: ['root', 'a', 'a1', 'a1x', 'a1y'] },
  {
    label: 'several leafs in different branches',
    match: ['a1x', 'b1x'],
    expected: ['root', 'a', 'a1', 'a1x', 'b', 'b1', 'b1x'],
  },
  { label: 'a leaf directly under the root', match: ['c'], expected: ['root', 'c'] },
  { label: 'every leaf of the tree', match: ['a1x', 'a1y', 'a2', 'b1x', 'c'], expected: allDeepTreeIds },
  { label: 'a single middle span', match: ['a1'], expected: ['root', 'a', 'a1', 'a1x', 'a1y'] },
  {
    label: 'two nested middle spans in the same branch',
    match: ['a', 'a1'],
    expected: ['root', 'a', 'a1', 'a1x', 'a1y', 'a2'],
  },
  {
    label: 'two middle spans in different branches',
    match: ['a1', 'b1'],
    expected: ['root', 'a', 'a1', 'a1x', 'a1y', 'b', 'b1', 'b1x'],
  },
  {
    label: 'a middle span plus an unrelated leaf',
    match: ['a1', 'c'],
    expected: ['root', 'a', 'a1', 'a1x', 'a1y', 'c'],
  },
  { label: 'a middle span whose subtree runs deeper', match: ['b'], expected: ['root', 'b', 'b1', 'b1x'] },
  { label: 'the top parent', match: ['root'], expected: allDeepTreeIds },
  { label: 'the top parent and one of its descendants', match: ['root', 'a1x'], expected: allDeepTreeIds },
  {
    label: 'an ancestor and a non-adjacent descendant',
    match: ['a', 'a1x'],
    expected: ['root', 'a', 'a1', 'a1x', 'a1y', 'a2'],
  },
  { label: 'every span', match: allDeepTreeIds, expected: allDeepTreeIds },
  { label: 'nothing', match: [], expected: [] },
  { label: 'a leaf whose sibling subtree must be excluded', match: ['a2'], expected: ['root', 'a', 'a2'] },
];

/**
 * Axis 3 — input order. This is the axis the previous suite never varied, and
 * the one that reproduces the production bug: the API defaults to
 * `direction: 'DESC'`, so children routinely arrive before their parents.
 */
const orderings: { label: string; order: string[] }[] = [
  { label: 'parent-before-child (ASC)', order: allDeepTreeIds },
  { label: 'reversed (DESC, the API default)', order: [...allDeepTreeIds].reverse() },
  {
    label: 'shuffled',
    order: ['b1x', 'root', 'a1y', 'c', 'a', 'b1', 'a1x', 'b', 'a2', 'a1'],
  },
  {
    label: 'children before parents, siblings ASC',
    order: ['a1x', 'a1y', 'b1x', 'a1', 'a2', 'b1', 'a', 'b', 'c', 'root'],
  },
];

describe.each(orderings)('filterSpansKeepingAncestors — input ordered $label', ({ order }) => {
  const input = orderBy(deepTree, order);

  it.each(matchCases)('keeps the ancestors and subtree of $label', ({ match, expected }) => {
    const result = filterSpansKeepingAncestors(input, matching(...match));
    expect(ids(result)).toEqual(expectedIn(input, expected));
  });
});

describe('filterSpansKeepingAncestors — tree shapes', () => {
  it('returns a lone root span when it matches', () => {
    const spans = [makeSpan('only', null)];
    expect(ids(filterSpansKeepingAncestors(spans, matching('only')))).toEqual(['only']);
  });

  it('returns only the matches when no span has a parent', () => {
    const spans = [makeSpan('one', null), makeSpan('two', null), makeSpan('three', null)];
    expect(ids(filterSpansKeepingAncestors(spans, matching('two')))).toEqual(['two']);
  });

  it('keeps only the branch of the matching root when the list holds several roots', () => {
    const spans = [
      makeSpan('root-1', null),
      makeSpan('child-1', 'root-1'),
      makeSpan('root-2', null),
      makeSpan('child-2', 'root-2'),
    ];

    expect(ids(filterSpansKeepingAncestors(spans, matching('child-2')))).toEqual(['root-2', 'child-2']);
  });

  it('stops cleanly when a match ancestor chain leaves the list halfway', () => {
    const spans = [makeSpan('detached', 'not-in-list'), makeSpan('leaf', 'detached')];

    expect(ids(filterSpansKeepingAncestors(spans, matching('leaf')))).toEqual(['detached', 'leaf']);
  });

  it('terminates on a two-span parent cycle', () => {
    const spans = [makeSpan('x', 'y'), makeSpan('y', 'x')];

    expect(new Set(ids(filterSpansKeepingAncestors(spans, matching('x'))))).toEqual(new Set(['x', 'y']));
  });

  it('terminates on a self-parented span', () => {
    const spans = [makeSpan('loop', 'loop')];

    expect(ids(filterSpansKeepingAncestors(spans, matching('loop')))).toEqual(['loop']);
  });
});

describe('filterSpansKeepingAncestors — contract guarantees', () => {
  it('calls the predicate exactly once per span', () => {
    const predicate = vi.fn(() => false);

    filterSpansKeepingAncestors(deepTree, predicate);

    expect(predicate).toHaveBeenCalledTimes(deepTree.length);
  });

  it('does not mutate the input array', () => {
    const input = [...deepTree];
    const snapshot = [...deepTree];

    filterSpansKeepingAncestors(input, matching('a1'));

    expect(input).toEqual(snapshot);
  });

  it('returns the original span objects, not copies', () => {
    const result = filterSpansKeepingAncestors(deepTree, matching('a1x'));

    for (const span of result) {
      expect(deepTree).toContain(span);
    }
  });

  it('skips nullish entries instead of throwing', () => {
    const spans = [makeSpan('root', null), null as unknown as LightSpanRecord, makeSpan('leaf', 'root')];

    expect(ids(filterSpansKeepingAncestors(spans, span => span.spanId === 'leaf'))).toEqual(['root', 'leaf']);
  });
});
