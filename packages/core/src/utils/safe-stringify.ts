/**
 * Safely JSON-stringifies a value, replacing circular references with "[Circular]".
 * Uses a stack-based approach so shared (non-circular) references are preserved.
 */
export function safeStringify(value: unknown, space?: string | number): string {
  const stack: unknown[] = [];
  const result: string | undefined = JSON.stringify(
    value,
    function (this: unknown, _key: string, val: unknown) {
      if (typeof val === 'bigint') return val.toString();
      if (val !== null && typeof val === 'object') {
        while (stack.length > 0 && stack[stack.length - 1] !== this) {
          stack.pop();
        }
        if (stack.includes(val)) return '[Circular]';
        stack.push(val);
      }
      return val;
    },
    space,
  );
  // JSON.stringify returns undefined for unsupported top-level values (undefined, functions, symbols).
  return result ?? 'null';
}

/**
 * Maximum number of nodes the `isBoundedSerializable` probe lets `JSON.stringify`
 * visit for a single value.
 *
 * `JSON.stringify` expands shared (non-circular) references once per path, so an
 * acyclic graph with layered sharing (`{ a: n, b: n }` nested `d` deep) holds
 * `d + 1` objects but expands to `2^d` visited nodes — enough to block the event
 * loop for minutes. The budget makes the probe bail in bounded time; a value
 * that exceeds it is treated as "not directly serializable".
 */
const SERIALIZATION_NODE_BUDGET = 1_000_000;

/**
 * Whether `JSON.stringify(value)` would succeed while visiting no more than
 * `SERIALIZATION_NODE_BUDGET` nodes.
 *
 * Mirrors a bare `JSON.stringify` probe — returns `false` for cycles, BigInt,
 * and other non-serializable values — but can never hang on a shared-reference
 * graph: it stops and returns `false` once the budget is exhausted instead of
 * expanding the graph exponentially.
 */
export function isBoundedSerializable(value: unknown): boolean {
  try {
    let budget = SERIALIZATION_NODE_BUDGET;
    JSON.stringify(value, (_key, val) => {
      if (--budget < 0) {
        throw new RangeError('isBoundedSerializable: value exceeds the serialization node budget');
      }
      return val;
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Cycle- and shared-reference-safe stringify: every object is serialized at most
 * once, and any repeat — a true cycle OR a shared/diamond reference — becomes
 * "[Circular]". Unlike `safeStringify`, this cannot expand a shared-reference
 * graph exponentially, so it is a bounded fallback for values that overflow the
 * `isBoundedSerializable` probe.
 */
function collapseStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  const result: string | undefined = JSON.stringify(value, function (_key: string, val: unknown) {
    if (typeof val === 'bigint') return val.toString();
    if (val !== null && typeof val === 'object') {
      if (seen.has(val)) return '[Circular]';
      seen.add(val);
    }
    return val;
  });
  return result ?? 'null';
}

/**
 * Returns a JSON-serializable copy of a value.
 *
 * If the value already serializes within the node budget it is returned
 * unchanged (no cloning overhead). Otherwise — a cycle, a BigInt, or a
 * shared-reference graph too large for the probe — it is rebuilt through
 * `collapseStringify`, which dedupes repeated references to `[Circular]` and so
 * completes in bounded time instead of hanging on the exponential expansion.
 */
export function ensureSerializable(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (isBoundedSerializable(value)) return value;
  return JSON.parse(collapseStringify(value));
}
