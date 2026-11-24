import type { LightSpanRecord } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { toSearchableSpans } from './to-searchable-spans';

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
