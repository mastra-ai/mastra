import { describe, it } from 'vitest';
import transformer from '../codemods/v1/storage-list-messages-by-id';
import { testTransform } from './test-utils';

describe('storage-list-messages-by-id', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'storage-list-messages-by-id');
  });
});
