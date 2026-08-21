import { TABLE_MESSAGES, TABLE_THREADS } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import { parseJsonColumn, parseTimestamp, serializeColumn, serializeRow } from './rows';

describe('serializeColumn', () => {
  const label = 't.c';

  it('stores a timestamp as ISO text so ordering matches chronology', () => {
    const value = serializeColumn(new Date('2020-01-02T03:04:05.678Z'), { type: 'timestamp' }, label);
    expect(value).toBe('2020-01-02T03:04:05.678Z');
  });

  it('accepts a timestamp given as a string or epoch number', () => {
    expect(serializeColumn('2020-01-02T03:04:05.678Z', { type: 'timestamp' }, label)).toBe(
      '2020-01-02T03:04:05.678Z',
    );
    expect(serializeColumn(1577934245678, { type: 'timestamp' }, label)).toBe('2020-01-02T03:04:05.678Z');
  });

  it('rejects an invalid date rather than storing garbage', () => {
    expect(() => serializeColumn('not a date', { type: 'timestamp' }, label)).toThrow(/invalid date/);
  });

  it('serializes jsonb objects and passes through pre-serialized text', () => {
    expect(serializeColumn({ a: 1 }, { type: 'jsonb' }, label)).toBe('{"a":1}');
    expect(serializeColumn('{"a":1}', { type: 'jsonb' }, label)).toBe('{"a":1}');
  });

  it('stores booleans as integers, which SQLite has no native type for', () => {
    expect(serializeColumn(true, { type: 'boolean' }, label)).toBe(1);
    expect(serializeColumn(false, { type: 'boolean' }, label)).toBe(0);
  });

  it('preserves bigint precision on integer columns', () => {
    expect(serializeColumn(9007199254740993n, { type: 'bigint' }, label)).toBe(9007199254740993n);
  });

  it('rejects a non-finite number instead of writing NULL', () => {
    expect(() => serializeColumn(Number.NaN, { type: 'integer' }, label)).toThrow(/non-finite/);
  });

  it('maps null and undefined to NULL', () => {
    expect(serializeColumn(null, { type: 'text' }, label)).toBeNull();
    expect(serializeColumn(undefined, { type: 'text' }, label)).toBeNull();
  });

  it('JSON-encodes an object landing on a text column', () => {
    // "[object Object]" would be unrecoverable.
    expect(serializeColumn({ a: 1 }, { type: 'text' }, label)).toBe('{"a":1}');
  });
});

describe('serializeRow', () => {
  it('applies each column type from the table schema', () => {
    const row = serializeRow(TABLE_THREADS, {
      id: 't1',
      resourceId: 'r1',
      title: 'Hello',
      metadata: { a: 1 },
      createdAt: new Date('2020-01-02T03:04:05.678Z'),
      updatedAt: new Date('2020-01-02T03:04:05.678Z'),
    });

    expect(row).toEqual({
      id: 't1',
      resourceId: 'r1',
      title: 'Hello',
      metadata: '{"a":1}',
      createdAt: '2020-01-02T03:04:05.678Z',
      updatedAt: '2020-01-02T03:04:05.678Z',
    });
  });

  it('drops fields the schema does not declare', () => {
    const row = serializeRow(TABLE_THREADS, { id: 't1', notAColumn: 'x' });

    expect(row).toEqual({ id: 't1' });
  });

  it('omits undefined fields so they are not written', () => {
    const row = serializeRow(TABLE_THREADS, { id: 't1', title: undefined });

    expect(row).toEqual({ id: 't1' });
    expect('title' in row).toBe(false);
  });

  it('keeps an explicit null, which clears a column', () => {
    const row = serializeRow(TABLE_MESSAGES, { id: 'm1', resourceId: null });

    expect(row).toMatchObject({ resourceId: null });
  });
});

describe('parseJsonColumn', () => {
  it('parses stored JSON', () => {
    expect(parseJsonColumn('{"a":1}', {})).toEqual({ a: 1 });
  });

  it('falls back instead of throwing on malformed JSON', () => {
    // One bad row must not fail an entire list query.
    expect(parseJsonColumn('{not json', { fallback: true })).toEqual({ fallback: true });
  });

  it('falls back for null and undefined', () => {
    expect(parseJsonColumn(null, {})).toEqual({});
    expect(parseJsonColumn(undefined, {})).toEqual({});
  });

  it('passes through an already-parsed value', () => {
    expect(parseJsonColumn({ a: 1 }, {})).toEqual({ a: 1 });
  });
});

describe('parseTimestamp', () => {
  it('parses ISO text', () => {
    expect(parseTimestamp('2020-01-02T03:04:05.678Z')).toEqual(new Date('2020-01-02T03:04:05.678Z'));
  });

  it('parses an epoch number, so older rows still read back', () => {
    expect(parseTimestamp(1577934245678)).toEqual(new Date('2020-01-02T03:04:05.678Z'));
  });

  it('returns undefined for null, undefined, or an unparseable value', () => {
    expect(parseTimestamp(null)).toBeUndefined();
    expect(parseTimestamp(undefined)).toBeUndefined();
    expect(parseTimestamp('nonsense')).toBeUndefined();
  });
});
