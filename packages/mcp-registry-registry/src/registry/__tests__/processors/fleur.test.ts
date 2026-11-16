import { describe, it, expect } from 'vitest';
import { processFleurServers } from '../../processors/fleur';

describe('Fleur processor', () => {
  it('should handle empty or invalid data', () => {
    // Test with null
    expect(processFleurServers(null)).toEqual([]);

    // Test with undefined
    expect(processFleurServers(undefined)).toEqual([]);

    // Test with non-object
    expect(processFleurServers('not an object')).toEqual([]);

    // Test with empty object
    expect(processFleurServers({})).toEqual([]);

    // Test with empty array
    expect(processFleurServers([])).toEqual([]);
  });
});
