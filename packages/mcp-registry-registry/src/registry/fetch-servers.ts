import { z } from 'zod';
import { getRegistryListings, RegistryEntry } from './list-registries';

// Define the schema for server entries
export const ServerEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  url: z.string().url(),
  tags: z.array(z.string()).optional(),
  count: z.union([z.number(), z.string()]).optional(),
});

export type ServerEntry = z.infer<typeof ServerEntrySchema>;

/**
 * Fetches servers from a registry's servers_url endpoint
 */
export async function fetchServersFromRegistry(registryId: string): Promise<ServerEntry[]> {
  try {
    // Get the registry details to find the servers_url
    const registryResult = await getRegistryListings({ id: registryId }, { detailed: true });

    if (registryResult.count === 0) {
      throw new Error(`Registry with ID "${registryId}" not found.`);
    }

    const registry = registryResult.registries[0];

    if (!registry.servers_url) {
      throw new Error(`Registry "${registry.name}" does not have a servers endpoint.`);
    }

    // Fetch the servers from the registry's servers_url
    const response = await fetch(registry.servers_url);

    if (!response.ok) {
      throw new Error(`Failed to fetch servers from ${registry.servers_url}: ${response.statusText}`);
    }

    const data = (await response.json()) as unknown;

    // Handle different response formats
    let servers: any[] = [];

    if (Array.isArray(data)) {
      // If the response is an array, assume it's an array of servers
      servers = data;
    } else if (typeof data === 'object' && data !== null) {
      const dataObj = data as Record<string, unknown>;
      if (dataObj.servers && Array.isArray(dataObj.servers)) {
        // If the response has a 'servers' property, use that
        servers = dataObj.servers;
      } else if (dataObj.items && Array.isArray(dataObj.items)) {
        // Some APIs might use 'items' instead of 'servers'
        servers = dataObj.items;
      } else {
        throw new Error(`Unexpected response format from ${registry.servers_url}`);
      }
    } else {
      throw new Error(`Unexpected response format from ${registry.servers_url}`);
    }

    // Validate and normalize the servers
    return servers.map(server => {
      try {
        return ServerEntrySchema.parse(server);
      } catch (error) {
        // If validation fails, try to extract the required fields
        const serverObj = server as Record<string, unknown>;
        return {
          id: (serverObj.id as string) || (serverObj.name as string) || 'unknown',
          name: (serverObj.name as string) || (serverObj.id as string) || 'Unknown Server',
          description: (serverObj.description as string) || 'No description available',
          url: (serverObj.url as string) || (serverObj.endpoint as string) || '',
          tags: (serverObj.tags as string[]) || [],
        };
      }
    });
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

  if (filters.tag) {
    filteredServers = filteredServers.filter(server => server.tags?.includes(filters.tag!));
  }

  if (filters.search) {
    const searchTerm = filters.search.toLowerCase();
    filteredServers = filteredServers.filter(
      server => server.name.toLowerCase().includes(searchTerm) || server.description.toLowerCase().includes(searchTerm),
    );
  }

  return filteredServers;
}

/**
 * Formats server entries for API response
 */
export function formatServersResponse(servers: ServerEntry[]): any {
  return {
    count: servers.length,
    servers: servers.map(server => ({
      id: server.id,
      name: server.name,
      description: server.description,
      url: server.url,
      tags: server.tags || [],
      count: server.count,
    })),
  };
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
    const filteredServers = filterServers(servers, filters);
    return formatServersResponse(filteredServers);
  } catch (error) {
    console.error('Error getting servers from registry:', error);
    throw error;
  }
}
