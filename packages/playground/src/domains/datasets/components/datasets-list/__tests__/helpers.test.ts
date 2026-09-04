import { describe, expect, it } from 'vitest';

import { getDatasetTargetTypes } from '../helpers';

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
