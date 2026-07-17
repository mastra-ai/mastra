import { describe, expect, it } from 'vitest';
import { TABLE_SCORERS } from './constants';
import {
  safelyParseJSON,
  createStorageErrorId,
  createVectorErrorId,
  transformRow,
  transformScoreRow,
  parseDuration,
  ensureDate,
  serializeDate,
  filterByDateRange,
  jsonValueEquals,
  hasErrorCode,
} from './utils';

describe('hasErrorCode', () => {
  it('matches error codes through the cause chain', () => {
    const error = { cause: { cause: { code: '23505' } } };

    expect(hasErrorCode(error, new Set(['23505']))).toBe(true);
    expect(hasErrorCode(error, new Set(['other']))).toBe(false);
  });

  it('stops when the cause chain contains a cycle', () => {
    const error: { code: string; cause?: unknown } = { code: 'outer' };
    error.cause = error;

    expect(hasErrorCode(error, new Set(['missing']))).toBe(false);
  });
});

describe('safelyParseJSON', () => {
  const sampleObject = {
    foo: 'bar',
    nested: { value: 42 },
  };

  it('should return input object unchanged when provided a non-null object', () => {
    const inputObject = sampleObject;
    const result = safelyParseJSON(inputObject);
    expect(result).toBe(inputObject);
    expect(result).toEqual({
      foo: 'bar',
      nested: { value: 42 },
    });
    expect(result.nested).toBe(inputObject.nested);
  });

  it('should return empty object when provided null or undefined', () => {
    const nullResult = safelyParseJSON(null);
    expect(nullResult).toEqual({});
    const undefinedResult = safelyParseJSON(undefined);
    expect(undefinedResult).toEqual({});
    expect(nullResult).not.toBe(undefinedResult);
  });

  it('should return empty object when provided non-string primitives', () => {
    const numberResult = safelyParseJSON(42);
    expect(numberResult).toEqual({});
    const booleanResult = safelyParseJSON(true);
    expect(booleanResult).toEqual({});
    expect(numberResult).not.toBe(booleanResult);
  });

  it('should return raw string when provided a non-JSON string', () => {
    const raw = 'hello world';
    expect(safelyParseJSON(raw)).toBe(raw);
  });

  it('should still parse valid JSON strings', () => {
    const json = '{"a":1,"b":"two"}';
    expect(safelyParseJSON(json)).toEqual({ a: 1, b: 'two' });
  });

  it('parses JSON numbers/booleans/arrays', () => {
    expect(safelyParseJSON('123')).toBe(123);
    expect(safelyParseJSON('true')).toBe(true);
    expect(safelyParseJSON('[1,2]')).toEqual([1, 2]);
  });

  it('trims whitespace around JSON strings', () => {
    expect(safelyParseJSON(' { "x": 1 } ')).toEqual({ x: 1 });
  });
});

