import { describe, it, expect } from 'vitest';
import { processApiTrackerServers } from '../../processors/apitracker';
import { ServerEntry } from '../../types';
import { getServersFromRegistry } from '../../fetch-servers';

describe('APITracker processor', () => {
  it('should process APITracker server data correctly', async () => {
    // Use our getServersFromRegistry function to fetch data
    const result = await getServersFromRegistry('apitracker');
    const data = result.servers;

    // Process the data
    const servers = processApiTrackerServers(data);

    // Verify the result
    expect(Array.isArray(servers)).toBe(true);

    // Check that we got some servers
    expect(servers.length).toBeGreaterThan(0);

    // Verify each server has the required fields
    servers.forEach((server: ServerEntry) => {
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
