/**
 * `JSON.stringify` with deterministic key ordering at every level.
 *
 * Required because object key order is preserved by `JSON.stringify`, and we
 * don't want `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }` to hash to different keys.
 *
 * This is critical for cache key generation when comparing messages restored
 * from different storage backends: jsonb columns (e.g. mastra_workflow_snapshot
 * in PostgreSQL) normalize key order, while text columns (mastra_messages)
 * preserve insertion order. Without stable stringification, functionally-equal
 * data-* parts produce different cache keys, causing false dedup misses.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(val as Record<string, unknown>).sort()) {
        sorted[k] = (val as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return val;
  });
}
