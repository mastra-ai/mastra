import { describe, it } from 'vitest';
import transformer from '../codemods/v1/evals-prebuilt-imports';
import { testTransform } from './test-utils';

describe('evals-prebuilt-imports', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'evals-prebuilt-imports');
  });
});
