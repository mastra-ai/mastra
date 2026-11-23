import { describe, expect, it } from 'vitest';

import { sortBy, toggleSort } from './sort-by';

type Row = { id: string; name: string; count?: number; createdAt?: string };

const rows: Row[] = [
  { id: 'c', name: 'banana', count: 2, createdAt: '2024-01-02T00:00:00.000Z' },
  { id: 'a', name: 'Apple', count: 10, createdAt: '2024-01-03T00:00:00.000Z' },
  { id: 'b', name: 'cherry', count: undefined, createdAt: undefined },
  { id: 'd', name: 'apple', count: 1, createdAt: '2024-01-01T00:00:00.000Z' },
];

describe('sortBy', () => {
  describe('when sort is undefined', () => {
    it('returns the same array instance', () => {
      expect(sortBy(rows, undefined, { name: row => row.name })).toBe(rows);
    });
  });

  describe('when sorting strings ascending', () => {
    it('sorts case-insensitively and breaks ties on id', () => {
      const result = sortBy(rows, { key: 'name', direction: 'asc' }, { name: row => row.name });
      expect(result.map(row => row.id)).toEqual(['a', 'd', 'c', 'b']);
    });

    it('does not mutate the input', () => {
      sortBy(rows, { key: 'name', direction: 'asc' }, { name: row => row.name });
      expect(rows[0].id).toBe('c');
    });
  });

  describe('when sorting strings descending', () => {
    it('reverses the order including tiebreaks', () => {
      const result = sortBy(rows, { key: 'name', direction: 'desc' }, { name: row => row.name });
      expect(result.map(row => row.id)).toEqual(['b', 'c', 'd', 'a']);
    });
  });

  describe('when sorting numbers', () => {
    it('sorts numerically and puts undefined last', () => {
      const asc = sortBy(rows, { key: 'count', direction: 'asc' }, { count: row => row.count });
      expect(asc.map(row => row.id)).toEqual(['d', 'c', 'a', 'b']);

      const desc = sortBy(rows, { key: 'count', direction: 'desc' }, { count: row => row.count });
      expect(desc.map(row => row.id)).toEqual(['a', 'c', 'd', 'b']);
    });
  });

  describe('when sorting dates', () => {
    it('sorts ISO strings and Date objects chronologically with undefined last', () => {
      const asc = sortBy(
        rows,
        { key: 'createdAt', direction: 'asc' },
        {
          createdAt: row => (row.createdAt ? new Date(row.createdAt) : undefined),
        },
      );
      expect(asc.map(row => row.id)).toEqual(['d', 'c', 'a', 'b']);
    });
  });

  describe('when the sort key has no accessor', () => {
    it('returns the same array instance', () => {
      expect(sortBy(rows, { key: 'unknown', direction: 'asc' }, { name: row => row.name })).toBe(rows);
    });
  });
});

describe('toggleSort', () => {
  it('starts ascending on a new key', () => {
    expect(toggleSort(undefined, 'name')).toEqual({ key: 'name', direction: 'asc' });
    expect(toggleSort({ key: 'count', direction: 'desc' }, 'name')).toEqual({ key: 'name', direction: 'asc' });
  });

  it('flips direction on the same key', () => {
    expect(toggleSort({ key: 'name', direction: 'asc' }, 'name')).toEqual({ key: 'name', direction: 'desc' });
    expect(toggleSort({ key: 'name', direction: 'desc' }, 'name')).toEqual({ key: 'name', direction: 'asc' });
  });
});
