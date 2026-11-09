import { describe, expect, it } from 'vitest';
import { mergeHeadRows } from '../merge-head-rows';

type Row = { id: string; at: number; label?: string };

const getId = (row: Row) => row.id;
const desc = (a: Row, b: Row) => b.at - a.at || a.id.localeCompare(b.id);
const asc = (a: Row, b: Row) => a.at - b.at || a.id.localeCompare(b.id);

const ids = (rows: Row[]) => rows.map(row => row.id);

const list: Row[] = [
  { id: 'a', at: 30 },
  { id: 'b', at: 20 },
  { id: 'c', at: 10 },
];

describe('mergeHeadRows', () => {
  describe('when the head is empty', () => {
    it('returns the list unchanged', () => {
      expect(mergeHeadRows(list, [], { getId, compare: desc, hasNextPage: false })).toBe(list);
    });
  });

  describe('when the head only repeats rows that did not change', () => {
    it('returns the list unchanged', () => {
      const head = [{ id: 'b', at: 20 }];
      expect(mergeHeadRows(list, head, { getId, compare: desc, hasNextPage: false })).toBe(list);
    });
  });

  describe('when a loaded row was updated without changing its sort value', () => {
    it('replaces it in place with the head version', () => {
      const merged = mergeHeadRows(list, [{ id: 'b', at: 20, label: 'updated' }], {
        getId,
        compare: desc,
        hasNextPage: false,
      });
      expect(ids(merged)).toEqual(['a', 'b', 'c']);
      expect(merged[1]).toEqual({ id: 'b', at: 20, label: 'updated' });
    });
  });

  describe('when a loaded row changed its sort value', () => {
    it('moves it to its new position', () => {
      const merged = mergeHeadRows(list, [{ id: 'c', at: 40 }], { getId, compare: desc, hasNextPage: false });
      expect(ids(merged)).toEqual(['c', 'a', 'b']);
    });
  });

  describe('when a new row sorts inside the loaded range', () => {
    it('inserts it at its sorted position (descending)', () => {
      const merged = mergeHeadRows(list, [{ id: 'new', at: 25 }], { getId, compare: desc, hasNextPage: true });
      expect(ids(merged)).toEqual(['a', 'new', 'b', 'c']);
    });

    it('inserts it at its sorted position (ascending)', () => {
      const ascList = [...list].reverse();
      const merged = mergeHeadRows(ascList, [{ id: 'new', at: 15 }], { getId, compare: asc, hasNextPage: true });
      expect(ids(merged)).toEqual(['c', 'new', 'b', 'a']);
    });

    it('inserts it at the top when it sorts first', () => {
      const merged = mergeHeadRows(list, [{ id: 'new', at: 99 }], { getId, compare: desc, hasNextPage: true });
      expect(ids(merged)).toEqual(['new', 'a', 'b', 'c']);
    });
  });

  describe('when a new row sorts past the last loaded row', () => {
    it('skips it while more pages can still bring it', () => {
      const merged = mergeHeadRows(list, [{ id: 'old', at: 5 }], { getId, compare: desc, hasNextPage: true });
      expect(merged).toBe(list);
    });

    it('appends it when the list is fully loaded', () => {
      const merged = mergeHeadRows(list, [{ id: 'old', at: 5 }], { getId, compare: desc, hasNextPage: false });
      expect(ids(merged)).toEqual(['a', 'b', 'c', 'old']);
    });

    it('appends newer rows at the end of an ascending list once fully loaded', () => {
      const ascList = [...list].reverse();
      const merged = mergeHeadRows(ascList, [{ id: 'new', at: 99 }], { getId, compare: asc, hasNextPage: false });
      expect(ids(merged)).toEqual(['c', 'b', 'a', 'new']);
    });
  });

  describe('when the list is empty', () => {
    it('shows every head row in sorted order', () => {
      const merged = mergeHeadRows(
        [],
        [
          { id: 'x', at: 1 },
          { id: 'y', at: 2 },
        ],
        {
          getId,
          compare: desc,
          hasNextPage: false,
        },
      );
      expect(ids(merged)).toEqual(['y', 'x']);
    });
  });

  describe('when rows tie on sort value', () => {
    it('breaks ties with the comparator', () => {
      const merged = mergeHeadRows(list, [{ id: 'aa', at: 30 }], { getId, compare: desc, hasNextPage: true });
      expect(ids(merged)).toEqual(['a', 'aa', 'b', 'c']);
    });
  });
});
