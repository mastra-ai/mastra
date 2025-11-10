import { describe, it, expect } from 'vitest';
import transformer from '../codemods/v1/mcp-get-tools';
import { testTransform, applyTransform } from './test-utils';

describe('mcp-get-tools', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'mcp-get-tools');
  });

  it('does not transform getTools on non-MCPServer objects', () => {
    const input = `
// Some other object, not from new MCPServer()
const mcp = {
  getTools: () => [],
};

// Should not be transformed
const tools = await mcp.getTools();
`;

    const output = applyTransform(transformer, input);

    // Should remain unchanged
    expect(output).toBe(input);
  });
});
