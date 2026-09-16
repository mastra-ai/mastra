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

const FUNCTION_KEYS_TO_STRIP = new Set(['execute', 'validate']);
const LOGGER_METHODS = ['debug', 'info', 'warn', 'error'];
/** Keys whose value decides the outcome in `shouldStripEntry()`. */
const VALUE_STRIP_KEYS = new Set(['logger', 'tracingContext', ...FUNCTION_KEYS_TO_STRIP]);

export interface DeepCleanOptions {
  keysToStrip: Set<string> | string[] | Record<string, unknown>;
  maxDepth: number;
  maxStringLength: number;
  maxArrayLength: number;
  maxObjectKeys: number;
}

export const DEFAULT_DEEP_CLEAN_OPTIONS: DeepCleanOptions = Object.freeze({
  keysToStrip: [],
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
    keysToStrip: DEFAULT_DEEP_CLEAN_OPTIONS.keysToStrip,
    maxDepth: userOptions.maxDepth ?? DEFAULT_DEEP_CLEAN_OPTIONS.maxDepth,
    maxStringLength: userOptions.maxStringLength ?? DEFAULT_DEEP_CLEAN_OPTIONS.maxStringLength,
    maxArrayLength: userOptions.maxArrayLength ?? DEFAULT_DEEP_CLEAN_OPTIONS.maxArrayLength,
    maxObjectKeys: userOptions.maxObjectKeys ?? DEFAULT_DEEP_CLEAN_OPTIONS.maxObjectKeys,
  };
}

/**
 * Hard-cap any string to prevent unbounded growth.
 *
 * The cut never splits a UTF-16 surrogate pair: if it would land immediately
 * after a lone high surrogate (U+D800..U+DBFF), it backs off one code unit so
 * the pair is dropped as a whole. `JSON.stringify` emits a lone `\ud83d` for a
 * split pair, which PostgreSQL rejects on a jsonb cast with 22P02
 * ("Unicode low surrogate must follow a high surrogate").
 */
export function truncateString(s: string, maxChars: number): string {
  if (s.length <= maxChars) {
    return s;
  }

  const code = s.charCodeAt(maxChars - 1);
  const safeEnd = code >= 0xd800 && code <= 0xdbff ? maxChars - 1 : maxChars;

  return s.slice(0, safeEnd) + '…[truncated]';
}

export type SerializedMapEntry = [keyType: string, key: any, value: any];

export interface SerializedMap {
  __type: 'Map';
  __map_entries: SerializedMapEntry[];
  __truncated?: string;
}

function formatSerializationError(error: unknown): string {
  return `[${error instanceof Error ? truncateString(error.message, 256) : 'unknown error'}]`;
}

function getMapKeyType(key: unknown): string {
  if (key === null) {
    return 'null';
  }
  if (key instanceof Date) {
    return 'date';
  }
  if (Array.isArray(key)) {
    return 'array';
  }
  if (key instanceof Map) {
    return 'map';
  }
  if (key instanceof Set) {
    return 'set';
  }
  if (key instanceof Error) {
    return 'error';
  }

  return typeof key;
}

function hasOnlyKnownKeys(value: Record<string, unknown>, keys: string[]): boolean {
  try {
    return Object.keys(value).every(key => keys.includes(key));
  } catch {
    return false;
  }
}

function isSpanLike(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const span = value as Record<string, unknown>;
  try {
    return (
      typeof span.id === 'string' &&
      typeof span.traceId === 'string' &&
      typeof span.type === 'string' &&
      typeof span.name === 'string'
    );
  } catch {
    return false;
  }
}

function isTracingContextLike(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const context = value as Record<string, unknown>;
  if (!hasOnlyKnownKeys(context, ['currentSpan'])) {
    return false;
  }

  try {
    return context.currentSpan === undefined || isSpanLike(context.currentSpan);
  } catch {
    return false;
  }
}

function isLoggerLike(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const logger = value as Record<string, unknown>;
  try {
    return LOGGER_METHODS.some(method => typeof logger[method] === 'function');
  } catch {
    return false;
  }
}

function shouldStripEntry(key: string, value: unknown, stripSet: Set<string>): boolean {
  if (stripSet.has(key)) {
    return true;
  }

  if (key === 'tracingContext' && isTracingContextLike(value)) {
    return true;
  }

  if (key === 'logger') {
    return typeof value === 'function' || isLoggerLike(value);
  }

  return FUNCTION_KEYS_TO_STRIP.has(key) && typeof value === 'function';
}

