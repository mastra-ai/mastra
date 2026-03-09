import { describe, it, expect } from 'vitest';
import transformer from '../codemods/v1/agent-processor-methods';
import { testTransform, applyTransform } from './test-utils';

describe('agent-processor-methods', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'agent-processor-methods');
  });

  it('does not transform processor methods on non-Agent variables', () => {
    const input = `
// Some other object, not from new Agent()
const agent = {
  getInputProcessors: () => [],
  getOutputProcessors: () => [],
};

// Should not be transformed
const inputProcessors = await agent.getInputProcessors(runtimeContext);
const outputProcessors = await agent.getOutputProcessors(runtimeContext);
`;

    const output = applyTransform(transformer, input);

    // Should remain unchanged
    expect(output).toBe(input);
  });
});
