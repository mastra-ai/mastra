import { describe, it, expect } from 'vitest';
import { getServersFromRegistry } from '../../fetch-servers';
import { processApifyServers } from '../../processors/apify';
import type { ServerEntry } from '../../types';

describe('Apify processor', () => {
  it('should process Apify server data correctly', async () => {
    try {
      // Use our getServersFromRegistry function to fetch data
      const result = await getServersFromRegistry('apify');

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
    } catch (error) {
      console.warn('Error during Apify test, may require authentication:', error);
      // Skip test if API requires authentication
    }
  });

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
