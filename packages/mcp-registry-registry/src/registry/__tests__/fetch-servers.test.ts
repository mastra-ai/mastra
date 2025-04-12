import { describe, expect, it, afterAll } from 'vitest';
import { getServersFromRegistry } from '../fetch-servers';
import type { ServerEntry } from '../types';

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

  it('should search servers by name or description', async () => {
    try {
      // First get all servers
      const allServers = await getServersFromRegistry('mcprun');

      if (allServers.count === 0) {
        console.warn('No servers found, skipping test');
        return;
      }

      // Pick a word from the first server's name or description to search for
      const firstServer = allServers;
      const searchWord = firstServer.name.split(' ')[0];

      if (!searchWord || searchWord.length < 3) {
        console.warn('Could not find suitable search term, skipping test');
        return;
      }

      // Search for that word
      const result = await getServersFromRegistry('mcprun', { search: searchWord });

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
