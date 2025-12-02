/**
 * Safely converts an object to a string representation.
 * Uses JSON.stringify first, but falls back to String() if:
 * - JSON.stringify fails (e.g., circular references)
 * - JSON.stringify returns "{}" (e.g., Error objects with no enumerable properties)
 */
export declare function safeParseErrorObject(obj: unknown): string;
type SerializableError = Error & {
    toJSON: () => Record<string, any>;
};
/**
 * Safely converts an unknown error to an Error instance.
 */
export declare function getErrorFromUnknown<SERIALIZABLE extends boolean = true>(unknown: unknown, options?: {
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
}): SERIALIZABLE extends true ? SerializableError : Error;
export {};
//# sourceMappingURL=utils.d.ts.map