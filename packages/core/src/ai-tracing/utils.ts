/**
 * Utility functions for cleaning and manipulating metadata objects
 * used in AI tracing and observability.
 */

export function sanitizeMetadata(metadata: Record<string, any> | undefined): Record<string, any> {
  /**
   * Removes non-serializable values from a metadata object.
   * @param metadata - An object with arbitrary values
   * @returns A new object with only serializable entries
   */
  if (!metadata) return {};
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (isSerializable(value)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function isSerializable(value: any): boolean {
  /**
   * Checks if a value can be safely JSON-stringified.
   * @param value - Any value
   * @returns true if serializable, false otherwise
   */
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
}

export function omitKeys<T extends Record<string, any>>(obj: T, keysToOmit: string[]): Partial<T> {
  /**
   * Removes specific keys from an object.
   * @param obj - The original object
   * @param keysToOmit - Keys to exclude from the returned object
   * @returns A new object with the specified keys removed
   */
  return Object.fromEntries(Object.entries(obj).filter(([key]) => !keysToOmit.includes(key))) as Partial<T>;
}
