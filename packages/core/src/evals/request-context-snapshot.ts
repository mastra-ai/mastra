import { MASTRA_AUTH_TOKEN_KEY } from '../request-context';

/**
 * Builds the JSON-safe requestContext snapshot persisted on score rows.
 *
 * Extracts primitive (string | number | boolean) values, flattening nested objects
 * into dotted keys. Non-primitive values (circular refs, buffers, functions, arrays)
 * are skipped, and the framework-managed bearer token is never included.
 */
export function snapshotRequestContextForScore(requestContext: unknown): Record<string, string | number | boolean> {
  const safeContext: Record<string, string | number | boolean> = {};
  if (!requestContext || typeof requestContext !== 'object') return safeContext;

  const MAX_DEPTH = 8;
  const visited = new WeakSet<object>();
  const flatten = (obj: Record<string, unknown>, prefix?: string, depth = 0) => {
    if (depth > MAX_DEPTH) return;
    if (visited.has(obj)) return;
    visited.add(obj);

    const entries: Iterable<[string, unknown]> =
      typeof (obj as any).entries === 'function' ? (obj as any).entries() : Object.entries(obj);
    for (const [key, value] of entries) {
      const flatKey = prefix ? `${prefix}.${key}` : key;
      if (flatKey === MASTRA_AUTH_TOKEN_KEY) continue;
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        safeContext[flatKey] = value;
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        flatten(value as Record<string, unknown>, flatKey, depth + 1);
      }
    }
  };
  flatten(requestContext as Record<string, unknown>);
  return safeContext;
}
