import { describe, it } from 'vitest';
import transformer from '../codemods/v1/memory-query-to-recall';
import { testTransform } from './test-utils';

describe('memory-query-to-recall', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'memory-query-to-recall');
  });
});
