import { SpanType } from '@mastra/core/observability';
import { describe, expect, it } from 'vitest';
import { spanRecordToRow } from './helpers';
import { buildInsert, SPAN_SELECT_COLUMNS } from './sql';

const USAGE_COLUMNS = [
  'inputTokens',
  'outputTokens',
  'totalTokens',
  'reasoningTokens',
  'cachedTokens',
  'estimatedCost',
  'costUnit',
] as const;

describe('span usage columns (OBS-381)', () => {
  it('projects every usage column in SPAN_SELECT_COLUMNS', () => {
    for (const column of USAGE_COLUMNS) {
      expect(SPAN_SELECT_COLUMNS).toContain(`"${column}"`);
    }
  });

  it('inserts usage columns as plain placeholders', () => {
    const row = spanRecordToRow({
      traceId: 't1',
      spanId: 's1',
      name: 'model call',
      spanType: SpanType.MODEL_GENERATION,
      isEvent: false,
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
      endedAt: new Date('2026-01-01T00:00:01.000Z'),
      inputTokens: 120,
      outputTokens: 30,
      totalTokens: 150,
      reasoningTokens: 10,
      cachedTokens: 40,
      estimatedCost: 0.00123,
      costUnit: 'usd',
    });
    const insert = buildInsert('public', 'mastra_span_events', [row])!;
    const keys = Object.keys(row);

    for (const column of USAGE_COLUMNS) {
      const index = keys.indexOf(column);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(insert.text).toContain(`"${column}"`);
      expect(insert.text).toMatch(new RegExp(`\\$${index + 1}(?![:\\d])`));
      expect(insert.text).not.toContain(`$${index + 1}::`);
    }
    expect(insert.values[keys.indexOf('inputTokens')]).toBe(120);
    expect(insert.values[keys.indexOf('estimatedCost')]).toBe(0.00123);
    expect(insert.values[keys.indexOf('costUnit')]).toBe('usd');
  });
});

const LONE_SURROGATE = /\\ud[89ab][0-9a-f]{2}/i;

function jsonbValue(record: Record<string, unknown>): string | null {
  const insert = buildInsert('public', 'mastra_span_events', [record]);
  const index = Object.keys(record).indexOf('input');
  return insert!.values[index] as string | null;
}

describe('buildInsert jsonb encoding', () => {
  it('returns null for empty input', () => {
    expect(buildInsert('public', 'mastra_span_events', [])).toBeNull();
  });

  it('casts jsonb and text[] columns explicitly', () => {
    const insert = buildInsert('public', 'mastra_span_events', [{ traceId: 't1', input: { a: 1 }, tags: ['x'] }])!;

    expect(insert.text).toContain('$2::jsonb');
    expect(insert.text).toContain('$3::text[]');
    expect(insert.text).toContain('ON CONFLICT DO NOTHING');
    expect(insert.values[0]).toBe('t1');
    expect(insert.values[2]).toEqual(['x']);
  });

  it('encodes null and undefined jsonb values as SQL null', () => {
    expect(jsonbValue({ traceId: 't1', input: null })).toBeNull();
    expect(jsonbValue({ traceId: 't1', input: undefined })).toBeNull();
  });

  it('strips NUL characters that PostgreSQL rejects with 22P05', () => {
    const encoded = jsonbValue({ traceId: 't1', input: { text: 'before\u0000after' } })!;

    expect(encoded).not.toContain('\\u0000');
    expect(JSON.parse(encoded)).toEqual({ text: 'beforeafter' });
  });

  it('strips unpaired surrogates that PostgreSQL rejects with 22P02', () => {
    const encoded = jsonbValue({ traceId: 't1', input: { text: 'a\ud83db' } })!;

    expect(LONE_SURROGATE.test(encoded)).toBe(false);
    expect(JSON.parse(encoded)).toEqual({ text: 'ab' });
  });

  it('preserves valid Unicode and escapes', () => {
    const value = { text: 'emoji 😀 done\nline\ttab back\\slash "quoted"' };
    const encoded = jsonbValue({ traceId: 't1', input: value })!;

    expect(JSON.parse(encoded)).toEqual(value);
  });

  it('preserves a plain string as a valid JSON scalar', () => {
    expect(jsonbValue({ traceId: 't1', input: 'hello' })).toBe('"hello"');
  });
});
