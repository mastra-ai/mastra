import { describe, expect, it } from 'vitest';

import { getDatasetTagOptions } from '../helpers';
import { dataset, taggedDatasets } from './fixtures/datasets';

describe('getDatasetTagOptions', () => {
  describe('when datasets have overlapping tags', () => {
    it('offers each tag once in alphabetical order after the all-tags option', () => {
      expect(getDatasetTagOptions(taggedDatasets)).toEqual([
        { value: 'all', label: 'All tags' },
        { value: 'english', label: 'english' },
        { value: 'reviewed', label: 'reviewed' },
        { value: 'support', label: 'support' },
      ]);
    });
  });

  describe('when datasets have no tags', () => {
    it('offers only the all-tags option', () => {
      expect(getDatasetTagOptions([dataset('ds-a', 'Dataset A')])).toEqual([{ value: 'all', label: 'All tags' }]);
    });
  });
});
