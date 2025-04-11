import { ServerEntry } from '../types';
import { createServerEntry } from './utils';

/**
 * Post-processor for Smithery registry
 * Handles the specific format of Smithery's server data
 */
export function processSmitheryServers(data: unknown): ServerEntry[] {
  if (!data || typeof data !== 'object') {
    return [];
  }

  const servers: ServerEntry[] = [];

  // Smithery returns an array of server objects
  if (Array.isArray(data)) {
    for (const item of data) {
      if (typeof item === 'object' && item !== null) {
        const server = createServerEntry(item as Record<string, unknown>);
        servers.push(server);
      }
    }
  } else if (typeof data === 'object' && data !== null) {
    // It might also return an object with a servers or items property
    const dataObj = data as Record<string, unknown>;

    let serversList: unknown[] = [];

    if (Array.isArray(dataObj.servers)) {
      serversList = dataObj.servers;
    } else if (Array.isArray(dataObj.items)) {
      serversList = dataObj.items;
    }

    for (const item of serversList) {
      if (typeof item === 'object' && item !== null) {
        servers.push(createServerEntry(item as Record<string, unknown>));
      }
    }
  }

  return servers;
}
