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

type SerializableError = Error & { toJSON: () => Record<string, any> };

/**
 * Safely converts an unknown error to an Error instance.
 */
export function getErrorFromUnknown<SERIALIZABLE extends boolean = true>(
  unknown: unknown,
  options: {
    /**
     * The fallback error message to use if the unknown error cannot be parsed.
     */
    fallbackMessage?: string;
    /**
     * The maximum depth to parse the cause of the error.
     */
    maxDepth?: number;
    /**
     * Whether to add .toJSON() method to the error instance to support serialization. (JSON.stringify)
     * @example
     * const error = getErrorFromUnknown(new Error('test'), { supportSerialization: true });
     * JSON.stringify(error) // { message: 'test', name: 'Error', stack: 'Error: test\n    at ...' }
     */
    supportSerialization?: SERIALIZABLE;
    /**
     * Whether to include the stack of the error.
     */
    includeStack?: boolean;
  } = {},
): SERIALIZABLE extends true ? SerializableError : Error {
  const defaultOptions = {
    fallbackMessage: 'Unknown error',
    maxDepth: 5,
    supportSerialization: true,
    includeStack: true,
  };
  const mergedOptions = options ? { ...defaultOptions, ...options } : defaultOptions;
  const { fallbackMessage, maxDepth, supportSerialization, includeStack } = mergedOptions;

  if (unknown && unknown instanceof Error) {
    if (includeStack === false) {
      unknown.stack = undefined;
    }
    if (supportSerialization) {
      addErrorToJSON(unknown);
    }
    return unknown as SERIALIZABLE extends true ? SerializableError : Error;
  }

  let error: Error | undefined;

  if (unknown && typeof unknown === 'object') {
    const errorMessage =
      unknown && 'message' in unknown && typeof unknown.message === 'string'
        ? unknown.message
        : safeParseErrorObject(unknown);

    const errorCause =
      'cause' in unknown && unknown.cause !== undefined
        ? unknown.cause instanceof Error
          ? unknown.cause
          : maxDepth > 0 // Only process cause if we haven't exceeded max depth
            ? getErrorFromUnknown(unknown.cause, { ...mergedOptions, maxDepth: maxDepth - 1 })
            : undefined
        : undefined;

    error = new Error(errorMessage, errorCause ? { cause: errorCause } : undefined);

    const { stack: _, ...propsWithoutStack } = unknown as any;
    Object.assign(error as Error, propsWithoutStack);
    if (includeStack) {
      error.stack = 'stack' in unknown && typeof unknown.stack === 'string' ? unknown.stack : undefined;
    }
  } else if (unknown && typeof unknown === 'string') {
    error = new Error(unknown);
    error.stack = undefined;
  } else {
    error = new Error(fallbackMessage);
    error.stack = undefined;
  }

  if (supportSerialization) {
    addErrorToJSON(error);
  }
  return error as SERIALIZABLE extends true ? SerializableError : Error;
}

/**
 * Adds a toJSON method to an Error instance for proper serialization.
 * Ensures that message, name, stack, cause, and custom properties are all serialized.
 */
function addErrorToJSON(error: Error): void {
  if ((error as SerializableError).toJSON) {
    return;
  }

  // Define toJSON as non-enumerable to avoid interfering with object comparisons
  Object.defineProperty(error, 'toJSON', {
    value: function (this: Error) {
      const json: Record<string, any> = {
        message: this.message,
        name: this.name,
      };
      if (this.stack !== undefined) {
        json.stack = this.stack;
      }
      if (this.cause !== undefined) {
        json.cause = this.cause;
      }
      // Include all enumerable custom properties
      const errorAsAny = this as any;
      for (const key in errorAsAny) {
        if (errorAsAny.hasOwnProperty(key) && !(key in json) && key !== 'toJSON') {
          json[key] = errorAsAny[key];
        }
      }

      return json;
    },
    enumerable: false,
    writable: true,
    configurable: true,
  });
}
