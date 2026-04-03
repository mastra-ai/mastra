import { describe, expect, it } from 'vitest';
import { getItemsTabCount } from '../tab-counts';

describe('dataset tab counts', () => {
  describe('getItemsTabCount', () => {
    it('returns filtered row count while search is active', () => {
      expect(
        getItemsTabCount({
          hasSearchQuery: true,
          filteredItemsLength: 7,
          unfilteredItemsTotal: 150,
          itemsTotal: 150,
        }),
      ).toBe(7);
    });

    it('returns unfiltered total when no search query is active', () => {
      expect(
        getItemsTabCount({
          hasSearchQuery: false,
          filteredItemsLength: 20,
          unfilteredItemsTotal: 150,
          itemsTotal: 150,
        }),
      ).toBe(150);
    });

    it('falls back to items total when unfiltered total is not yet available', () => {
      expect(
        getItemsTabCount({
          hasSearchQuery: false,
          filteredItemsLength: 20,
          unfilteredItemsTotal: undefined,
          itemsTotal: 35,
        }),
      ).toBe(35);
    });

    it('falls back to filtered row count when both totals are unavailable', () => {
      expect(
        getItemsTabCount({
          hasSearchQuery: false,
          filteredItemsLength: 12,
          unfilteredItemsTotal: undefined,
          itemsTotal: undefined,
        }),
      ).toBe(12);
    });

    it('preserves a valid zero total', () => {
      expect(
        getItemsTabCount({
          hasSearchQuery: false,
          filteredItemsLength: 20,
          unfilteredItemsTotal: 0,
          itemsTotal: 0,
        }),
      ).toBe(0);
    });
  });
});
