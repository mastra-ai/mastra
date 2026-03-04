import { describe, it } from 'vitest';
import transformer from '../codemods/v1/storage-list-threads-by-resource-to-list-threads';
import { testTransform } from './test-utils';

describe('storage-list-threads-by-resource-to-list-threads', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'storage-list-threads-by-resource-to-list-threads');
  });
});
