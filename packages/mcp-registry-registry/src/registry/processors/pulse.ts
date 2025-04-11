import type { ServerEntry } from '../types';

/**
 * Post-processor for Pulse MCP registry
 * Handles the specific format of Pulse MCP's server data
 */
export function processPulseMcpServers(data: any): ServerEntry[] {
  // Get the servers array from the response
  const serversData = data?.servers || [];

  if (!Array.isArray(serversData)) {
    return [];
  }

  // Map the data to server entries
  return serversData
    .filter((item: any) => item && item.name)
    .map((item: any) => {
      const server = {
        id: item.name || 'unknown',
        name: item.name || 'Unknown Server',
        description:
          item.short_description.slice(0, 300) ||
          item.EXPERIMENTAL_ai_generated_description.slice(0, 300) ||
          'No description available',
        createdAt: '', // Pulse MCP doesn't provide creation date
        updatedAt: '', // Pulse MCP doesn't provide update date
      };

      return server;
    })
    .slice(0, 1000);
}
