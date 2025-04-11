import type { ServerEntry } from '../types';
import { createServerEntry } from './utils';

/**
 * Default processor for registry server data
 * Handles common formats that might be encountered
 */
export function processDefaultServers(data: unknown): ServerEntry[] {
  if (!data || typeof data !== 'object') {
    return [];
  }

  const servers: ServerEntry[] = [];

  // Handle different response formats
  let serversList: unknown[] = [];

  if (Array.isArray(data)) {
    // If the response is an array, assume it's an array of servers
    serversList = data;
  } else if (typeof data === 'object' && data !== null) {
    const dataObj = data as Record<string, unknown>;
    if (dataObj.servers && Array.isArray(dataObj.servers)) {
      // If the response has a 'servers' property, use that
      serversList = dataObj.servers;
    } else if (dataObj.items && Array.isArray(dataObj.items)) {
      // Some APIs might use 'items' instead of 'servers'
      serversList = dataObj.items;
    }
  }

  // Process each server in the list
  for (const item of serversList) {
    if (typeof item === 'object' && item !== null) {
      servers.push(createServerEntry(item as Record<string, unknown>));
    }
  }

  return servers;
}
