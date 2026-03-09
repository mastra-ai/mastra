import { describe, it } from 'vitest';
import transformer from '../codemods/v1/memory-readonly-to-options';
import { testTransform } from './test-utils';

describe('memory-readonly-to-options', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'memory-readonly-to-options');
  });
});
