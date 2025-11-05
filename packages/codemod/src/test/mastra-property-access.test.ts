import { describe, it } from 'vitest';
import transformer from '../codemods/v1/mastra-property-access';
import { testTransform } from './test-utils';

describe('property-access', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'mastra-property-access');
  });
});
