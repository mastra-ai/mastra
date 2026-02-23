import type { ServerEntry } from '../types';
import { createServerEntry } from './utils';

/**
 * Post-processor for AiList registry
 * Handles the specific format of AiList's project data
 */
export function processAiListServers(data: unknown): ServerEntry[] {
  if (!data || typeof data !== 'object') {
    return [];
  }

  const dataObj = data as Record<string, unknown>;
  const serversList = Array.isArray(dataObj.projects) ? dataObj.projects : [];

  return serversList
    .filter((item: unknown) => item && typeof item === 'object')
    .map((item: unknown) => createServerEntry(item as Record<string, unknown>));
}
