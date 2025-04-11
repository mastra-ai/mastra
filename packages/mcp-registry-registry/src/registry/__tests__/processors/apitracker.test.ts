import { describe, it, expect } from 'vitest';
import { getServersFromRegistry } from '../../fetch-servers';
import { processApiTrackerServers } from '../../processors/apitracker';
import type { ServerEntry } from '../../types';

describe('APITracker processor', () => {
  it('should process APITracker server data correctly', async () => {
    // Use our getServersFromRegistry function to fetch data
    const result = await getServersFromRegistry('apitracker');

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
    expect(processApiTrackerServers(null)).toEqual([]);

    // Test with undefined
    expect(processApiTrackerServers(undefined)).toEqual([]);

    // Test with non-object
    expect(processApiTrackerServers('not an object')).toEqual([]);

    // Test with empty object
    expect(processApiTrackerServers({})).toEqual([]);

    // Test with empty array
    expect(processApiTrackerServers([])).toEqual([]);
  });
});
