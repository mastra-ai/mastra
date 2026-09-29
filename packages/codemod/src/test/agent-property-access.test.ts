import { describe, it, expect } from 'vitest';
import transformer from '../codemods/v1/agent-property-access';
import { testTransform, applyTransform } from './test-utils';

describe('agent-property-access', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'agent-property-access');
  });

  it('transforms Agent tools access to the v1 listTools method', () => {
    const input = `
const agent = new Agent({});
const tools = agent.tools;
`;

    const output = applyTransform(transformer, input);

    expect(output).toContain('const tools = agent.listTools();');
    expect(output).not.toContain('agent.getTools()');
  });

  it('does not transform properties on non-Agent variables', () => {
    const input = `
// Some other object, not from new Agent()
const agent = { llm: 'model', tools: [], instructions: 'test' };

// Should not be transformed
const llm = agent.llm;
const tools = agent.tools;
const instructions = agent.instructions;
`;

    const output = applyTransform(transformer, input);

    // Should remain unchanged
    expect(output).toBe(input);
  });
});
