import { describe, it } from 'vitest';
import transformer from '../codemods/v1/storage-get-messages-paginated';
import { testTransform } from './test-utils';

describe('storage-get-messages-paginated', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'storage-get-messages-paginated');
  });
});
