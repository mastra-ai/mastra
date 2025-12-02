type Fetch = typeof fetch;
/**
 * Resolves the fetch implementation to use
 * Uses custom fetch if provided, otherwise falls back to:
 * - Native fetch in browser/modern environments
 * - @supabase/node-fetch polyfill in Node.js environments without fetch
 *
 * @param customFetch - Optional custom fetch implementation
 * @returns Resolved fetch function
 */
export declare const resolveFetch: (customFetch?: Fetch) => Fetch;
/**
 * Resolves the Response constructor to use
 * Uses native Response in browser/modern environments
 * Falls back to @supabase/node-fetch polyfill in Node.js environments
 *
 * @returns Response constructor
 */
export declare const resolveResponse: () => Promise<typeof Response>;
/**
 * Determine if input is a plain object
 * An object is plain if it's created by either {}, new Object(), or Object.create(null)
 *
 * @param value - Value to check
 * @returns True if value is a plain object
 * @source https://github.com/sindresorhus/is-plain-obj
 */
export declare const isPlainObject: (value: object) => boolean;
/**
 * Normalizes a number array to float32 format
 * Ensures all vector values are valid 32-bit floats
 *
 * @param values - Array of numbers to normalize
 * @returns Normalized float32 array
 */
export declare const normalizeToFloat32: (values: number[]) => number[];
/**
 * Validates vector dimensions match expected dimension
 * Throws error if dimensions don't match
 *
 * @param vector - Vector data to validate
 * @param expectedDimension - Expected vector dimension
 * @throws Error if dimensions don't match
 */
export declare const validateVectorDimension: (vector: {
    float32: number[];
}, expectedDimension?: number) => void;
export {};
//# sourceMappingURL=helpers.d.ts.map