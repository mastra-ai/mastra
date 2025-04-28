import type { ServerEntry } from '../types';
import { createServerEntry } from './utils';

/**
 * Post-processor for Docker MCP Hub registry
 * Transforms Docker Hub API response into standardized ServerEntry format
 */
export function processDockerServers(data: unknown): ServerEntry[] {
  if (!data || typeof data !== 'object') {
    return [];
  }

  const servers: ServerEntry[] = [];
  const results = (data as any)?.results || [];

  if (!Array.isArray(results)) {
    return [];
  }

  for (const item of results) {
    if (typeof item === 'object' && item !== null) {
      const server = createServerEntry(item as Record<string, unknown>);

      // Map Docker Hub specific fields
      if (item.name) {
        server.id = item.name;
        server.name = item.name;
      }

      // Use the first image's description if available
      if (Array.isArray(item.images) && item.images[0]?.description) {
        server.description = item.images[0].description;
      }

      // Use last_updated as updatedAt
      if (item.last_updated) {
        server.updatedAt = item.last_updated;
      }

      servers.push(server);
    }
  }

  return servers;
}
