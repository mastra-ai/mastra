import { registryData } from './registry';
import type { ServerEntry } from './types';

/**
 * Fetches servers from a registry's servers_url endpoint
 */
export async function fetchServersFromRegistry(registryId: string): Promise<ServerEntry[]> {
  try {
    // Find the registry in our registry data
    const registry = registryData.registries.find(r => r.id === registryId);

    if (!registry) {
      throw new Error(`Registry with ID "${registryId}" not found.`);
    }

    if (!registry.servers_url) {
      throw new Error(`Registry "${registry.name}" does not have a servers endpoint.`);
    }

    console.info(`Fetching servers from ${registry.name} at ${registry.servers_url}`);

    // Fetch the servers from the registry's servers_url
    const response = await fetch(registry.servers_url);

    if (!response.ok) {
      throw new Error(`Failed to fetch servers from ${registry.servers_url}: ${response.statusText}`);
    }

    const data = (await response.json()) as unknown;

    // If the registry has a custom post-processing function, use it
    if (registry.postProcessServers) {
      console.info(`Using custom post-processor for ${registry.name}`);
      return registry.postProcessServers(data);
    }

    throw new Error(`No post-processor found for registry ${registry.name}`);
  } catch (error) {
    console.error('Error fetching servers:', error);
    throw error;
  }
}

/**
 * Filters server entries based on provided criteria
 */
export function filterServers(
  servers: ServerEntry[],
  filters: {
    tag?: string;
    search?: string;
  },
): ServerEntry[] {
  let filteredServers = [...servers];

  if (filters.search) {
    const searchTerm = filters.search.toLowerCase();
    filteredServers = filteredServers.filter(
      server => server.name.toLowerCase().includes(searchTerm) || server.description.toLowerCase().includes(searchTerm),
    );
  }

  return filteredServers;
}

/**
 * Main function to get servers from a registry with optional filtering
 */
export async function getServersFromRegistry(
  registryId: string,
  filters: {
    tag?: string;
    search?: string;
  } = {},
): Promise<any> {
  try {
    const servers = await fetchServersFromRegistry(registryId);
    return filterServers(servers, filters);
  } catch (error) {
    console.error('Error getting servers from registry:', error);
    throw error;
  }
}
