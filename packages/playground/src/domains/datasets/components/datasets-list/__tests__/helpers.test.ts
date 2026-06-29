import { describe, expect, it } from 'vitest';

import { DATASET_TARGET_OPTIONS, getDatasetTargetTypes, matchesDatasetTargetFilter } from '../helpers';

describe('getDatasetTargetTypes', () => {
  it('uses the explicit dataset targetType when set, ignoring experiments', () => {
    expect(getDatasetTargetTypes('workflow', [{ targetType: 'agent' }])).toEqual(['workflow']);
  });

  it('derives distinct target types from experiments when the dataset has none, in stable sorted order', () => {
    expect(
      getDatasetTargetTypes(null, [{ targetType: 'workflow' }, { targetType: 'agent' }, { targetType: 'agent' }]),
    ).toEqual(['agent', 'workflow']);
  });

  it('ignores experiments without a targetType', () => {
    expect(
      getDatasetTargetTypes(undefined, [{ targetType: undefined }, { targetType: null }, { targetType: 'agent' }]),
    ).toEqual(['agent']);
  });

  it('returns an empty list when neither the dataset nor its experiments carry a type', () => {
    expect(getDatasetTargetTypes(null, [])).toEqual([]);
    expect(getDatasetTargetTypes(undefined, [{ targetType: null }])).toEqual([]);
  });
});

describe('matchesDatasetTargetFilter', () => {
  it('matches everything for "all"', () => {
    expect(matchesDatasetTargetFilter([], 'all')).toBe(true);
    expect(matchesDatasetTargetFilter(['agent'], 'all')).toBe(true);
  });

  it('matches only untyped datasets for "none" — legacy datasets stay discoverable', () => {
    expect(matchesDatasetTargetFilter([], 'none')).toBe(true);
    expect(matchesDatasetTargetFilter(['agent'], 'none')).toBe(false);
  });

  it('matches a specific type, including the derived multi-type case', () => {
    expect(matchesDatasetTargetFilter(['agent'], 'agent')).toBe(true);
    expect(matchesDatasetTargetFilter(['agent', 'workflow'], 'workflow')).toBe(true);
    expect(matchesDatasetTargetFilter([], 'agent')).toBe(false);
    expect(matchesDatasetTargetFilter(['workflow'], 'agent')).toBe(false);
  });
});

describe('DATASET_TARGET_OPTIONS', () => {
  it('includes every dataset target type plus the all and none filters', () => {
    expect(DATASET_TARGET_OPTIONS).toEqual([
      { value: 'all', label: 'All targets' },
      { value: 'agent', label: 'Agent' },
      { value: 'workflow', label: 'Workflow' },
      { value: 'scorer', label: 'Scorer' },
      { value: 'processor', label: 'Processor' },
      { value: 'none', label: 'No target' },
    ]);
  });
});
