/**
 * Safely JSON-stringifies a value, replacing circular references with "[Circular]".
 * Stack-based approach matches @mastra/core `safeStringify` (PR #14535) so shared
 * non-circular object references are preserved when cloning.
 */
function safeStringify(value: unknown): string {
  const stack: unknown[] = [];
  return JSON.stringify(value, function (this: unknown, _key: string, val: unknown) {
    if (typeof val === 'bigint') return val.toString();
    if (val !== null && typeof val === 'object') {
      while (stack.length > 0 && stack[stack.length - 1] !== this) {
        stack.pop();
      }
      if (stack.includes(val)) return '[Circular]';
      stack.push(val);
    }
    return val;
  });
}

/**
 * Deep-clones JSON-like values. Uses cycle-safe serialization when the graph has
 * circular references (e.g. JSON Schema after `$RefParser.dereference()`).
 */
export function cloneJsonWithCycleSafety<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return JSON.parse(safeStringify(value)) as T;
  }
}
