import { describe, expect, it } from 'vitest';

import { getAllDatasetTags } from '../dataset-tags';
import { dataset, taggedDatasets } from './fixtures/tagged-datasets';

describe('getAllDatasetTags', () => {
  describe('when datasets have overlapping tags', () => {
    it('offers each tag once in alphabetical order', () => {
      expect(getAllDatasetTags(taggedDatasets)).toEqual(['english', 'reviewed', 'support']);
    });
  });

  describe('when datasets have no tags', () => {
    it('offers no tags', () => {
      expect(getAllDatasetTags([dataset('ds-a', 'Dataset A')])).toEqual([]);
    });
  });
});
