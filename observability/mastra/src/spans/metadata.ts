/**
 * Shared span-metadata helpers.
 *
 * Used by both the observability instance (`instances/base.ts`) and the span
 * base class (`spans/base.ts`) so the plain-record check and the
 * descriptor-preserving merge stay in a single place. Both feed the same span
 * metadata pipeline, so keeping one implementation avoids divergence.
 */

/**
 * Returns true only for plain object records (prototype is `Object.prototype`
 * or `null`). Maps, Dates, class instances, and arrays return false so callers
 * can preserve their original shape instead of shallow-copying them into `{}`.
 */
export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

/**
 * Returns `metadata` without own data properties whose value is `undefined`,
 * so callers can merge it without erasing keys another source provides.
 * Accessor properties are kept without invoking their getters. Non-plain
 * values are returned as-is; when nothing is stripped (or reflection on the
 * value throws) the original reference is returned.
 */
export function stripUndefined(metadata: Record<string, any> | undefined): Record<string, any> | undefined {
  if (!metadata || !isPlainRecord(metadata)) {
    return metadata;
  }

  try {
    const result: Record<string, any> = {};
    let stripped = false;
    for (const key of Reflect.ownKeys(metadata)) {
      const descriptor = Object.getOwnPropertyDescriptor(metadata, key)!;
      if ('value' in descriptor && descriptor.value === undefined) {
        stripped = true;
        continue;
      }
      Object.defineProperty(result, key, descriptor);
    }

    return stripped ? result : metadata;
  } catch {
    return metadata;
  }
}

/**
 * Merges two metadata values while preserving property descriptors (so getters
 * are copied as accessors rather than eagerly invoked). Only plain records are
 * merged; if either side is non-plain the second argument is returned as-is,
 * matching the previous per-module behavior.
 */
export function mergeMetadata(parentMetadata: unknown, metadata: unknown): Record<string, any> | undefined {
  if (!parentMetadata) {
    return metadata as Record<string, any> | undefined;
  }
  if (!metadata) {
    return parentMetadata as Record<string, any> | undefined;
  }
  if (!isPlainRecord(parentMetadata) || !isPlainRecord(metadata)) {
    return metadata as Record<string, any>;
  }

  try {
    const merged: Record<string, unknown> = {};
    Object.defineProperties(merged, Object.getOwnPropertyDescriptors(parentMetadata));
    Object.defineProperties(merged, Object.getOwnPropertyDescriptors(metadata));
    return merged;
  } catch {
    return metadata as Record<string, any>;
  }
}
