import { describe, it, expect } from 'vitest';
import { getServersFromRegistry } from '../../fetch-servers';
import { processFleurServers } from '../../processors/fleur';
import type { ServerEntry } from '../../types';

describe.skip('Fleur processor', () => {
  it('should process Fleur server data correctly', async () => {
    // Use our getServersFromRegistry function to fetch data
    const result = await getServersFromRegistry('fleur');

    // Verify the result
    expect(Array.isArray(result)).toBe(true);

    // Check that we got some servers
    expect(result.length).toBeGreaterThan(0);

    // Verify each server has the required fields
    result.forEach((server: ServerEntry) => {
      expect(server).toHaveProperty('id');
      expect(server).toHaveProperty('name');
      expect(server).toHaveProperty('description');
      expect(server).toHaveProperty('createdAt');
      expect(server).toHaveProperty('updatedAt');
    });
  });

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
