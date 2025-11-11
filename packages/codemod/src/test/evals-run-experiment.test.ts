import { describe, it } from 'vitest';
import transformer from '../codemods/v1/evals-run-experiment';
import { testTransform } from './test-utils';

describe('evals-run-experiment', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'evals-run-experiment');
  });
});
