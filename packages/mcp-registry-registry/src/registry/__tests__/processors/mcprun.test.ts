import { describe, it, expect } from 'vitest';
import { processMcpRunServers } from '../../processors/mcprun';

describe('MCP Run processor', () => {
  it('should handle empty or invalid data', () => {
    // Test with null
    expect(processMcpRunServers(null)).toEqual([]);

    // Test with undefined
    expect(processMcpRunServers(undefined)).toEqual([]);

    // Test with non-object
    expect(processMcpRunServers('not an object')).toEqual([]);

    // Test with empty object
    expect(processMcpRunServers({})).toEqual([]);

    // Test with empty array
    expect(processMcpRunServers([])).toEqual([]);
  });
});
