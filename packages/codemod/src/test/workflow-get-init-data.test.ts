import { describe, it } from 'vitest';
import transformer from '../codemods/v1/workflow-get-init-data';
import { testTransform } from './test-utils';

describe('workflow-get-init-data', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'workflow-get-init-data');
  });
});
