import { describe, it, expect } from 'vitest';
import { processSmitheryServers } from '../../processors/smithery';
import { ServerEntry } from '../../types';
import { getServersFromRegistry } from '../../fetch-servers';

describe('Smithery processor', () => {
  it('should process Smithery server data correctly', async () => {
    // Use our getServersFromRegistry function to fetch data
    const result = await getServersFromRegistry('smithery');
    const data = result.servers;

    // Process the data
    const servers = processSmitheryServers(data);

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

  it('should handle different response formats', () => {
    // Test with array format
    const arrayData = [
      { id: 'test1', name: 'Test 1', description: 'Test description 1', url: 'https://example.com/1' },
      { id: 'test2', name: 'Test 2', description: 'Test description 2', url: 'https://example.com/2' },
    ];
    const arrayResult = processSmitheryServers(arrayData);
    expect(arrayResult).toHaveLength(2);
    expect(arrayResult[0].id).toBe('test1');

    // Test with object.servers format
    const objectData = {
      servers: [
        { id: 'test3', name: 'Test 3', description: 'Test description 3', url: 'https://example.com/3' },
        { id: 'test4', name: 'Test 4', description: 'Test description 4', url: 'https://example.com/4' },
      ],
    };
    const objectResult = processSmitheryServers(objectData);
    expect(objectResult).toHaveLength(2);
    expect(objectResult[0].id).toBe('test3');

    // Test with object.items format
    const itemsData = {
      items: [
        { id: 'test5', name: 'Test 5', description: 'Test description 5', url: 'https://example.com/5' },
        { id: 'test6', name: 'Test 6', description: 'Test description 6', url: 'https://example.com/6' },
      ],
    };
    const itemsResult = processSmitheryServers(itemsData);
    expect(itemsResult).toHaveLength(2);
    expect(itemsResult[0].id).toBe('test5');
  });

  it('should handle empty or invalid data', () => {
    // Test with null
    expect(processSmitheryServers(null)).toEqual([]);

    // Test with undefined
    expect(processSmitheryServers(undefined)).toEqual([]);

    // Test with non-object
    expect(processSmitheryServers('not an object')).toEqual([]);

    // Test with empty object
    expect(processSmitheryServers({})).toEqual([]);

    // Test with empty array
    expect(processSmitheryServers([])).toEqual([]);
  });
});
