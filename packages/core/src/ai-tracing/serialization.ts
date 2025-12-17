/**
 * Bounded serialization utilities for AI tracing.
 *
 * These utilities prevent memory issues by enforcing strict limits on
 * string lengths, array sizes, object depths, and total output size.
 * They are designed to be used across all tracing/telemetry systems.
 */

/**
 * Configuration limits for serialization.
 * These defaults are intentionally conservative to prevent OOM issues.
 */
export interface SerializationLimits {
  /** Maximum characters for any single attribute string (default: 1024) */
  maxAttrChars: number;
  /** Maximum characters for preview strings (default: 256) */
  maxPreviewChars: number;
  /** Maximum array items to show in preview (default: 10) */
  maxArrayPreviewItems: number;
  /** Maximum depth for recursive serialization (default: 6) */
  maxDepth: number;
  /** Maximum object keys to serialize (default: 50) */
  maxKeys: number;
  /** Maximum array elements to serialize (default: 50) */
  maxArrayItems: number;
  /** Maximum total output characters (default: 8192) */
  maxTotalChars: number;
}

export const DEFAULT_SERIALIZATION_LIMITS: SerializationLimits = {
  maxAttrChars: 1024,
  maxPreviewChars: 256,
  maxArrayPreviewItems: 10,
  maxDepth: 6,
  maxKeys: 50,
  maxArrayItems: 50,
  maxTotalChars: 8192,
};

/**
 * Hard-cap any string to prevent unbounded growth.
 */
export function truncateString(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars) + '…[truncated]';
}

/**
 * Small, non-recursive preview of unknown values.
 * Never walks object graphs deeply - meant for span attributes (cheap + safe).
 *
 * @param value - The value to preview
 * @param limits - Optional limits (uses defaults if not provided)
 * @returns A string representation of the value
 */
export function previewValue(value: unknown, limits: Partial<SerializationLimits> = {}): string {
  const { maxAttrChars, maxPreviewChars, maxArrayPreviewItems } = {
    ...DEFAULT_SERIALIZATION_LIMITS,
    ...limits,
  };

  if (value == null) return String(value);

  switch (typeof value) {
    case 'string': {
      const s = value as string;
      const preview = s.length > maxPreviewChars ? s.slice(0, maxPreviewChars) + '…' : s;
      return truncateString(preview, maxAttrChars);
    }

    case 'number':
    case 'boolean':
      return String(value);

    case 'bigint':
      return `${value}n`;

    case 'function':
      return '[Function]';

    case 'symbol': {
      const sym = value as symbol;
      return sym.description ? `[Symbol(${sym.description})]` : '[Symbol]';
    }

    default:
      break;
  }

  // Handle special object types
  if (value instanceof Error) {
    return truncateString(`[Error ${value.name}: ${value.message}]`, maxAttrChars);
  }

  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return `[Buffer length=${value.length}]`;
  }

  if (ArrayBuffer.isView(value)) {
    const ctor = (value as any).constructor?.name ?? 'TypedArray';
    const byteLength = (value as any).byteLength ?? '?';
    return `[${ctor} byteLength=${byteLength}]`;
  }

  if (value instanceof ArrayBuffer) {
    return `[ArrayBuffer byteLength=${value.byteLength}]`;
  }

  if (Array.isArray(value)) {
    const len = value.length;
    const sample = value.slice(0, maxArrayPreviewItems).map(v => {
      const pv = previewValue(v, limits);
      return pv.length > 64 ? pv.slice(0, 64) + '…' : pv;
    });
    return truncateString(`[Array length=${len} sample=[${sample.join(', ')}]]`, maxAttrChars);
  }

  // Generic object handling
  const ctor = (value as any)?.constructor?.name ?? 'Object';
  let keys: string[] | undefined;
  try {
    keys = Object.keys(value as any).slice(0, 10);
  } catch {
    keys = undefined;
  }
  if (keys && keys.length) {
    return truncateString(`[${ctor} keys=${keys.join(',')}${keys.length === 10 ? ',…' : ''}]`, maxAttrChars);
  }
  return truncateString(`[${ctor}]`, maxAttrChars);
}

/**
 * Bounded safe stringify for when you need JSON output.
 * Still capped and depth/size limited to prevent memory issues.
 *
 * @param value - The value to stringify
 * @param limits - Optional limits (uses defaults if not provided)
 * @returns A JSON string representation with enforced limits
 */
