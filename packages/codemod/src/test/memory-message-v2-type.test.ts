import { describe, it } from 'vitest';
import transformer from '../codemods/v1/memory-message-v2-type';
import { testTransform } from './test-utils';

describe('memory-message-v2-type', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'memory-message-v2-type');
  });
});