/**
 * Whether an entry past the object-key limit would have been stripped anyway.
 *
 * The entry is dropped either way, so the value is taken from its property descriptor
 * rather than read: a getter must not run for data that is being discarded. That keeps
 * the truncation count the same wherever a runtime-shaped key sits. An accessor cannot
 * be classified without invoking it, so it is left to the limit and counted.
 */
function wouldBeStripped(key: string, val: object, stripSet: Set<string>): boolean {
  if (!VALUE_STRIP_KEYS.has(key)) {
    return false;
  }

  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(val, key);
  } catch {
    return false;
  }

  if (!descriptor || !('value' in descriptor)) {
    return false;
  }

  return shouldStripEntry(key, descriptor.value, stripSet);
}

function restoreSerializedMapKey(keyType: string, key: any): unknown {
  switch (keyType) {
    case 'undefined':
      return undefined;
    case 'null':
      return null;
    case 'bigint':
      return typeof key === 'string' && key.endsWith('n') ? BigInt(key.slice(0, -1)) : key;
    case 'date':
      return typeof key === 'string' ? new Date(key) : key;
    default:
      return key;
  }
}

export function isSerializedMap(value: unknown): value is SerializedMap {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as SerializedMap).__type === 'Map' &&
    Array.isArray((value as SerializedMap).__map_entries)
  );
}

