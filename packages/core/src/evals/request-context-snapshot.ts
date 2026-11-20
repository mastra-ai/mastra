import { isReservedRequestContextKey } from '../request-context';

/**
 * Builds the JSON-safe requestContext snapshot persisted on score rows.
 *
 * Extracts primitive (string | number | boolean) values, flattening nested objects
 * into dotted keys. Non-primitive values (circular refs, buffers, functions, arrays)
 * are skipped. Reserved Mastra keys (`mastra__*`, `__mastra_*`) are never included:
 * they hold framework state such as the bearer token and live channel adapters.
 * Objects that define `serializeForSpan()` contribute that projection instead of
 * their internals.
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
      if (isReservedRequestContextKey(key)) continue;
      if (
        typeof value === 'string' ||
        typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value))
      ) {
        Object.defineProperty(safeContext, flatKey, { value, enumerable: true, configurable: true, writable: true });
      } else if (value && typeof value === 'object' && !Array.isArray(value) && !ArrayBuffer.isView(value)) {
        const projected = projectForSnapshot(value);
        if (projected && typeof projected === 'object') {
          flatten(projected as Record<string, unknown>, flatKey, depth + 1);
        }
      }
    }
  };
  flatten(requestContext as Record<string, unknown>);
  return safeContext;
}

/**
 * Uses a value's `serializeForSpan()` projection when it has one, so classes that
 * define their trace shape (e.g. `Workspace`) don't have their internals persisted.
 * Map-like values (including nested RequestContexts) keep their `entries()` path.
 */
function projectForSnapshot(value: object): unknown {
  const candidate = value as { entries?: unknown; serializeForSpan?: unknown };
  if (typeof candidate.entries === 'function' || typeof candidate.serializeForSpan !== 'function') {
    return value;
  }
  try {
    return (candidate.serializeForSpan as () => unknown).call(value);
  } catch {
    return undefined;
  }
}
