import { describe, it, expect } from 'vitest';
import { processPulseMcpServers } from '../../processors/pulse';

describe('Pulse MCP processor', () => {
  it('should handle empty or invalid data', () => {
    // Test with null
    expect(processPulseMcpServers(null)).toEqual([]);

    // Test with undefined
    expect(processPulseMcpServers(undefined)).toEqual([]);

    // Test with non-object
    expect(processPulseMcpServers('not an object')).toEqual([]);

    // Test with empty object
    expect(processPulseMcpServers({})).toEqual([]);

    // Test with empty servers array
    expect(processPulseMcpServers({ servers: [] })).toEqual([]);
  });
});
