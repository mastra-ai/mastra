import { describe, it, expect } from 'vitest';
import { processFleurServers } from '../../processors/fleur';
import { ServerEntry } from '../../types';
import { getServersFromRegistry } from '../../fetch-servers';

describe('Fleur processor', () => {
  it('should process Fleur server data correctly', async () => {
    // Use our getServersFromRegistry function to fetch data
    const result = await getServersFromRegistry('fleur');
    const data = result.servers;

    // Process the data
    const servers = processFleurServers(data);

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

    // Check for Fleur-specific handling
    // At least one server should have had its ID set from appId
    const hasAppIdServer = servers.some(server => data.some((item: any) => item.appId && item.appId === server.id));
    expect(hasAppIdServer).toBe(true);
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
