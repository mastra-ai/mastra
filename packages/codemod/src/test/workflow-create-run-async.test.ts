import { describe, it } from 'vitest';
import transformer from '../codemods/v1/workflow-create-run-async';
import { testTransform } from './test-utils';

describe('workflow-create-run-async', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'workflow-create-run-async');
  });
});
