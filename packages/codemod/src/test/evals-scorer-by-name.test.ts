import { describe, it } from 'vitest';
import transformer from '../codemods/v1/evals-scorer-by-name';
import { testTransform } from './test-utils';

describe('evals-scorer-by-name', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'evals-scorer-by-name');
  });
});
