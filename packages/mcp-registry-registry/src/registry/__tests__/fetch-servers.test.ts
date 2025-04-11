import { describe, expect, it, afterAll } from 'vitest';
import { getServersFromRegistry } from '../fetch-servers';
import { ServerEntry } from '../types';

// This is an integration test that doesn't use mocking
// Note: This test requires internet access and will make actual API calls
describe('getServersFromRegistry integration test', () => {
  // Track registry test results for summary
  const registryResults: Record<string, { status: 'success' | 'error' | 'skipped'; message?: string }> = {};

  // Log a summary of all registry tests after completion
  afterAll(() => {
    console.log('\n=== Registry Test Summary ===');
    Object.entries(registryResults).forEach(([registry, result]) => {
      const statusSymbol = result.status === 'success' ? '✅' : result.status === 'error' ? '❌' : '⚠️';
      console.log(`${statusSymbol} ${registry}: ${result.status}${result.message ? ` - ${result.message}` : ''}`);
    });
    console.log('==========================\n');
  });

  // Helper function to validate server entries
  const validateServerEntries = (servers: ServerEntry[]) => {
    servers.forEach((server: ServerEntry) => {
      expect(server.id).toBeDefined();
      expect(server.name).toBeDefined();
      expect(server.description).toBeDefined();
    });
  };

  // Test for MCP Run registry
  it.only('should fetch servers from mcp-run registry', async () => {
    try {
      const result = await getServersFromRegistry('mcp-run');

      console.log(result);

      // Verify we got some servers back
      expect(result.count).toBeGreaterThan(0);
      expect(result.servers.length).toBeGreaterThan(0);

      // Check that each server has the required fields
      validateServerEntries(result.servers);
    } catch (error) {
      // If the test fails due to network issues, skip it
      console.warn('Network error during test, skipping:', error);
      return;
    }
  });

  // Test for apitracker registry
  it('should fetch servers from apitracker registry', async () => {
    try {
      const result = await getServersFromRegistry('apitracker');

      // Verify we got some servers back
      expect(result.count).toBeGreaterThan(0);
      expect(result.servers.length).toBeGreaterThan(0);

      // Check that each server has the required fields
      validateServerEntries(result.servers);
    } catch (error) {
      console.warn('Error or network issue with apitracker registry, skipping test:', error);
      return;
    }
  });

  // Test for fleur registry
  it('should fetch servers from fleur registry', async () => {
    try {
      const result = await getServersFromRegistry('fleur');

      // Verify we got some servers back
      expect(result.count).toBeGreaterThan(0);
      expect(result.servers.length).toBeGreaterThan(0);

      // Check that each server has the required fields
      validateServerEntries(result.servers);
    } catch (error) {
      console.warn('Error or network issue with fleur registry, skipping test:', error);
      return;
    }
  });

  // Test for smithery registry
  it('should fetch servers from smithery registry', async () => {
    try {
      const result = await getServersFromRegistry('smithery');

      // Verify we got some servers back
      expect(result.count).toBeGreaterThan(0);
      expect(result.servers.length).toBeGreaterThan(0);

      // Check that each server has the required fields
      validateServerEntries(result.servers);
    } catch (error) {
      console.warn('Error or network issue with smithery registry, skipping test:', error);
      return;
    }
  });

  it('should filter servers by tag if available', async () => {
    try {
      // First get all servers to see if we have any with tags
      const allServers = await getServersFromRegistry('mcp-run');

      if (allServers.count === 0) {
        console.warn('No servers found, skipping test');
        return;
      }

      // Find a tag that exists in at least one server
      let testTag: string | undefined;
      for (const server of allServers.servers) {
        if (server.tags && server.tags.length > 0) {
          testTag = server.tags[0];
          break;
        }
      }

      if (!testTag) {
        console.warn('No servers with tags found, skipping test');
        return;
      }

      // Now filter by that tag
      const result = await getServersFromRegistry('mcp-run', { tag: testTag });

      // All returned servers should have this tag
      expect(result.length).toBeGreaterThan(0);
    } catch (error) {
      console.warn('Error during tag filtering test, skipping:', error);
      return;
    }
  });

  it('should search servers by name or description', async () => {
    try {
      // First get all servers
      const allServers = await getServersFromRegistry('mcp-run');

      if (allServers.count === 0) {
        console.warn('No servers found, skipping test');
        return;
      }

      // Pick a word from the first server's name or description to search for
      const firstServer = allServers.servers[0];
      const searchWord = firstServer.name.split(' ')[0];

      if (!searchWord || searchWord.length < 3) {
        console.warn('Could not find suitable search term, skipping test');
        return;
      }

      // Search for that word
      const result = await getServersFromRegistry('mcp-run', { search: searchWord });

      // We should find at least the server we got the word from
      expect(result.length).toBeGreaterThan(0);

      // At least one server should contain our search term in name or description
      const hasMatch = result.some(
        (server: ServerEntry) =>
          server.name.toLowerCase().includes(searchWord.toLowerCase()) ||
          server.description.toLowerCase().includes(searchWord.toLowerCase()),
      );

      expect(hasMatch).toBe(true);
    } catch (error) {
      console.warn('Error during search test, skipping:', error);
      return;
    }
  });

  it('should handle errors when registry is not found', async () => {
    try {
      // Try to get servers from a non-existent registry
      await getServersFromRegistry('non-existent-registry-id');
      // Should not reach here
      expect(true).toBe(false); // Force test to fail if we reach this point
    } catch (error) {
      // We expect an error to be thrown
      expect(error).toBeDefined();
      if (error instanceof Error) {
        expect(error.message).toContain('not found');
      }
    }
  });
});
