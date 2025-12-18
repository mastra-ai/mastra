/**
 * Bounded serialization utilities for AI tracing.
 *
 * These utilities prevent memory issues by enforcing strict limits on
 * string lengths, array sizes, object depths, and total output size.
 * They are designed to be used across all tracing/telemetry systems.
 */

/**
 * Default keys to strip from objects during deep cleaning.
 * These are typically internal/sensitive fields that shouldn't be traced.
 */
export const DEFAULT_KEYS_TO_STRIP = new Set([
  'logger',
  'experimental_providerMetadata',
  'providerMetadata',
  'steps',
  'tracingContext',
]);

export interface DeepCleanOptions {
  keysToStrip: Set<string>;
  maxDepth: number;
  maxStringLength: number;
  maxArrayLength: number;
  maxObjectKeys: number;
}

export const DEFAULT_DEEP_CLEAN_OPTIONS: DeepCleanOptions = {
  keysToStrip: DEFAULT_KEYS_TO_STRIP,
  maxDepth: 6,
  maxStringLength: 1024,
  maxArrayLength: 50,
  maxObjectKeys: 50,
};

/**
 * Hard-cap any string to prevent unbounded growth.
 */
export function truncateString(s: string, maxChars: number): string {
  if (s.length <= maxChars) {
    return s;
  }

  return s.slice(0, maxChars) + '…[truncated]';
}

/**
 * Recursively cleans a value by removing circular references, stripping problematic keys,
 * and enforcing size limits on strings, arrays, and objects.
 *
 * This is used by AI tracing spans to sanitize input/output data before storing.
 *
 * @param value - The value to clean (object, array, primitive, etc.)
 * @param options - Optional configuration for cleaning behavior
 * @returns A cleaned version of the input with size limits enforced
 */
export function deepClean(value: any, options: DeepCleanOptions = DEFAULT_DEEP_CLEAN_OPTIONS): any {
  const { keysToStrip, maxDepth, maxStringLength, maxArrayLength, maxObjectKeys } = options;

  const seen = new WeakSet<any>();

  function helper(val: any, depth: number): any {
    if (depth > maxDepth) {
      return '[MaxDepth]';
    }

    // Handle primitives
    if (val === null || val === undefined) {
      return val;
    }

    // Handle strings - enforce length limit
    if (typeof val === 'string') {
      return truncateString(val, maxStringLength);
    }

    // Handle other non-object primitives explicitly
    if (typeof val === 'number' || typeof val === 'boolean') {
      return val;
    }
    if (typeof val === 'bigint') {
      return `${val}n`;
    }
    if (typeof val === 'function') {
      return '[Function]';
    }
    if (typeof val === 'symbol') {
      return val.description ? `[Symbol(${val.description})]` : '[Symbol]';
    }

    // Handle Date objects - preserve as-is
    if (val instanceof Date) {
      return val;
    }

    // Handle Errors specially - preserve name and message
    if (val instanceof Error) {
      return {
        name: val.name,
        message: val.message ? truncateString(val.message, maxStringLength) : undefined,
      };
    }

    // Handle circular references
    if (typeof val === 'object') {
      if (seen.has(val)) {
        return '[Circular]';
      }
      seen.add(val);
    }

    // Handle arrays - enforce length limit
    if (Array.isArray(val)) {
      const limitedArray = val.slice(0, maxArrayLength);
      const cleaned = limitedArray.map(item => helper(item, depth + 1));
      if (val.length > maxArrayLength) {
        cleaned.push(`[…${val.length - maxArrayLength} more items]`);
      }
      return cleaned;
    }

    // Handle Buffer and typed arrays - don't serialize large binary data
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(val)) {
      return `[Buffer length=${val.length}]`;
    }

    if (ArrayBuffer.isView(val)) {
      const ctor = (val as any).constructor?.name ?? 'TypedArray';
      const byteLength = (val as any).byteLength ?? '?';
      return `[${ctor} byteLength=${byteLength}]`;
    }

    if (val instanceof ArrayBuffer) {
      return `[ArrayBuffer byteLength=${val.byteLength}]`;
    }

    // Handle objects - enforce key limit
    const cleaned: Record<string, any> = {};
    const entries = Object.entries(val);
    let keyCount = 0;

    for (const [key, v] of entries) {
      if (keysToStrip.has(key)) {
        continue;
      }

      if (keyCount >= maxObjectKeys) {
        cleaned['__truncated'] = `${entries.length - keyCount} more keys omitted`;
        break;
      }

      try {
        cleaned[key] = helper(v, depth + 1);
        keyCount++;
      } catch (error) {
        cleaned[key] = `[${error instanceof Error ? error.message : String(error)}]`;
        keyCount++;
      }
    }

    return cleaned;
  }

  return helper(value, 0);
}
