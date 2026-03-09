import { describe, it } from 'vitest';
import transformer from '../codemods/v1/storage-postgres-schema-name';
import { testTransform } from './test-utils';

describe('storage-postgres-schema-name', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'storage-postgres-schema-name');
  });
});
