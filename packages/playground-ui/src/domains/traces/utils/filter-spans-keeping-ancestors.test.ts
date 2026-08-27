import { SpanType } from '@mastra/core/observability';
import type { LightSpanRecord } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

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

/**
 * root
 * ├── a
 * │   └── a1
 * │       └── a1x
 * └── b
 *     └── b1
 */
const tree = [
  makeSpan('root', null),
  makeSpan('a', 'root'),
  makeSpan('a1', 'a'),
  makeSpan('a1x', 'a1'),
  makeSpan('b', 'root'),
  makeSpan('b1', 'b'),
];

describe('filterSpansKeepingAncestors', () => {
  it('returns an empty list for empty input', () => {
    expect(filterSpansKeepingAncestors([], () => true)).toEqual([]);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterSpansKeepingAncestors(tree, () => false)).toEqual([]);
  });

  it('keeps the full ancestor chain of a deep leaf, in original order', () => {
    const result = filterSpansKeepingAncestors(tree, span => span.spanId === 'a1x');
    expect(ids(result)).toEqual(['root', 'a', 'a1', 'a1x']);
  });

  it('keeps both chains when leaves in different branches match', () => {
    const result = filterSpansKeepingAncestors(tree, span => span.spanId === 'a1x' || span.spanId === 'b1');
    expect(ids(result)).toEqual(['root', 'a', 'a1', 'a1x', 'b', 'b1']);
  });

  it('drops non-matching sibling branches', () => {
    const result = filterSpansKeepingAncestors(tree, span => span.spanId === 'b1');
    expect(ids(result)).toEqual(['root', 'b', 'b1']);
  });

  it('does not keep descendants of a matching span', () => {
    const result = filterSpansKeepingAncestors(tree, span => span.spanId === 'a');
    expect(ids(result)).toEqual(['root', 'a']);
  });

  it('returns only the root when the root matches', () => {
    const result = filterSpansKeepingAncestors(tree, span => span.spanId === 'root');
    expect(ids(result)).toEqual(['root']);
  });

  it('keeps an orphan span whose parent is outside the list', () => {
    const spans = [makeSpan('orphan', 'missing-parent'), makeSpan('child', 'orphan')];
    const result = filterSpansKeepingAncestors(spans, span => span.spanId === 'child');
    expect(ids(result)).toEqual(['orphan', 'child']);
  });

  it('treats undefined parentSpanId like null', () => {
    const spans = [makeSpan('root', undefined as unknown as null), makeSpan('leaf', 'root')];
    const result = filterSpansKeepingAncestors(spans, span => span.spanId === 'leaf');
    expect(ids(result)).toEqual(['root', 'leaf']);
  });

  it('preserves input relative order when everything matches', () => {
    const result = filterSpansKeepingAncestors(tree, () => true);
    expect(ids(result)).toEqual(ids(tree));
  });
});
