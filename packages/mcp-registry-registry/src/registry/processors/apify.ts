import type { ServerEntry } from '../types';

/**
 * Post-processor for Apify registry
 * Handles the specific format of Apify's store data
 */
export function processApifyServers(data: any): ServerEntry[] {
  // Get the data array from the response
  const apifyData = data?.data?.items || [];

  if (!Array.isArray(apifyData)) {
    return [];
  }

  // Map the data to server entries
  return apifyData
    .filter((item: any) => item && item.name)
    .map((item: any) => {
      // Extract stats for the updated date
      const stats = item.stats || {};

      const server = {
        id: item.name || 'unknown',
        name: item.title,
        description: item.description || 'No description available',
        createdAt: '', // Apify doesn't provide creation date
        updatedAt: stats.lastRunStartedAt || '',
      };

      return server;
    });
}
