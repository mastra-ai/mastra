import { describe, it, expect } from 'vitest';
import transformer from '../codemods/v1/agent-generate-stream-v-next';
import { testTransform, applyTransform } from './test-utils';

describe('agent-generate-stream-v-next', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'agent-generate-stream-v-next');
  });

  it('does not transform VNext methods on non-Agent variables', () => {
    const input = `
// Some other object, not from new Agent()
const agent = {
  generateVNext: (prompt) => {},
  streamVNext: (prompt) => {},
};

// Should not be transformed
const result = await agent.generateVNext('Hello');
const stream = await agent.streamVNext('Hello');
`;

    const output = applyTransform(transformer, input);

    // Should remain unchanged
    expect(output).toBe(input);
  });
});
