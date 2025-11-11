import { describe, it } from 'vitest';
import transformer from '../codemods/v1/workflow-list-runs';
import { testTransform } from './test-utils';

describe('workflow-list-runs', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'workflow-list-runs');
  });
});
