/**
 * Weaviate reserves certain property names (e.g. `id`, `vector`). Metadata keys
 * that collide are stored under a stable prefix and restored on read. This
 * module is the single source of truth shared by the adapter and the filter
 * translator — they must encode keys identically or filters will silently miss.
 */
export const RESERVED_META_KEYS = new Set(['id', 'vector', '_additional']);
export const META_KEY_PREFIX = 'mastraMeta_';

export function encodeMetaKey(key: string): string {
  return RESERVED_META_KEYS.has(key) ? `${META_KEY_PREFIX}${key}` : key;
}

export function decodeMetaKey(key: string): string {
  return key.startsWith(META_KEY_PREFIX) ? key.slice(META_KEY_PREFIX.length) : key;
}

export function encodeMetaProperties(metadata?: Record<string, any>): Record<string, any> {
  if (!metadata) return {};
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(metadata)) {
    out[encodeMetaKey(key)] = value;
  }
  return out;
}
