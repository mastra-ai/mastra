import { describe, it, expect } from 'vitest';
import { processDockerServers } from '../../processors/docker';

describe('Docker MCP processor', () => {
  it('should handle empty or invalid data', () => {
    // Test with null
    expect(processDockerServers(null)).toEqual([]);

    // Test with undefined
    expect(processDockerServers(undefined)).toEqual([]);

    // Test with non-object
    expect(processDockerServers('not an object')).toEqual([]);

    // Test with empty object
    expect(processDockerServers({})).toEqual([]);

    // Test with empty results array
    expect(processDockerServers({ results: [] })).toEqual([]);
  });
});
