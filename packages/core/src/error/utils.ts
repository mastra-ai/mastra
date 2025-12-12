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
 * Represents a serialized error structure for JSON output.
 */
export type SerializedError = {
  name: string;
  message: string;
  stack?: string;
  cause?: SerializedError | unknown;
} & Record<string, any>;

/**
 * An Error instance with a toJSON method for proper serialization.
 */
export type SerializableError = Error & {
  toJSON: () => SerializedError;
};

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
     * Whether to include the stack in JSON serialization.
     * The stack is always preserved on the Error instance for debugging.
     * This option only controls whether it appears in toJSON() output.
     * @default true
     */
    serializeStack?: boolean;
  } = {},
): SERIALIZABLE extends true ? SerializableError : Error {
  const defaultOptions = {
    fallbackMessage: 'Unknown error',
    maxDepth: 5,
    supportSerialization: true,
    serializeStack: true,
  };
  const mergedOptions = options ? { ...defaultOptions, ...options } : defaultOptions;
  const { fallbackMessage, maxDepth, supportSerialization, serializeStack } = mergedOptions;

  if (unknown && unknown instanceof Error) {
    // Stack is always preserved on the instance for debugging
    // serializeStack only controls whether it appears in toJSON() output
    if (supportSerialization) {
      addErrorToJSON(unknown, serializeStack, { maxDepth });
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

    Object.assign(error as Error, unknown);
    error.stack = 'stack' in unknown && typeof unknown.stack === 'string' ? unknown.stack : undefined;
  } else if (unknown && typeof unknown === 'string') {
    error = new Error(unknown);
    error.stack = undefined;
  } else {
    error = new Error(fallbackMessage);
  }

  if (supportSerialization) {
    addErrorToJSON(error, serializeStack, { maxDepth });
  }
  return error as SERIALIZABLE extends true ? SerializableError : Error;
}

const DEFAULT_MAX_DEPTH = 5;

/**
 * Adds a toJSON method to an Error instance for proper serialization.
 * Ensures that message, name, cause, and custom properties are all serialized.
 * Stack is only included in JSON output if serializeStack is true.
 * Recursively adds toJSON to the cause chain for proper nested error serialization.
 */
function addErrorToJSON(
  error: Error,
  serializeStack: boolean = true,
  options?: { maxDepth?: number; currentDepth?: number },
): void {
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
  const currentDepth = options?.currentDepth ?? 0;

  // Skip if error already has toJSON - preserves custom implementations
  // and avoids re-processing (first call's options win)
  if ((error as SerializableError).toJSON) {
    return;
  }

  // Recursively add toJSON to cause chain (with depth protection)
  if (error.cause instanceof Error && currentDepth < maxDepth) {
    addErrorToJSON(error.cause, serializeStack, { maxDepth, currentDepth: currentDepth + 1 });
  }

  // Define toJSON as non-enumerable to avoid interfering with object comparisons
  Object.defineProperty(error, 'toJSON', {
    value: function (this: Error) {
      const json: SerializedError = {
        message: this.message,
        name: this.name,
      };
      // Only include stack in JSON if serializeStack is true
      if (serializeStack && this.stack !== undefined) {
        json.stack = this.stack;
      }

      // Serialize cause if it's an Error and has a toJSON method, else include as is
      if (this.cause !== undefined) {
        if (this.cause instanceof Error && 'toJSON' in this.cause && typeof this.cause.toJSON === 'function') {
          json.cause = this.cause.toJSON();
        } else {
          json.cause = this.cause;
        }
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