export function reconstructSerializedMap(value: SerializedMap): Map<unknown, unknown> {
  return new Map(
    value.__map_entries.map(([keyType, key, mapValue]) => [restoreSerializedMapKey(keyType, key), mapValue]),
  );
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

  // Track objects on the current ancestor path to detect true circular
  // references (A → B → A) without false-flagging shared references
  // (A → X, B → X).  A shared (non-circular) reference is simply
  // serialized again in each location where it appears.
  const ancestors = new WeakSet<any>();

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

    // Handle circular references — only flag when the same object is an
    // ancestor of the current node (true cycle), not merely seen elsewhere.
    if (typeof val === 'object') {
      if (ancestors.has(val)) {
        return '[Circular]';
      }
      ancestors.add(val);
    }

    try {
      // Handle Errors specially - preserve name, message, stack, and cause.
      // Done inside the try so the ancestor set is cleaned up in finally,
      // which also means cycles via `cause` are caught.
      if (val instanceof Error) {
        let errorName: unknown;
        let errorMessage: unknown;
        let errorStack: unknown;
        let rawCause: unknown;
        let causeReadFailed = false;

        try {
          errorName = val.name;
        } catch (error) {
          errorName = formatSerializationError(error);
        }

        try {
          errorMessage = val.message;
        } catch (error) {
          errorMessage = formatSerializationError(error);
        }

        try {
          errorStack = val.stack;
        } catch (error) {
          errorStack = formatSerializationError(error);
        }

        try {
          rawCause = (val as any).cause;
        } catch (error) {
          causeReadFailed = true;
          rawCause = formatSerializationError(error);
        }

        const cleanedError: Record<string, any> = {
          name: typeof errorName === 'string' ? truncateString(errorName, maxStringLength) : errorName,
          message: typeof errorMessage === 'string' ? truncateString(errorMessage, maxStringLength) : errorMessage,
        };
        if (typeof errorStack === 'string') {
          cleanedError.stack = truncateString(errorStack, maxStringLength);
        } else if (errorStack !== undefined) {
          cleanedError.stack = errorStack;
        }
        if (causeReadFailed) {
          cleanedError.cause = rawCause;
        } else if (rawCause !== undefined) {
          try {
            cleanedError.cause = helper(rawCause, depth + 1);
          } catch (error) {
            cleanedError.cause = formatSerializationError(error);
          }
        }
        return cleanedError;
      }

      // Handle Map - emit a tagged wrapper so key type/value identity is preserved.
      if (val instanceof Map) {
        const cleanedMap: SerializedMap = { __type: 'Map', __map_entries: [] };
        let mapKeyCount = 0;
        let omittedMapEntries = 0;
        for (const [mapKey, mapVal] of val) {
          if (typeof mapKey === 'string' && shouldStripEntry(mapKey, mapVal, stripSet)) {
            continue;
          }

          if (mapKeyCount >= maxObjectKeys) {
            omittedMapEntries++;
            continue;
          }

          const mapKeyType = getMapKeyType(mapKey);
          let cleanedMapKey: any;
          let cleanedMapValue: any;

          try {
            cleanedMapKey = helper(mapKey, depth + 1);
          } catch (error) {
            cleanedMapKey = formatSerializationError(error);
          }

          try {
            cleanedMapValue = helper(mapVal, depth + 1);
          } catch (error) {
            cleanedMapValue = formatSerializationError(error);
          }

          cleanedMap.__map_entries.push([mapKeyType, cleanedMapKey, cleanedMapValue]);
          mapKeyCount++;
        }
        if (omittedMapEntries > 0) {
          cleanedMap.__truncated = `${omittedMapEntries} more keys omitted`;
        }
        return cleanedMap;
      }

      // Handle Set - convert to an array.
      if (val instanceof Set) {
        const cleanedSet: any[] = [];
        let i = 0;
        const totalSetSize = val.size;
        for (const item of val) {
          if (i >= maxArrayLength) break;
          try {
            cleanedSet.push(helper(item, depth + 1));
          } catch (error) {
            cleanedSet.push(formatSerializationError(error));
          }
          i++;
        }
        if (totalSetSize > maxArrayLength) {
          cleanedSet.push(`[…${totalSetSize - maxArrayLength} more items]`);
        }
        return cleanedSet;
      }

      // Handle arrays - enforce length limit
      if (Array.isArray(val)) {
        const cleaned = [];

        for (let i = 0; i < Math.min(val.length, maxArrayLength); i++) {
          try {
            cleaned.push(helper(val[i], depth + 1));
          } catch (error) {
            cleaned.push(formatSerializationError(error));
          }
        }

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
      let serializeForSpan;
      try {
        serializeForSpan = val.serializeForSpan;
      } catch (error) {
        return `[serializeForSpan failed: ${error instanceof Error ? truncateString(error.message, 256) : 'unknown error'}]`;
      }

      if (typeof serializeForSpan === 'function') {
        try {
          return helper(serializeForSpan.call(val), depth);
        } catch (error) {
          return `[serializeForSpan failed: ${error instanceof Error ? truncateString(error.message, 256) : 'unknown error'}]`;
        }
      }

      // Handle JSON Schema objects - return as-is to preserve raw schemas for debugging.
      // JSON schemas are plain serializable objects (no circular refs, functions, etc.)
      // so we skip recursive traversal for performance.
      let looksLikeJsonSchema = false;
      try {
        looksLikeJsonSchema = isJsonSchema(val);
      } catch {
        looksLikeJsonSchema = false;
      }

      if (looksLikeJsonSchema) {
        return val;
      }

      // Handle objects - enforce key limit
      const cleaned: Record<string, any> = {};
      let keys: string[];
      try {
        keys = Object.keys(val);
      } catch (error) {
        return formatSerializationError(error);
      }
      let keyCount = 0;
      let omittedByLimit = 0;

      for (const key of keys) {
        if (stripSet.has(key)) {
          continue;
        }

        // Count what the limit actually drops; deriving it from `keys.length` would
        // report stripped keys as truncated.
        if (keyCount >= maxObjectKeys) {
          if (!wouldBeStripped(key, val, stripSet)) {
            omittedByLimit++;
          }
          continue;
        }

        let rawValue: unknown;
        try {
          rawValue = (val as Record<string, unknown>)[key];
        } catch (error) {
          cleaned[key] = formatSerializationError(error);
          keyCount++;
          continue;
        }

        if (shouldStripEntry(key, rawValue, stripSet)) {
          continue;
        }

        try {
          cleaned[key] = helper(rawValue, depth + 1);
          keyCount++;
        } catch (error) {
          cleaned[key] = formatSerializationError(error);
          keyCount++;
        }
      }

      if (omittedByLimit > 0) {
        cleaned['__truncated'] = `${omittedByLimit} more keys omitted`;
      }

      return cleaned;
    } finally {
      // Remove from ancestor set when leaving this node so parallel
      // branches can serialize the same shared reference independently.
      if (typeof val === 'object' && val !== null) {
        ancestors.delete(val);
      }
    }
  }

  return helper(value, 0);
}
