import type { ServerEntry } from '../types';
import { createServerEntry } from './utils';

/**
 * Post-processor for Fleur registry
 * Handles the specific format of Fleur's app data
 */
export function processFleurServers(data: unknown): ServerEntry[] {
  if (!data || typeof data !== 'object') {
    return [];
  }

  const servers: ServerEntry[] = [];

  // Fleur returns an array of app objects
  if (Array.isArray(data)) {
    for (const item of data) {
      if (typeof item === 'object' && item !== null) {
        const server = createServerEntry(item as Record<string, unknown>);

        // Handle Fleur specific fields
        if ((item as any).appId) {
          server.id = (item as any).appId;
        }

        servers.push(server);
      }
    }
  }

  return servers;
}
