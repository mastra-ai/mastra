import type { ServerEntry } from '../types';

// Shape of an item in mcpindex's browse feed (https://mcpindex.ai/api/v1/servers).
// All fields optional — the payload is external, so every read is narrowed.
interface McpindexServer {
  slug?: string;
  name?: string;
  title?: string;
  description?: string;
  updatedAt?: string;
}

/**
 * Post-processor for the mcpindex registry.
 * Maps mcpindex's public browse feed into ServerEntry[].
 * Feed shape: { servers: [{ slug, name, title, description, updatedAt, ... }], total, returned, generatedAt }.
 * The feed is quality-ranked and bounded (default 100, max 250) — not the full corpus.
 */
export function processMcpindexServers(data: unknown): ServerEntry[] {
  const serversData = (data as { servers?: unknown })?.servers;

  if (!Array.isArray(serversData)) {
    return [];
  }

  return (serversData as unknown[])
    .filter((item): item is McpindexServer => {
      if (!item || typeof item !== 'object') return false;
      const s = item as McpindexServer;
      return !!s.slug && !!(s.title || s.name);
    })
    .map((item) => ({
      id: String(item.slug),
      name: String(item.title || item.name),
      description: typeof item.description === 'string' ? item.description.slice(0, 300) : '',
      createdAt: '', // mcpindex's browse feed doesn't carry a creation date
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : '',
    }))
    .slice(0, 250);
}
