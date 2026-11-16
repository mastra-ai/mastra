import { describe, it, expect } from 'vitest';
import { processApifyServers } from '../../processors/apify';

describe('Apify processor', () => {
  it('should handle empty or invalid data', () => {
    // Test with null
    expect(processApifyServers(null)).toEqual([]);

    // Test with undefined
    expect(processApifyServers(undefined)).toEqual([]);

    // Test with non-object
    expect(processApifyServers('not an object')).toEqual([]);

    // Test with empty object
    expect(processApifyServers({})).toEqual([]);

    // Test with empty array
    expect(processApifyServers([])).toEqual([]);

    // Test with empty data array
    expect(processApifyServers({ data: [] })).toEqual([]);
  });
});
