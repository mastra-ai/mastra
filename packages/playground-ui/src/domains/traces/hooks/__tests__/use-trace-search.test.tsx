// @vitest-environment jsdom
import { SpanType } from '@mastra/core/observability';
import type { LightSpanRecord } from '@mastra/core/storage';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { SearchableSpan } from '../../types';
import { toSearchableSpans } from '../../utils';
import { useTraceSearch } from '../use-trace-search';

const timestamp = new Date('2026-06-10T00:00:00.000Z');

/** Spans reach the hook already enriched, exactly as the query hooks deliver them. */
function makeSpan(
  spanId: string,
  parentSpanId: string | null,
  overrides: Partial<LightSpanRecord> = {},
): SearchableSpan {
  const span: LightSpanRecord = {
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

  const [searchable] = toSearchableSpans([span]);
  if (!searchable) throw new Error('toSearchableSpans dropped the span');

  return searchable;
}

const ids = (spans: SearchableSpan[]) => spans.map(span => span.spanId);

describe('useTraceSearch', () => {
  it('returns the input array by reference when the query is empty', () => {
    const spans = [makeSpan('root', null)];
    const { result } = renderHook(() => useTraceSearch(spans));

    expect(result.current.query).toBe('');
    expect(result.current.results).toBe(spans);
  });

  it('returns an empty list for an empty input', () => {
    const { result } = renderHook(() => useTraceSearch([]));

    act(() => result.current.setQuery('anything'));

    expect(result.current.results).toEqual([]);
  });

  it('matches on name, case-insensitively', () => {
    const spans = [makeSpan('a', null, { name: 'Weather Agent' }), makeSpan('b', null, { name: 'travel agent' })];
    const { result } = renderHook(() => useTraceSearch(spans));

    act(() => result.current.setQuery('WEATHER'));

    expect(ids(result.current.results)).toEqual(['a']);
  });

  it('treats a whitespace-only query as empty', () => {
    const spans = [makeSpan('a', null, { name: 'Weather Agent' })];
    const { result } = renderHook(() => useTraceSearch(spans));

    act(() => result.current.setQuery('   '));

    expect(result.current.results).toBe(spans);
  });

  it('returns an empty list when nothing matches', () => {
    const spans = [makeSpan('a', null, { name: 'Weather Agent' })];
    const { result } = renderHook(() => useTraceSearch(spans));

    act(() => result.current.setQuery('nope'));

    expect(result.current.results).toEqual([]);
  });

  it.each([
    ['spanType', { spanType: SpanType.MODEL_GENERATION }, 'model_gen'],
    ['entityName', { entityName: 'weatherAgent' }, 'weatheragent'],
    ['inputPreview', { inputPreview: 'What is the weather in Paris?' }, 'paris'],
    ['traceId', { traceId: 'trace-xyz' }, 'trace-xyz'],
  ])('matches on %s', (_field, overrides, term) => {
    const spans = [makeSpan('a', null, overrides as Partial<LightSpanRecord>), makeSpan('b', null)];
    const { result } = renderHook(() => useTraceSearch(spans));

    act(() => result.current.setQuery(term));

    expect(ids(result.current.results)).toEqual(['a']);
  });

  it('matches on spanId', () => {
    const spans = [makeSpan('needle', null, { name: 'x' }), makeSpan('other', null, { name: 'y' })];
    const { result } = renderHook(() => useTraceSearch(spans));

    act(() => result.current.setQuery('needle'));

    expect(ids(result.current.results)).toEqual(['needle']);
  });

  it('keeps the ancestors of a matching child', () => {
    const spans = [
      makeSpan('root', null, { name: 'root run' }),
      makeSpan('mid', 'root', { name: 'middle' }),
      makeSpan('leaf', 'mid', { name: 'needle' }),
      makeSpan('other', 'root', { name: 'unrelated' }),
    ];
    const { result } = renderHook(() => useTraceSearch(spans));

    act(() => result.current.setQuery('needle'));

    expect(ids(result.current.results)).toEqual(['root', 'mid', 'leaf']);
  });

  it('keeps the subtree of a matching middle span', () => {
    const spans = [
      makeSpan('root', null, { name: 'root run' }),
      makeSpan('mid', 'root', { name: 'needle' }),
      makeSpan('leaf', 'mid', { name: 'sub call' }),
      makeSpan('other', 'root', { name: 'unrelated' }),
    ];
    const { result } = renderHook(() => useTraceSearch(spans));

    act(() => result.current.setQuery('needle'));

    expect(ids(result.current.results)).toEqual(['root', 'mid', 'leaf']);
  });

  it('keeps the ancestors and subtree of a match when the list arrives newest-first', () => {
    // The trace list API defaults to `direction: 'DESC'`, so children can
    // reach the hook before their parents.
    const spans = [
      makeSpan('leaf', 'mid', { name: 'sub call' }),
      makeSpan('other', 'root', { name: 'unrelated' }),
      makeSpan('mid', 'root', { name: 'needle' }),
      makeSpan('root', null, { name: 'root run' }),
    ];
    const { result } = renderHook(() => useTraceSearch(spans));

    act(() => result.current.setQuery('needle'));

    expect(new Set(ids(result.current.results))).toEqual(new Set(['root', 'mid', 'leaf']));
  });

  describe('the open-ended payloads no fixed field list can reach', () => {
    it('matches on a metadata value', () => {
      const spans = [makeSpan('a', null, { metadata: { city: 'Lyon' } }), makeSpan('b', null)];
      const { result } = renderHook(() => useTraceSearch(spans));

      act(() => result.current.setQuery('lyon'));

      expect(ids(result.current.results)).toEqual(['a']);
    });

    it('matches on a metadata value nested several levels deep', () => {
      const spans = [
        makeSpan('a', null, { metadata: { request: { location: { city: 'Lyon' } } } }),
        makeSpan('b', null),
      ];
      const { result } = renderHook(() => useTraceSearch(spans));

      act(() => result.current.setQuery('lyon'));

      expect(ids(result.current.results)).toEqual(['a']);
    });

    it('matches on a metadata key, so a payload shape is searchable', () => {
      const spans = [makeSpan('a', null, { metadata: { retries: 3 } }), makeSpan('b', null)];
      const { result } = renderHook(() => useTraceSearch(spans));

      act(() => result.current.setQuery('retries'));

      expect(ids(result.current.results)).toEqual(['a']);
    });

    it('matches on an error message', () => {
      const spans = [makeSpan('a', null, { error: { message: 'rate limit exceeded' } }), makeSpan('b', null)];
      const { result } = renderHook(() => useTraceSearch(spans));

      act(() => result.current.setQuery('rate limit'));

      expect(ids(result.current.results)).toEqual(['a']);
    });

    it('keeps the ancestors of a span matched only by its metadata', () => {
      const spans = [
        makeSpan('root', null, { name: 'root run' }),
        makeSpan('mid', 'root', { name: 'middle' }),
        makeSpan('leaf', 'mid', { name: 'plain', metadata: { city: 'Lyon' } }),
        makeSpan('other', 'root', { name: 'unrelated' }),
      ];
      const { result } = renderHook(() => useTraceSearch(spans));

      act(() => result.current.setQuery('lyon'));

      expect(ids(result.current.results)).toEqual(['root', 'mid', 'leaf']);
    });
  });

  describe('payloadOnlyMatchIds — the matches a name highlight cannot show', () => {
    it('is empty while the query is', () => {
      const spans = [makeSpan('a', null, { metadata: { city: 'Lyon' } })];
      const { result } = renderHook(() => useTraceSearch(spans));

      expect(result.current.payloadOnlyMatchIds.size).toBe(0);
    });

    it('holds a span matched only by its metadata', () => {
      const spans = [makeSpan('a', null, { name: 'plain', metadata: { city: 'Lyon' } }), makeSpan('b', null)];
      const { result } = renderHook(() => useTraceSearch(spans));

      act(() => result.current.setQuery('lyon'));

      expect([...result.current.payloadOnlyMatchIds]).toEqual(['a']);
    });

    it('leaves out a span whose name carries the term', () => {
      const spans = [makeSpan('a', null, { name: 'Lyon lookup', metadata: { city: 'Lyon' } })];
      const { result } = renderHook(() => useTraceSearch(spans));

      act(() => result.current.setQuery('lyon'));

      expect(result.current.payloadOnlyMatchIds.size).toBe(0);
    });

    it('leaves out ancestors kept only to hold the match', () => {
      const spans = [
        makeSpan('root', null, { name: 'root run' }),
        makeSpan('leaf', 'root', { name: 'plain', metadata: { city: 'Lyon' } }),
      ];
      const { result } = renderHook(() => useTraceSearch(spans));

      act(() => result.current.setQuery('lyon'));

      expect([...result.current.payloadOnlyMatchIds]).toEqual(['leaf']);
    });
  });

  it('exposes the immediate query value and settles isPending', () => {
    const spans = [makeSpan('a', null, { name: 'Weather Agent' }), makeSpan('b', null, { name: 'travel' })];
    const { result } = renderHook(() => useTraceSearch(spans));

    expect(result.current.isPending).toBe(false);

    act(() => result.current.setQuery('weather'));

    expect(result.current.query).toBe('weather');
    expect(result.current.isPending).toBe(false);
    expect(ids(result.current.results)).toEqual(['a']);
  });
});
