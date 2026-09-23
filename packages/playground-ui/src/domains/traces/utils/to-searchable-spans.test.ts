import type { LightSpanRecord } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { selectSearchableSpans, toSearchableSpans } from './to-searchable-spans';

function span(overrides: Partial<LightSpanRecord> = {}): LightSpanRecord {
  return {
    traceId: 'trace-1',
    spanId: 'span-1',
    parentSpanId: null,
    name: 'agent run',
    spanType: 'agent_run',
    isEvent: false,
    startedAt: '2026-06-10T12:00:00.000Z',
    endedAt: '2026-06-10T12:00:01.000Z',
    ...overrides,
  } as LightSpanRecord;
}

// `toSearchableSpans` maps one-to-one, so a missing entry is a bug worth
// failing on rather than an `expect` that quietly passes against `undefined`.
function enrich(record: LightSpanRecord) {
  const [enriched] = toSearchableSpans([record]);
  if (!enriched) throw new Error('toSearchableSpans dropped the span');
  return enriched;
}

describe('toSearchableSpans', () => {
  describe('what it attaches', () => {
    it('gives every span a searchText', () => {
      const result = toSearchableSpans([span({ spanId: 'a' }), span({ spanId: 'b' })]);

      expect(result).toHaveLength(2);
      expect(result[0]?.searchText).toEqual(expect.any(String));
      expect(result[1]?.searchText).toEqual(expect.any(String));
    });

    it('carries the span name into searchText', () => {
      const result = enrich(span({ name: 'weather tool' }));

      expect(result.searchText).toContain('weather tool');
    });

    it('carries the open-ended metadata payload, which no fixed field list reaches', () => {
      const result = enrich(span({ metadata: { city: 'Lyon', nested: { unit: 'celsius' } } }));

      expect(result.searchText).toContain('lyon');
      expect(result.searchText).toContain('celsius');
    });

    it('carries the open-ended error payload', () => {
      const result = enrich(span({ error: { message: 'rate limit exceeded' } }));

      expect(result.searchText).toContain('rate limit exceeded');
    });

    it('carries the field names, so a payload shape is searchable', () => {
      const result = enrich(span({ metadata: { retries: 3 } }));

      expect(result.searchText).toContain('retries');
    });
  });

  describe('the case it stores', () => {
    it('lowercases searchText so matching never has to', () => {
      const result = enrich(span({ name: 'WeatherAgent', entityName: 'CHEF-Agent' }));

      expect(result.searchText).toContain('weatheragent');
      expect(result.searchText).toContain('chef-agent');
      expect(result.searchText).toBe(result.searchText.toLowerCase());
    });
  });

  describe('what it preserves', () => {
    it('keeps every original field readable on the result', () => {
      const input = span({ spanId: 'x', name: 'llm call', entityName: 'chef' });

      const result = enrich(input);

      expect(result).toMatchObject(input);
    });

    it('keeps the input order', () => {
      const result = toSearchableSpans([span({ spanId: 'a' }), span({ spanId: 'b' }), span({ spanId: 'c' })]);

      expect(result.map(s => s.spanId)).toEqual(['a', 'b', 'c']);
    });

    it('does not mutate the input spans', () => {
      const input = [span({ spanId: 'a' })];
      const snapshot = structuredClone(input);

      toSearchableSpans(input);

      expect(input).toEqual(snapshot);
      expect(input[0]).not.toHaveProperty('searchText');
    });

    it('returns an empty array for an empty input', () => {
      expect(toSearchableSpans([])).toEqual([]);
    });
  });

  describe('when a span is already searchable', () => {
    it('recomputes rather than trusting a stale searchText', () => {
      const stale = { ...span({ name: 'renamed' }), searchText: 'outdated' } as LightSpanRecord;

      const result = enrich(stale);

      expect(result.searchText).toContain('renamed');
      expect(result.searchText).not.toBe('outdated');
    });
  });
});

describe('selectSearchableSpans', () => {
  it('enriches the spans of a query payload', () => {
    const result = selectSearchableSpans({ traceId: 'trace-1', spans: [span({ name: 'weather tool' })] });

    expect(result.spans[0]?.searchText).toContain('weather tool');
  });

  it('keeps the other fields of the payload', () => {
    const result = selectSearchableSpans({ traceId: 'trace-1', spans: [] });

    expect(result.traceId).toBe('trace-1');
  });

  it('passes null through, since a query may resolve to null', () => {
    expect(selectSearchableSpans(null)).toBeNull();
  });

  it('is a stable module-level reference, so React Query can memoize it', () => {
    // Re-importing must not produce a new function: an unstable `select` would
    // re-flatten every span on every render.
    expect(selectSearchableSpans).toBe(selectSearchableSpans);
  });
});