describe('transformRow', () => {
  it('should parse jsonb fields from JSON strings', () => {
    const row = {
      id: 'test-id',
      scorerId: 'scorer-1',
      runId: 'run-1',
      scorer: '{"name":"test-scorer","version":"1.0"}',
      input: '{"prompt":"hello"}',
      output: '{"response":"world"}',
      score: 0.85,
      source: 'TEST',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const result = transformRow(row, TABLE_SCORERS);

    expect(result.id).toBe('test-id');
    expect(result.scorer).toEqual({ name: 'test-scorer', version: '1.0' });
    expect(result.input).toEqual({ prompt: 'hello' });
    expect(result.output).toEqual({ response: 'world' });
    expect(result.score).toBe(0.85);
  });

  it('should pass through already-parsed objects', () => {
    const scorerObject = { name: 'test-scorer', version: '1.0' };
    const row = {
      id: 'test-id',
      scorerId: 'scorer-1',
      runId: 'run-1',
      scorer: scorerObject,
      score: 0.85,
      source: 'TEST',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const result = transformRow(row, TABLE_SCORERS);
    expect(result.scorer).toBe(scorerObject);
  });

  it('should skip null and undefined values', () => {
    const row = {
      id: 'test-id',
      scorerId: 'scorer-1',
      runId: 'run-1',
      scorer: '{}',
      score: 0.85,
      source: 'TEST',
      metadata: null,
      reason: undefined,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const result = transformRow(row, TABLE_SCORERS);
    expect(result).not.toHaveProperty('metadata');
    expect(result).not.toHaveProperty('reason');
  });

  it('should convert timestamps when convertTimestamps is true', () => {
    const row = {
      id: 'test-id',
      scorerId: 'scorer-1',
      runId: 'run-1',
      scorer: '{}',
      score: 0.85,
      source: 'TEST',
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T11:00:00Z',
    };

    const result = transformRow(row, TABLE_SCORERS, { convertTimestamps: true });
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
    expect((result.createdAt as Date).toISOString()).toBe('2024-01-15T10:30:00.000Z');
  });

  it('should use preferred timestamp fields when provided', () => {
    const row = {
      id: 'test-id',
      scorerId: 'scorer-1',
      runId: 'run-1',
      scorer: '{}',
      score: 0.85,
      source: 'TEST',
      createdAt: '2024-01-15T10:30:00Z',
      createdAtZ: '2024-01-15T10:30:00.000Z',
      updatedAt: '2024-01-15T11:00:00Z',
      updatedAtZ: '2024-01-15T11:00:00.000Z',
    };

    const result = transformRow(row, TABLE_SCORERS, {
      preferredTimestampFields: {
        createdAt: 'createdAtZ',
        updatedAt: 'updatedAtZ',
      },
    });

    expect(result.createdAt).toBe('2024-01-15T10:30:00.000Z');
    expect(result.updatedAt).toBe('2024-01-15T11:00:00.000Z');
  });
});

describe('transformScoreRow', () => {
  it('should be a convenience wrapper for transformRow with TABLE_SCORERS', () => {
    const row = {
      id: 'score-123',
      scorerId: 'accuracy-scorer',
      runId: 'run-456',
      scorer: '{"id":"accuracy","name":"Accuracy Scorer"}',
      input: '{"question":"What is 2+2?"}',
      output: '{"answer":"4"}',
      score: 1.0,
      reason: 'Correct answer',
      source: 'TEST',
      entityType: 'AGENT',
      entity: '{"name":"math-agent"}',
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T11:00:00Z',
    };

    const result = transformScoreRow(row);
    expect(result.id).toBe('score-123');
    expect(result.scorer).toEqual({ id: 'accuracy', name: 'Accuracy Scorer' });
  });
});

describe('createStorageErrorId', () => {
  it('should generate error ID with FAILED status', () => {
    const errorId = createStorageErrorId('PG', 'LIST_THREADS', 'FAILED');
    expect(errorId).toBe('MASTRA_STORAGE_PG_LIST_THREADS_FAILED');
  });

  it('should normalize operations with proper word boundaries', () => {
    const errorId = createStorageErrorId('PG', 'listMessagesById', 'FAILED');
    expect(errorId).toBe('MASTRA_STORAGE_PG_LIST_MESSAGES_BY_ID_FAILED');
  });
});

describe('createVectorErrorId', () => {
  it('should generate vector error ID with FAILED status', () => {
    const errorId = createVectorErrorId('CHROMA', 'QUERY', 'FAILED');
    expect(errorId).toBe('MASTRA_VECTOR_CHROMA_QUERY_FAILED');
  });
});

describe('parseDuration', () => {
  it('should parse number as milliseconds', () => {
    expect(parseDuration(1000)).toBe(1000);
  });

  it('should throw error for negative number', () => {
    expect(() => parseDuration(-1)).toThrow('Invalid retention duration');
  });

  it('should parse duration strings correctly', () => {
    expect(parseDuration('1ms')).toBe(1);
    expect(parseDuration('1s')).toBe(1000);
    expect(parseDuration('1m')).toBe(60 * 1000);
    expect(parseDuration('1h')).toBe(60 * 60 * 1000);
    expect(parseDuration('1d')).toBe(24 * 60 * 60 * 1000);
    expect(parseDuration('1w')).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('should parse fractional duration strings', () => {
    expect(parseDuration('1.5s')).toBe(1500);
  });
});

describe('ensureDate', () => {
  it('should return undefined for undefined input', () => {
    expect(ensureDate(undefined)).toBeUndefined();
  });

  it('should return Date object for Date input', () => {
    const date = new Date();
    expect(ensureDate(date)).toBe(date);
  });

  it('should parse string into Date object', () => {
    const dateStr = '2024-01-01T00:00:00.000Z';
    const date = ensureDate(dateStr);
    expect(date).toBeInstanceOf(Date);
    expect(date?.toISOString()).toBe(dateStr);
  });
});

describe('serializeDate', () => {
  it('should return undefined for undefined input', () => {
    expect(serializeDate(undefined)).toBeUndefined();
  });

  it('should return ISO string for Date input', () => {
    const date = new Date('2024-01-01T00:00:00.000Z');
    expect(serializeDate(date)).toBe('2024-01-01T00:00:00.000Z');
  });
});

describe('filterByDateRange', () => {
  const items = [
    { id: 1, createdAt: new Date('2024-01-01') },
    { id: 2, createdAt: new Date('2024-01-02') },
    { id: 3, createdAt: new Date('2024-01-03') },
  ];
  const getCreatedAt = (item: any) => item.createdAt;

  it('should return all items if no date range provided', () => {
    expect(filterByDateRange(items, getCreatedAt)).toEqual(items);
  });

  it('should filter by start date (inclusive)', () => {
    const result = filterByDateRange(items, getCreatedAt, { start: '2024-01-02' });
    expect(result).toHaveLength(2);
    expect(result.map((i: any) => i.id)).toEqual([2, 3]);
  });

  it('should filter by start date (exclusive)', () => {
    const result = filterByDateRange(items, getCreatedAt, { start: '2024-01-02', startExclusive: true });
    expect(result).toHaveLength(1);
    expect(result.map((i: any) => i.id)).toEqual([3]);
  });

  it('should filter by end date (inclusive)', () => {
    const result = filterByDateRange(items, getCreatedAt, { end: '2024-01-02' });
    expect(result).toHaveLength(2);
    expect(result.map((i: any) => i.id)).toEqual([1, 2]);
  });

  it('should filter by end date (exclusive)', () => {
    const result = filterByDateRange(items, getCreatedAt, { end: '2024-01-02', endExclusive: true });
    expect(result).toHaveLength(1);
    expect(result.map((i: any) => i.id)).toEqual([1]);
  });
});

describe('jsonValueEquals', () => {
  it('should handle primitives', () => {
    expect(jsonValueEquals(1, 1)).toBe(true);
    expect(jsonValueEquals(1, 2)).toBe(false);
    expect(jsonValueEquals('a', 'a')).toBe(true);
    expect(jsonValueEquals('a', 'b')).toBe(false);
    expect(jsonValueEquals(true, true)).toBe(true);
    expect(jsonValueEquals(true, false)).toBe(false);
    expect(jsonValueEquals(null, null)).toBe(true);
    expect(jsonValueEquals(undefined, undefined)).toBe(true);
    expect(jsonValueEquals(null, undefined)).toBe(false);
  });

  it('should handle Date objects', () => {
    const d1 = new Date('2024-01-01');
    const d2 = new Date('2024-01-01');
    const d3 = new Date('2024-01-02');
    expect(jsonValueEquals(d1, d2)).toBe(true);
    expect(jsonValueEquals(d1, d3)).toBe(false);
    expect(jsonValueEquals(d1, '2024-01-01')).toBe(false);
  });

  it('should handle arrays', () => {
    expect(jsonValueEquals([1, 2], [1, 2])).toBe(true);
    expect(jsonValueEquals([1, 2], [1, 3])).toBe(false);
    expect(jsonValueEquals([1, 2], [1, 2, 3])).toBe(false);
  });

  it('should handle objects', () => {
    expect(jsonValueEquals({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    expect(jsonValueEquals({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(jsonValueEquals({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false);
    expect(jsonValueEquals({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  });

  it('should handle nested structures', () => {
    const obj1 = { a: [1, { b: 2 }], c: 3 };
    const obj2 = { a: [1, { b: 2 }], c: 3 };
    const obj3 = { a: [1, { b: 3 }], c: 3 };
    expect(jsonValueEquals(obj1, obj2)).toBe(true);
    expect(jsonValueEquals(obj1, obj3)).toBe(false);
  });
});
