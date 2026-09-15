/**
 * Weaviate reserves certain property names (e.g. `id`, `vector`). Metadata keys
 * that collide are stored under a stable prefix and restored on read. This
 * module is the single source of truth shared by the adapter and the filter
 * translator — they must encode keys identically or filters will silently miss.
 */
export const RESERVED_META_KEYS = new Set(['id', 'vector', '_additional']);
export const META_KEY_PREFIX = 'mastraMeta_';

export function encodeMetaKey(key: string): string {
  // Encode reserved names, and also escape any genuine user key that already
  // starts with the prefix. Escaping makes the transform fully reversible:
  // without it, a user key like `mastraMeta_id` would be indistinguishable from
  // an encoded `id` on read and would be returned under the wrong name.
  return RESERVED_META_KEYS.has(key) || key.startsWith(META_KEY_PREFIX) ? `${META_KEY_PREFIX}${key}` : key;
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
