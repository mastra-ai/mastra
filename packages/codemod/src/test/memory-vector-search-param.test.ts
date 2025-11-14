import { describe, it } from 'vitest';
import transformer from '../codemods/v1/memory-vector-search-param';
import { testTransform } from './test-utils';

describe('memory-vector-search-param', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'memory-vector-search-param');
  });
});
