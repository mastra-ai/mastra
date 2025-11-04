import { describe, it } from 'vitest';
import transformer from '../codemods/v1/runtime-context';
import { testTransform } from './test-utils';

describe('runtime-context', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'runtime-context');
  });
});
