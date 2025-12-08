import { describe, it } from 'vitest';
import transformer from '../codemods/v1/workflow-stream-vnext';
import { testEdgeCases, testTransform } from './test-utils';

describe('workflow-stream-vnext', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'workflow-stream-vnext');
  });
  testEdgeCases(transformer);
});
