import { describe, it, expect } from 'vitest';
import transformer from '../codemods/v1/mcp-get-mcp-servers';
import { testTransform, applyTransform } from './test-utils';

describe('mcp-get-mcp-servers', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'mcp-get-mcp-servers');
  });

  it('does not transform getMCPServers on non-Mastra objects', () => {
    const input = `
// Some other object, not from new Mastra()
const mastra = {
  getMCPServers: () => [],
};

// Should not be transformed
const servers = await mastra.getMCPServers();
`;

    const output = applyTransform(transformer, input);

    // Should remain unchanged
    expect(output).toBe(input);
  });
});
