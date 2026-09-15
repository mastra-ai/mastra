import { createHash } from 'node:crypto';

/**
 * `JSON.stringify` with deterministic key ordering at every level.
 *
 * Object key order is preserved by `JSON.stringify`, so semantically identical
 * configs whose keys were inserted in a different order (e.g. after an agent
 * update, an import, or a storage backend that normalizes key order) would
 * otherwise serialize differently. Sorting keys recursively makes the output
 * canonical. Array order and scalar values are left untouched, so they remain
 * significant.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const sorted = Object.create(null) as Record<string, unknown>;
      for (const k of Object.keys(val as Record<string, unknown>).sort()) {
        sorted[k] = (val as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return val;
  });
}

/**
 * Derive a deterministic identity for an inline workspace config.
 *
 * The ID is content-addressed via a canonical (key-order-independent) hash so
 * that equivalent configs resolve to the same stored workspace instead of
 * creating duplicates. Array order and value differences remain significant.
 */
export function computeInlineWorkspaceIdentity(config: unknown): { workspaceId: string; configHash: string } {
  const configHash = createHash('sha256').update(stableStringify(config)).digest('hex').slice(0, 12);
  return { workspaceId: `inline-${configHash}`, configHash };
}
