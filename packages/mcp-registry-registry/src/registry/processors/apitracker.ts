import type { ServerEntry } from '../types';
import { createServerEntry } from './utils';

/**
 * Post-processor for APITracker registry
 * Handles the specific format of APITracker's server data
 */
export function processApiTrackerServers(data: unknown): ServerEntry[] {
  if (!data || typeof data !== 'object') {
    return [];
  }

  const servers: ServerEntry[] = [];

  // APITracker might return an object with a servers array
  if (typeof data === 'object' && data !== null) {
    const dataObj = data as Record<string, unknown>;

    let serversList: unknown[] = [];

    if (Array.isArray(dataObj.servers)) {
      serversList = dataObj.servers;
    } else if (Array.isArray(dataObj.items)) {
      serversList = dataObj.items;
    } else if (Array.isArray(data)) {
      serversList = data as unknown[];
    }

    for (const item of serversList) {
      if (typeof item === 'object' && item !== null) {
        servers.push(createServerEntry(item as Record<string, unknown>));
      }
    }
  }

  return servers;
}
