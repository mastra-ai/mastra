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
 * Serialize a value to JSON while visiting no more than
 * `SERIALIZATION_NODE_BUDGET` nodes. Returns the JSON string, or `undefined`
 * when the value cannot be represented as JSON: it threw (a cycle or BigInt),
 * exhausted the budget (a shared-reference graph `JSON.stringify` would expand
 * exponentially), or produced no output (top-level `undefined`, a function, a
 * symbol, or an object whose `toJSON()` returns `undefined`).
 *
 * The value is read exactly once, so a caller that needs both a serializability
 * check and the serialized result can use this rather than probing and then
 * re-serializing — closing a TOCTOU gap where a stateful getter/`toJSON()`
 * returns a different (e.g. much larger) value the second time.
 */
export function boundedStringify(value: unknown): string | undefined {
  let budget = SERIALIZATION_NODE_BUDGET;
  try {
    return JSON.stringify(value, (_key, val) => {
      if (--budget < 0) {
        throw new RangeError('boundedStringify: value exceeds the serialization node budget');
      }
      return val;
    });
  } catch {
    return undefined;
  }
}

/**
 * Whether `value` can be serialized to JSON within `SERIALIZATION_NODE_BUDGET`
 * nodes. `false` for cycles, BigInt, over-budget shared-reference graphs, and
 * values that produce no JSON output (top-level undefined/function/symbol, or an
 * object whose `toJSON()` returns undefined).
 */
export function isBoundedSerializable(value: unknown): boolean {
  return boundedStringify(value) !== undefined;
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