export function boundedStringify(value: unknown, limits: Partial<SerializationLimits> = {}): string {
  const { maxAttrChars, maxDepth, maxKeys, maxArrayItems, maxTotalChars } = {
    ...DEFAULT_SERIALIZATION_LIMITS,
    ...limits,
  };

  const seen = new WeakSet<object>();

  function helper(v: any, depth: number): any {
    if (v == null) return v;

    const t = typeof v;
    if (t === 'string') {
      return v.length > maxAttrChars ? v.slice(0, maxAttrChars) + '…[truncated]' : v;
    }
    if (t === 'number' || t === 'boolean') return v;
    if (t === 'bigint') return `${v}n`;
    if (t === 'function') return '[Function]';
    if (t === 'symbol') return v.description ? `[Symbol(${v.description})]` : '[Symbol]';

    if (v instanceof Error) {
      return {
        name: v.name,
        message: v.message ? truncateString(v.message, maxAttrChars) : undefined,
      };
    }

    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(v)) {
      return `[Buffer length=${v.length}]`;
    }

    if (ArrayBuffer.isView(v)) {
      const ctor = v.constructor?.name ?? 'TypedArray';
      const byteLength = (v as any).byteLength ?? '?';
      return `[${ctor} byteLength=${byteLength}]`;
    }

    if (v instanceof ArrayBuffer) {
      return `[ArrayBuffer byteLength=${v.byteLength}]`;
    }

    if (depth <= 0) {
      const ctor = v?.constructor?.name ?? 'Object';
      return `[${ctor} depthLimit]`;
    }

    if (typeof v === 'object') {
      if (seen.has(v)) return '[Circular]';
      seen.add(v);

      if (Array.isArray(v)) {
        const result = v.slice(0, maxArrayItems).map(x => helper(x, depth - 1));
        if (v.length > maxArrayItems) {
          result.push(`[…${v.length - maxArrayItems} more items]`);
        }
        return result;
      }

      const out: Record<string, any> = {};
      const keys = Object.keys(v).slice(0, maxKeys);
      for (const k of keys) {
        try {
          out[k] = helper(v[k], depth - 1);
        } catch {
          out[k] = '[Not Serializable]';
        }
      }
      if (Object.keys(v).length > keys.length) {
        out.__truncated = `${Object.keys(v).length - keys.length} more keys`;
      }
      return out;
    }

    return String(v);
  }

  try {
    const json = JSON.stringify(helper(value, maxDepth));
    if (json.length > maxTotalChars) {
      return json.slice(0, maxTotalChars) + '…[truncated]';
    }
    return json;
  } catch {
    return '[Not Serializable]';
  }
}

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
  keysToStrip?: Set<string>;
  maxDepth?: number;
  maxStringLength?: number;
  maxArrayLength?: number;
  maxObjectKeys?: number;
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
export function deepClean(
  value: any,
  options: DeepCleanOptions = {},
  _seen: WeakSet<any> = new WeakSet(),
  _depth: number = 0,
): any {
  const {
    keysToStrip = DEFAULT_KEYS_TO_STRIP,
    maxDepth = DEFAULT_SERIALIZATION_LIMITS.maxDepth,
    maxStringLength = DEFAULT_SERIALIZATION_LIMITS.maxAttrChars,
    maxArrayLength = DEFAULT_SERIALIZATION_LIMITS.maxArrayItems,
    maxObjectKeys = DEFAULT_SERIALIZATION_LIMITS.maxKeys,
  } = options;

  if (_depth > maxDepth) {
    return '[MaxDepth]';
  }

  // Handle primitives
  if (value === null || value === undefined) {
    return value;
  }

  // Handle strings - enforce length limit
  if (typeof value === 'string') {
    if (value.length > maxStringLength) {
      return value.slice(0, maxStringLength) + `…[truncated, was ${value.length} chars]`;
    }
    return value;
  }

  // Handle other primitives
  if (typeof value !== 'object') {
    try {
      JSON.stringify(value);
      return value;
    } catch (error) {
      return `[${error instanceof Error ? error.message : String(error)}]`;
    }
  }

  // Handle circular references
  if (_seen.has(value)) {
    return '[Circular]';
  }

  _seen.add(value);

  // Handle arrays - enforce length limit
  if (Array.isArray(value)) {
    const limitedArray = value.slice(0, maxArrayLength);
    const cleaned = limitedArray.map(item => deepClean(item, options, _seen, _depth + 1));
    if (value.length > maxArrayLength) {
      cleaned.push(`[…${value.length - maxArrayLength} more items]`);
    }
    return cleaned;
  }

  // Handle Buffer and typed arrays - don't serialize large binary data
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return `[Buffer length=${value.length}]`;
  }

  if (ArrayBuffer.isView(value)) {
    const ctor = (value as any).constructor?.name ?? 'TypedArray';
    const byteLength = (value as any).byteLength ?? '?';
    return `[${ctor} byteLength=${byteLength}]`;
  }

  // Handle objects - enforce key limit
  const cleaned: Record<string, any> = {};
  const entries = Object.entries(value);
  let keyCount = 0;

  for (const [key, val] of entries) {
    if (keysToStrip.has(key)) {
      continue;
    }

    if (keyCount >= maxObjectKeys) {
      cleaned['__truncated'] = `${entries.length - keyCount} more keys omitted`;
      break;
    }

    try {
      cleaned[key] = deepClean(val, options, _seen, _depth + 1);
      keyCount++;
    } catch (error) {
      cleaned[key] = `[${error instanceof Error ? error.message : String(error)}]`;
      keyCount++;
    }
  }

  return cleaned;
}
