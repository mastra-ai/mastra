import type { DatasetRecord } from '@mastra/client-js';
import { describe, expect, it } from 'vitest';

import {
  DATASET_EXPERIMENT_OPTIONS,
  DATASET_TARGET_OPTIONS,
  getDatasetTagOptions,
  getDatasetTargetTypes,
  matchesDatasetTargetFilter,
} from '../helpers';

const dataset = (overrides: Partial<DatasetRecord> = {}): DatasetRecord => ({
  id: 'dataset-1',
  name: 'Support questions',
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('matchesDatasetTargetFilter', () => {
  describe("when the filter is 'all'", () => {
    it('matches a dataset with a target', () => {
      expect(matchesDatasetTargetFilter(['agent'], 'all')).toBe(true);
    });

    it('matches a dataset with no target', () => {
      expect(matchesDatasetTargetFilter([], 'all')).toBe(true);
    });
  });

  describe("when the filter is 'none'", () => {
    it('matches only untyped datasets', () => {
      expect(matchesDatasetTargetFilter([], 'none')).toBe(true);
      expect(matchesDatasetTargetFilter(['agent'], 'none')).toBe(false);
    });
  });

  describe('when the filter names a target type', () => {
    it('matches a dataset carrying that type', () => {
      expect(matchesDatasetTargetFilter(['agent'], 'agent')).toBe(true);
    });

    it('matches a dataset carrying that type among several', () => {
      expect(matchesDatasetTargetFilter(['agent', 'workflow'], 'workflow')).toBe(true);
    });

    it('does not match a dataset carrying a different type', () => {
      expect(matchesDatasetTargetFilter(['workflow'], 'agent')).toBe(false);
    });

    it('does not match an untyped dataset', () => {
      expect(matchesDatasetTargetFilter([], 'agent')).toBe(false);
    });
  });

  describe('when the filter is not a known target type', () => {
    it('matches nothing', () => {
      expect(matchesDatasetTargetFilter(['agent'], 'not-a-type')).toBe(false);
      expect(matchesDatasetTargetFilter([], 'not-a-type')).toBe(false);
    });
  });
});

describe('getDatasetTargetTypes', () => {
  describe('when the dataset persists its target type', () => {
    it('uses that type alone, ignoring the experiments', () => {
      expect(getDatasetTargetTypes('agent', [{ targetType: 'workflow' }])).toEqual(['agent']);
    });
  });

  describe('when the dataset has no persisted target type', () => {
    it('derives it from the experiments', () => {
      expect(getDatasetTargetTypes(null, [{ targetType: 'workflow' }])).toEqual(['workflow']);
    });

    it('derives it for an undefined target type', () => {
      expect(getDatasetTargetTypes(undefined, [{ targetType: 'agent' }])).toEqual(['agent']);
    });

    it('derives it for a target type the app does not know', () => {
      expect(getDatasetTargetTypes('not-a-type', [{ targetType: 'agent' }])).toEqual(['agent']);
    });

    it('de-duplicates repeated experiment types', () => {
      expect(getDatasetTargetTypes(null, [{ targetType: 'agent' }, { targetType: 'agent' }])).toEqual(['agent']);
    });

    it('sorts a spread of types so the list renders stably', () => {
      const fromOneOrder = getDatasetTargetTypes(null, [{ targetType: 'workflow' }, { targetType: 'agent' }]);
      const fromTheOther = getDatasetTargetTypes(null, [{ targetType: 'agent' }, { targetType: 'workflow' }]);

      expect(fromOneOrder).toEqual(fromTheOther);
      expect(fromOneOrder).toEqual([...fromOneOrder].sort());
    });

    it('drops experiments whose target type is unknown or absent', () => {
      expect(getDatasetTargetTypes(null, [{ targetType: 'nope' }, { targetType: null }, {}])).toEqual([]);
    });

    it('reports no types when there are no experiments', () => {
      expect(getDatasetTargetTypes(null, [])).toEqual([]);
    });
  });
});

describe('getDatasetTagOptions', () => {
  describe('when datasets carry tags', () => {
    it('offers every distinct tag, sorted, after the all-tags option', () => {
      const options = getDatasetTagOptions([
        dataset({ tags: ['support', 'golden'] }),
        dataset({ id: 'dataset-2', tags: ['golden', 'regression'] }),
      ]);

      expect(options).toEqual([
        { value: 'all', label: 'All tags' },
        { value: 'golden', label: 'golden' },
        { value: 'regression', label: 'regression' },
        { value: 'support', label: 'support' },
      ]);
    });
  });

  describe('when a dataset has no usable tags', () => {
    it('skips a null tags field', () => {
      expect(getDatasetTagOptions([dataset({ tags: null })])).toEqual([{ value: 'all', label: 'All tags' }]);
    });

    it('skips a tags field that is not an array', () => {
      expect(getDatasetTagOptions([dataset({ tags: 'support' as never })])).toEqual([
        { value: 'all', label: 'All tags' },
      ]);
    });

    it('still offers the all-tags option for an empty list', () => {
      expect(getDatasetTagOptions([])).toEqual([{ value: 'all', label: 'All tags' }]);
    });
  });
});

describe('filter option lists', () => {
  it('offers all-targets first and no-target last', () => {
    expect(DATASET_TARGET_OPTIONS[0]).toEqual({ value: 'all', label: 'All targets' });
    expect(DATASET_TARGET_OPTIONS.at(-1)).toEqual({ value: 'none', label: 'No target' });
    expect(DATASET_TARGET_OPTIONS.length).toBeGreaterThan(2);
  });

  it('offers the three experiment filters', () => {
    expect(DATASET_EXPERIMENT_OPTIONS.map(o => o.value)).toEqual(['all', 'with', 'without']);
    expect(DATASET_EXPERIMENT_OPTIONS.map(o => o.label)).toEqual([
      'All datasets',
      'With experiments',
      'Without experiments',
    ]);
  });
});
