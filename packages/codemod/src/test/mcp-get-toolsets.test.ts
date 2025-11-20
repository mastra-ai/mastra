import { describe, it, expect } from 'vitest';
import transformer from '../codemods/v1/mcp-get-toolsets';
import { testTransform, applyTransform } from './test-utils';

describe('mcp-get-toolsets', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'mcp-get-toolsets');
  });

  it('does not transform getToolsets on non-MCPServer objects', () => {
    const input = `
// Some other object, not from new MCPServer()
const mcp = {
  getToolsets: () => [],
};

// Should not be transformed
const tools = await mcp.getToolsets();
`;

    const output = applyTransform(transformer, input);

    // Should remain unchanged
    expect(output).toBe(input);
  });
});
