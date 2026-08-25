import { describe, expect, it } from 'vitest';
import { buildInsert } from './sql';

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
