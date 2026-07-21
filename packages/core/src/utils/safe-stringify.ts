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
 * Returns a JSON-serializable copy of a value by stripping circular references.
 * If the value is already serializable, returns it unchanged (no cloning overhead).
 */
export function ensureSerializable(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;

  try {
    JSON.stringify(value);
    return value;
  } catch {
    return JSON.parse(safeStringify(value));
  }
}
