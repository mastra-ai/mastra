import { describe, expect, it } from 'vitest';
import { getExperimentsTabCount, getItemsTabCount } from '../tab-counts';

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
          unfilteredItemsTotal: 0,
          itemsTotal: 35,
        }),
      ).toBe(35);
    });
  });

  describe('getExperimentsTabCount', () => {
    it('uses pagination total when present', () => {
      expect(
        getExperimentsTabCount({
          experimentsLength: 20,
          experimentsTotal: 35,
        }),
      ).toBe(35);
    });

    it('falls back to loaded experiments length when total is unavailable', () => {
      expect(
        getExperimentsTabCount({
          experimentsLength: 20,
          experimentsTotal: undefined,
        }),
      ).toBe(20);
    });

    it('preserves a valid zero total', () => {
      expect(
        getExperimentsTabCount({
          experimentsLength: 5,
          experimentsTotal: 0,
        }),
      ).toBe(0);
    });
  });
});
