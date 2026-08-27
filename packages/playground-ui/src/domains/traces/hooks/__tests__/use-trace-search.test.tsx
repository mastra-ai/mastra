// @vitest-environment jsdom
import { SpanType } from '@mastra/core/observability';
import type { LightSpanRecord } from '@mastra/core/storage';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useTraceSearch } from '../use-trace-search';

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
