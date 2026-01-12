import { describe, it } from 'vitest';
import transformer from '../codemods/v1/list-threads-by-resource-to-list-threads';
import { testTransform } from './test-utils';

describe('list-threads-by-resource-to-list-threads', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'list-threads-by-resource-to-list-threads');
  });
});
