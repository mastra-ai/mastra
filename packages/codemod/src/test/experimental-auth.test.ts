import { describe, it, expect } from 'vitest';
import transformer from '../codemods/v1/experimental-auth';
import { testTransform, applyTransform } from './test-utils';

describe('experimental-auth', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'experimental-auth');
  });

  it('does not transform experimental_auth outside Mastra config', () => {
    const input = `
// Some other config object
const config = {
  experimental_auth: {
    provider: workos,
  },
};

// Should not be transformed
const otherConfig = {
  experimental_auth: true,
};
`;

    const output = applyTransform(transformer, input);

    // Should remain unchanged
    expect(output).toBe(input);
  });
});
