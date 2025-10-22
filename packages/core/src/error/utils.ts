/**
 * Safely converts an object to a string representation.
 * Uses JSON.stringify first, but falls back to String() if:
 * - JSON.stringify fails (e.g., circular references)
 * - JSON.stringify returns "{}" (e.g., Error objects with no enumerable properties)
 */
export function safeParseErrorObject(obj: unknown): string {
  if (typeof obj !== 'object' || obj === null) {
    return String(obj);
  }

  try {
    const stringified = JSON.stringify(obj);
    // If JSON.stringify returns "{}", fall back to String() for better representation
    if (stringified === '{}') {
      return String(obj);
    }
    return stringified;
  } catch {
    // Fallback to String() if JSON.stringify fails (e.g., circular references)
    return String(obj);
  }
}
