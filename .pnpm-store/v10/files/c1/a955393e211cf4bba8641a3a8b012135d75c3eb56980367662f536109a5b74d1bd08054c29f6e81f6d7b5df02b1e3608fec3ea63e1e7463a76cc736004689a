"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateVectorDimension = exports.normalizeToFloat32 = exports.isPlainObject = exports.resolveResponse = exports.resolveFetch = void 0;
const tslib_1 = require("tslib");
/**
 * Resolves the fetch implementation to use
 * Uses custom fetch if provided, otherwise falls back to:
 * - Native fetch in browser/modern environments
 * - @supabase/node-fetch polyfill in Node.js environments without fetch
 *
 * @param customFetch - Optional custom fetch implementation
 * @returns Resolved fetch function
 */
const resolveFetch = (customFetch) => {
    let _fetch;
    if (customFetch) {
        _fetch = customFetch;
    }
    else if (typeof fetch === 'undefined') {
        _fetch = (...args) => Promise.resolve(`${'@supabase/node-fetch'}`).then(s => tslib_1.__importStar(require(s))).then(({ default: fetch }) => fetch(...args));
    }
    else {
        _fetch = fetch;
    }
    return (...args) => _fetch(...args);
};
exports.resolveFetch = resolveFetch;
/**
 * Resolves the Response constructor to use
 * Uses native Response in browser/modern environments
 * Falls back to @supabase/node-fetch polyfill in Node.js environments
 *
 * @returns Response constructor
 */
const resolveResponse = () => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    if (typeof Response === 'undefined') {
        // @ts-ignore
        return (yield Promise.resolve(`${'@supabase/node-fetch'}`).then(s => tslib_1.__importStar(require(s)))).Response;
    }
    return Response;
});
exports.resolveResponse = resolveResponse;
/**
 * Determine if input is a plain object
 * An object is plain if it's created by either {}, new Object(), or Object.create(null)
 *
 * @param value - Value to check
 * @returns True if value is a plain object
 * @source https://github.com/sindresorhus/is-plain-obj
 */
const isPlainObject = (value) => {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return ((prototype === null ||
        prototype === Object.prototype ||
        Object.getPrototypeOf(prototype) === null) &&
        !(Symbol.toStringTag in value) &&
        !(Symbol.iterator in value));
};
exports.isPlainObject = isPlainObject;
/**
 * Normalizes a number array to float32 format
 * Ensures all vector values are valid 32-bit floats
 *
 * @param values - Array of numbers to normalize
 * @returns Normalized float32 array
 */
const normalizeToFloat32 = (values) => {
    // Use Float32Array to ensure proper precision
    return Array.from(new Float32Array(values));
};
exports.normalizeToFloat32 = normalizeToFloat32;
/**
 * Validates vector dimensions match expected dimension
 * Throws error if dimensions don't match
 *
 * @param vector - Vector data to validate
 * @param expectedDimension - Expected vector dimension
 * @throws Error if dimensions don't match
 */
const validateVectorDimension = (vector, expectedDimension) => {
    if (expectedDimension !== undefined && vector.float32.length !== expectedDimension) {
        throw new Error(`Vector dimension mismatch: expected ${expectedDimension}, got ${vector.float32.length}`);
    }
};
exports.validateVectorDimension = validateVectorDimension;
//# sourceMappingURL=helpers.js.map