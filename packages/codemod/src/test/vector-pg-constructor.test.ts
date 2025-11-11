import { describe, it } from 'vitest';
import transformer from '../codemods/v1/vector-pg-constructor';
import { testTransform } from './test-utils';

describe('vector-pg-constructor', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'vector-pg-constructor');
  });
});
