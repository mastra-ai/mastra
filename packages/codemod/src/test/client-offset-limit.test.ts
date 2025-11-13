import { describe, it, expect } from 'vitest';
import transformer from '../codemods/v1/client-offset-limit';
import { testTransform, applyTransform } from './test-utils';

describe('client-offset-limit', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'client-offset-limit');
  });

  it('does not transform offset/limit unrelated to MastraClient', () => {
    const input = `
const config = {
  offset: 10,
  limit: 50,
};

const otherApi = {
  getData: () => {}
};

otherApi.getData({ offset: 0, limit: 20 });
    `.trim();

    const output = applyTransform(transformer, input);

    // Should remain unchanged
    expect(output).toBe(input);
  });

  it('only transforms offset/limit in MastraClient method calls', () => {
    const input = `
import { MastraClient } from '@mastra/client-js';

const client = new MastraClient({ baseUrl: 'http://localhost' });

// This should be transformed
await client.listLogs({ offset: 0, limit: 10 });

// This should NOT be transformed
const unrelatedConfig = { offset: 5, limit: 15 };
    `.trim();

    const output = applyTransform(transformer, input);

    // Client call should be transformed
    expect(output).toContain('await client.listLogs({ page: 0, perPage: 10 });');

    // Unrelated config should NOT be transformed
    expect(output).toContain('const unrelatedConfig = { offset: 5, limit: 15 };');
  });
});
