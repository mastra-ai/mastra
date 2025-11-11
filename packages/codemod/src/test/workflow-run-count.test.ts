import { describe, it } from 'vitest';
import transformer from '../codemods/v1/workflow-run-count';
import { testTransform } from './test-utils';

describe('workflow-run-count', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'workflow-run-count');
  });
});
