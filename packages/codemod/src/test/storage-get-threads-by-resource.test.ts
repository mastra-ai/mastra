import { describe, it } from 'vitest';
import transformer from '../codemods/v1/storage-get-threads-by-resource';
import { testTransform } from './test-utils';

describe('storage-get-threads-by-resource', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'storage-get-threads-by-resource');
  });
});
