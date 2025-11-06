import { describe, it, expect } from 'vitest';
import transformer from '../codemods/v1/agent-get-agents';
import { testTransform, applyTransform } from './test-utils';

describe('agent-get-agents', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'agent-get-agents');
  });

  it('does not transform getAgents on non-mastra objects', () => {
    const input = `
// Some other object, not mastra
const mastra = {
  getAgents: () => [],
};

// Should not be transformed
const agents = mastra.getAgents();
`;

    const output = applyTransform(transformer, input);

    // Should remain unchanged
    expect(output).toBe(input);
  });
});
