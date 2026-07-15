import type { ServerEntry } from '../types';

/**
 * Post-processor for the mcpindex registry.
 * Maps mcpindex's public browse feed (https://mcpindex.ai/api/v1/servers) into ServerEntry[].
 * Feed shape: { servers: [{ slug, name, title, description, updatedAt, ... }], total, returned, generatedAt }.
 * The feed is quality-ranked and bounded (default 100, max 250) — not the full corpus.
 */
export function processMcpindexServers(data: any): ServerEntry[] {
  const serversData = data?.servers;

  if (!Array.isArray(serversData)) {
    return [];
  }

  return serversData
    .filter((item: any) => item && item.slug && (item.title || item.name))
    .map((item: any) => ({
      id: String(item.slug),
      name: String(item.title || item.name),
      description: typeof item.description === 'string' ? item.description.slice(0, 300) : '',
      createdAt: '', // mcpindex's browse feed doesn't carry a creation date
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : '',
    }))
    .slice(0, 250);
}
