import { describe, it } from 'vitest';
import transformer from '../codemods/v1/storage-list-workflow-runs';
import { testTransform } from './test-utils';

describe('storage-list-workflow-runs', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'storage-list-workflow-runs');
  });
});
