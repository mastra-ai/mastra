import type { ServerEntry } from '../types';

// Post-processor for MCP Run registry
export function processMcpRunServers(data: any): ServerEntry[] {
  const serversData = data;

  if (!Array.isArray(serversData)) {
    return [];
  }

  return serversData
    .filter((item: any) => item && item.slug)
    .map((item: any) => {
      const server = {
        id: item.slug,
        name: item.slug,
        description: item?.meta?.description,
        createdAt: item?.created_at,
        updatedAt: item?.updated_at,
      };

      return server;
    });
}
