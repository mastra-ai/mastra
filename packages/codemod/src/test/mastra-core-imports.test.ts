import { describe, it } from 'vitest';
import transformer from '../codemods/v1/mastra-core-imports';
import { testTransform } from './test-utils';

describe('mastra-core-imports', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'mastra-core-imports');
  });
});
