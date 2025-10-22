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

/**
 * Safely converts an unknown error to an Error instance.
 *
 * @param unknown - The value to convert to an Error
 * @param fallbackErrorMessage - Message to use if error cannot be parsed
 * @param maxDepth - Maximum depth for recursive cause parsing (default: 5)
 * @returns An Error instance, preserving the original if already an Error
 *
 * @example
 * // Preserves original Error
 * const err = new Error('test');
 * getErrorFromUnknown(err) === err; // true
 *
 * @example
 * // Converts object with custom properties
 * const apiError = { message: 'Failed', statusCode: 500 };
 * const err = getErrorFromUnknown(apiError);
 * err.message === 'Failed'; // true
 * err.statusCode === 500; // true
 */
export function getErrorFromUnknown(
  unknown: unknown,
  fallbackErrorMessage: string = 'Unknown error',
  maxDepth: number = 5,
): Error {
  if (unknown && unknown instanceof Error) {
    return unknown;
  }

  let error: Error | undefined;

  if (unknown && typeof unknown === 'object') {
    const errorMessage =
      unknown && 'message' in unknown && typeof unknown.message === 'string'
        ? unknown.message
        : safeParseErrorObject(unknown);

    // Only process cause if we haven't exceeded max depth
    const errorCause =
      'cause' in unknown && unknown.cause !== undefined
        ? unknown.cause instanceof Error
          ? unknown.cause
          : maxDepth > 0
            ? getErrorFromUnknown(unknown.cause, fallbackErrorMessage, maxDepth - 1)
            : undefined
        : undefined;

    error = new Error(errorMessage, { cause: errorCause });
    Object.assign(error as Error, unknown);
    return error;
  }

  if (unknown && typeof unknown === 'string') {
    error = new Error(unknown);
    return error;
  }

  if (!error) {
    error = new Error(fallbackErrorMessage);
  }
  return error;
}
