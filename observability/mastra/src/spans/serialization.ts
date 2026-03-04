/**
 * Bounded serialization utilities for AI tracing.
 *
 * These utilities prevent memory issues by enforcing strict limits on
 * string lengths, array sizes, object depths, and total output size.
 * They are designed to be used across all tracing/telemetry systems.
 *
 * ## Custom Span Serialization
 *
 * Classes can implement a `serializeForSpan()` method to provide a custom
 * representation when serialized for tracing spans. This is useful for:
 * - Excluding internal state and implementation details
 * - Removing functions and circular references
 * - Providing a clean, readable representation for observability
 *
 * @example
 * ```typescript
 * class MyClass {
 *   private internalState = new Map();
 *   public data: string[];
 *
 *   serializeForSpan() {
 *     return { data: this.data };
 *   }
 * }
 * ```
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
  'execute', // Tool execute functions
  'validate', // Schema validate functions
]);

export interface DeepCleanOptions {
  keysToStrip: Set<string> | string[] | Record<string, unknown>;
  maxDepth: number;
  maxStringLength: number;
  maxArrayLength: number;
  maxObjectKeys: number;
}

export const DEFAULT_DEEP_CLEAN_OPTIONS: DeepCleanOptions = Object.freeze({
  keysToStrip: DEFAULT_KEYS_TO_STRIP,
  maxDepth: 8,
  maxStringLength: 128 * 1024, // 128KB - sufficient for large LLM prompts/responses
  maxArrayLength: 50,
  maxObjectKeys: 50,
});

/**
 * Merge user-provided serialization options with defaults.
 * Returns a complete DeepCleanOptions object.
 */
export function mergeSerializationOptions(userOptions?: {
  maxStringLength?: number;
  maxDepth?: number;
  maxArrayLength?: number;
  maxObjectKeys?: number;
}): DeepCleanOptions {
  if (!userOptions) {
    return DEFAULT_DEEP_CLEAN_OPTIONS;
  }
  return {
    keysToStrip: DEFAULT_KEYS_TO_STRIP,
    maxDepth: userOptions.maxDepth ?? DEFAULT_DEEP_CLEAN_OPTIONS.maxDepth,
    maxStringLength: userOptions.maxStringLength ?? DEFAULT_DEEP_CLEAN_OPTIONS.maxStringLength,
    maxArrayLength: userOptions.maxArrayLength ?? DEFAULT_DEEP_CLEAN_OPTIONS.maxArrayLength,
    maxObjectKeys: userOptions.maxObjectKeys ?? DEFAULT_DEEP_CLEAN_OPTIONS.maxObjectKeys,
  };
}

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
 * Detect if an object is a JSON Schema.
 * Looks for typical JSON Schema markers like $schema, type with properties, etc.
 */
function isJsonSchema(val: any): boolean {
  if (typeof val !== 'object' || val === null) return false;

  // Has explicit $schema property
  if (val.$schema && typeof val.$schema === 'string' && val.$schema.includes('json-schema')) {
    return true;
  }

  // Has type: "object" with properties (common pattern)
  if (val.type === 'object' && val.properties && typeof val.properties === 'object') {
    return true;
  }

  return false;
}

/**
 * Compress a JSON Schema to a more readable format for tracing.
 * Extracts just the essential structure: property names and their types.
 * Recursively handles nested object schemas.
 *
 * @example
 * Input:
 * {
 *   type: "object",
 *   properties: {
 *     name: { type: "string" },
 *     address: {
 *       type: "object",
 *       properties: { city: { type: "string" }, zip: { type: "string" } }
 *     }
 *   },
 *   required: ["name"],
 *   $schema: "http://json-schema.org/draft-07/schema#"
 * }
 *
 * Output:
 * { name: "string (required)", address: { city: "string", zip: "string" } }
 */
function compressJsonSchema(schema: any, depth: number = 0): any {
  // Limit recursion depth to avoid overly verbose output
  if (depth > 3) {
    return schema.type || 'object';
  }

  if (schema.type !== 'object' || !schema.properties) {
    // For non-object schemas, just return the type
    return schema.type || schema;
  }

  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  const compressed: Record<string, any> = {};

  for (const [key, propSchema] of Object.entries(schema.properties)) {
    const prop = propSchema as any;
    let value: any = prop.type || 'unknown';

    // Handle nested objects recursively
    if (prop.type === 'object' && prop.properties) {
      value = compressJsonSchema(prop, depth + 1);
      if (required.has(key)) {
        // For nested objects, we can't append to the object, so wrap it
        compressed[key + ' (required)'] = value;
        continue;
      }
    }
    // Handle arrays with item types
    else if (prop.type === 'array' && prop.items) {
      if (prop.items.type === 'object' && prop.items.properties) {
        value = [compressJsonSchema(prop.items, depth + 1)];
      } else {
        value = `${prop.items.type || 'any'}[]`;
      }
    }
    // Handle enums
    else if (prop.enum) {
      value = prop.enum.map((v: any) => JSON.stringify(v)).join(' | ');
    }

    // Mark required fields (for non-object types)
    if (required.has(key) && typeof value === 'string') {
      value += ' (required)';
    }

    compressed[key] = value;
  }

  return compressed;
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

  // Normalize to a Set once so lookups are always O(1).
  // Bundlers can transform `new Set([...])` into a plain object or array,
  // so we accept all three forms and coerce up front.
  const stripSet =
    keysToStrip instanceof Set
      ? keysToStrip
      : new Set(Array.isArray(keysToStrip) ? keysToStrip : Object.keys(keysToStrip));

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

    // Handle objects with serializeForSpan() method - use their custom trace serialization
    if (typeof val.serializeForSpan === 'function') {
      try {
        return helper(val.serializeForSpan(), depth);
      } catch {
        // If serializeForSpan() fails, fall through to default object handling
      }
    }

    // Handle JSON Schema objects - compress to a more readable format
    // Pass the compressed result back through helper to apply size limits
    if (isJsonSchema(val)) {
      return helper(compressJsonSchema(val), depth);
    }

    // Handle objects - enforce key limit
    const cleaned: Record<string, any> = {};
    const entries = Object.entries(val);
    let keyCount = 0;

    for (const [key, v] of entries) {
      if (stripSet.has(key)) {
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
