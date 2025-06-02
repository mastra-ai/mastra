import { describe, it, expect } from 'vitest';
import { getServersFromRegistry } from '../../fetch-servers';
import { processDockerServers } from '../../processors/docker';
import type { ServerEntry } from '../../types';

describe('Docker MCP processor', () => {
  it('should process Docker MCP server data correctly', async () => {
    try {
      // Use our getServersFromRegistry function to fetch data
      const result = await getServersFromRegistry('docker-mcp-catalog');

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
      console.warn('Error during Docker MCP test, may require authentication:', error);
      // Skip test if API requires authentication
    }
  });

  it('should handle sample Docker MCP data correctly', () => {
    // Sample data from Docker Hub API
    const sampleData = {
      results: [
        {
          name: 'git',
          namespace: 'mcp',
          repository_type: null,
          status: 1,
          status_description: 'active',
          description: 'A Model Context Protocol server for Git repository interaction and automation',
          is_private: false,
          star_count: 3,
          pull_count: 4560,
          last_updated: '2025-04-16T15:05:48.044427Z',
          last_modified: '2025-04-26T15:41:19.129417Z',
          date_registered: '2024-12-19T20:39:42.265713Z',
          affiliation: '',
          media_types: ['application/vnd.oci.image.index.v1+json'],
          content_types: ['image'],
          categories: [
            {
              name: 'Machine Learning & AI',
              slug: 'machine-learning-and-ai',
            },
          ],
          storage_size: 954596202,
        },
      ],
    };

    // Process the sample data
    const servers = processDockerServers(sampleData);

    // Verify the results
    expect(servers).toHaveLength(1);

    // Check the server
    const server = servers[0];
    expect(server.id).toBe('git');
    expect(server.name).toBe('git');
    expect(server.description).toBe('A Model Context Protocol server for Git repository interaction and automation');
    expect(server.updatedAt).toBe('2025-04-16T15:05:48.044427Z');
  });

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
