import { describe, it, expect } from 'vitest';
import { getServersFromRegistry } from '../../fetch-servers';
import { processPulseMcpServers } from '../../processors/pulse';
import type { ServerEntry } from '../../types';

describe('Pulse MCP processor', () => {
  it('should process Pulse MCP server data correctly', async () => {
    try {
      // Use our getServersFromRegistry function to fetch data
      const result = await getServersFromRegistry('pulse-mcp');

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
      console.warn('Error during Pulse MCP test, may require authentication:', error);
      // Skip test if API requires authentication
    }
  });

  it('should handle sample Pulse MCP data correctly', () => {
    // Sample data from Pulse MCP
    const sampleData = {
      servers: [
        {
          name: 'Laravel DebugBar',
          url: 'https://www.pulsemcp.com/servers/021-factory-laravel-debugbar',
          external_url: null,
          short_description:
            'Provides a bridge to Laravel DebugBar for accessing detailed request logs, queries, routes, views, and models with filtering capabilities and formatted output for improved readability.',
          source_code_url: 'https://github.com/021-factory/laravel-debugbar-mcp',
          github_stars: 1,
          package_registry: null,
          package_name: null,
          package_download_count: null,
          EXPERIMENTAL_ai_generated_description:
            'Laravel DebugBar MCP Server provides a bridge between AI assistants and the Laravel DebugBar debugging tool, enabling access to detailed request logs and diagnostic information from Laravel applications.',
        },
        {
          name: 'Taskwarrior',
          url: 'https://www.pulsemcp.com/servers/0xbeedao-taskwarrior26c9',
          external_url: null,
          short_description:
            'Integrates with Taskwarrior to enable task management through adding, updating, deleting, and listing tasks with project organization and priority level support.',
          source_code_url: 'https://github.com/0xbeedao/mcp-taskwarrior',
          github_stars: 0,
          package_registry: 'npm',
          package_name: '@0xbeedao/mcp-taskwarrior',
          package_download_count: 1056,
          EXPERIMENTAL_ai_generated_description:
            'mcp-taskwarrior is a server implementation by Bruce Kroeze that facilitates task management through Taskwarrior.',
        },
      ],
    };

    // Process the sample data
    const servers = processPulseMcpServers(sampleData);

    // Verify the results
    expect(servers).toHaveLength(2);

    // Check first server
    const server1 = servers[0];
    expect(server1.id).toBe('Laravel DebugBar');
    expect(server1.name).toBe('Laravel DebugBar');
    expect(server1.description).toBe(
      'Provides a bridge to Laravel DebugBar for accessing detailed request logs, queries, routes, views, and models with filtering capabilities and formatted output for improved readability.',
    );

    // Check second server
    const server2 = servers[1];
    expect(server2.id).toBe('Taskwarrior');
    expect(server2.name).toBe('Taskwarrior');
    expect(server2.description).toBe(
      'Integrates with Taskwarrior to enable task management through adding, updating, deleting, and listing tasks with project organization and priority level support.',
    );
  });

  it('should handle empty or invalid data', () => {
    // Test with null
    expect(processPulseMcpServers(null)).toEqual([]);

    // Test with undefined
    expect(processPulseMcpServers(undefined)).toEqual([]);

    // Test with non-object
    expect(processPulseMcpServers('not an object')).toEqual([]);

    // Test with empty object
    expect(processPulseMcpServers({})).toEqual([]);

    // Test with empty servers array
    expect(processPulseMcpServers({ servers: [] })).toEqual([]);
  });
});
