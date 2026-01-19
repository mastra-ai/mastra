import { describe, it } from 'vitest';
import transformer from '../codemods/v1/client-msg-function-args';
import { testTransform } from './test-utils';

describe('client-msg-function-args', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'client-msg-function-args');
  });
});
