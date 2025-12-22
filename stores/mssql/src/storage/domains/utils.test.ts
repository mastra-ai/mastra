import { describe, it, expect } from 'vitest';
import { prepareWhereClause, buildDateRangeFilter } from './utils';

describe('prepareWhereClause', () => {
  it('should handle simple equality filter', () => {
    const result = prepareWhereClause({ name: 'test' });
    expect(result.sql).toBe(' WHERE [name] = @p1');
    expect(result.params).toEqual({ p1: 'test' });
  });

  it('should handle null values', () => {
    const result = prepareWhereClause({ name: null });
    expect(result.sql).toBe(' WHERE [name] IS NULL');
    expect(result.params).toEqual({});
  });

  it('should handle _gte operator', () => {
    const result = prepareWhereClause({ createdAt_gte: '2024-01-01' });
    expect(result.sql).toBe(' WHERE [createdAt] >= @p1');
    expect(result.params).toEqual({ p1: '2024-01-01' });
  });

  it('should handle _lte operator', () => {
    const result = prepareWhereClause({ createdAt_lte: '2024-12-31' });
    expect(result.sql).toBe(' WHERE [createdAt] <= @p1');
    expect(result.params).toEqual({ p1: '2024-12-31' });
  });

  it('should handle Date objects', () => {
    const date = new Date('2024-06-15T12:00:00Z');
    const result = prepareWhereClause({ createdAt: date });
    expect(result.sql).toBe(' WHERE [createdAt] = @p1');
    expect(result.params).toEqual({ p1: date.toISOString() });
  });

  it('should handle $in operator with multiple values', () => {
    const result = prepareWhereClause({ thread_id: { $in: ['thread1', 'thread2', 'thread3'] } });
    expect(result.sql).toBe(' WHERE [thread_id] IN (@p1, @p2, @p3)');
    expect(result.params).toEqual({ p1: 'thread1', p2: 'thread2', p3: 'thread3' });
  });

  it('should handle $in operator with single value (optimizes to equality)', () => {
    const result = prepareWhereClause({ thread_id: { $in: ['thread1'] } });
    expect(result.sql).toBe(' WHERE [thread_id] = @p1');
    expect(result.params).toEqual({ p1: 'thread1' });
  });

  it('should handle $in operator with empty array', () => {
    const result = prepareWhereClause({ thread_id: { $in: [] } });
    expect(result.sql).toBe(' WHERE 1 = 0');
    expect(result.params).toEqual({});
  });

  it('should handle array values as implicit $in', () => {
    const result = prepareWhereClause({ thread_id: ['thread1', 'thread2'] });
    expect(result.sql).toBe(' WHERE [thread_id] IN (@p1, @p2)');
    expect(result.params).toEqual({ p1: 'thread1', p2: 'thread2' });
  });

  it('should handle multiple filters including $in', () => {
    const result = prepareWhereClause({
      thread_id: { $in: ['thread1', 'thread2'] },
      resourceId: 'resource1',
    });
    expect(result.sql).toBe(' WHERE [thread_id] IN (@p1, @p2) AND [resourceId] = @p3');
    expect(result.params).toEqual({ p1: 'thread1', p2: 'thread2', p3: 'resource1' });
  });

  it('should handle $in with date range filters', () => {
    const result = prepareWhereClause({
      thread_id: { $in: ['thread1', 'thread2'] },
      createdAt_gte: '2024-01-01',
      createdAt_lte: '2024-12-31',
    });
    expect(result.sql).toBe(' WHERE [thread_id] IN (@p1, @p2) AND [createdAt] >= @p3 AND [createdAt] <= @p4');
    expect(result.params).toEqual({
      p1: 'thread1',
      p2: 'thread2',
      p3: '2024-01-01',
      p4: '2024-12-31',
    });
  });

  it('should skip undefined values', () => {
    const result = prepareWhereClause({ name: 'test', other: undefined });
    expect(result.sql).toBe(' WHERE [name] = @p1');
    expect(result.params).toEqual({ p1: 'test' });
  });

  it('should return empty sql for empty filters', () => {
    const result = prepareWhereClause({});
    expect(result.sql).toBe('');
    expect(result.params).toEqual({});
  });
});

describe('buildDateRangeFilter', () => {
  it('should build filter with start date', () => {
    const start = new Date('2024-01-01');
    const result = buildDateRangeFilter({ start }, 'createdAt');
    expect(result).toEqual({ createdAt_gte: start });
  });

  it('should build filter with end date', () => {
    const end = new Date('2024-12-31');
    const result = buildDateRangeFilter({ end }, 'createdAt');
    expect(result).toEqual({ createdAt_lte: end });
  });

  it('should build filter with both dates', () => {
    const start = new Date('2024-01-01');
    const end = new Date('2024-12-31');
    const result = buildDateRangeFilter({ start, end }, 'createdAt');
    expect(result).toEqual({ createdAt_gte: start, createdAt_lte: end });
  });

  it('should return empty object for undefined range', () => {
    const result = buildDateRangeFilter(undefined, 'createdAt');
    expect(result).toEqual({});
  });
});
