/**
 * Create a new farmhash based u32 for a string or an array of bytes.
 * Fingerprint value should be portable and stable across library versions
 * and platforms.
 */
export declare function fingerprint32(input: string | Uint8Array): number;
/**
 * Create a new farmhash based u64 for a string or an array of bytes.
 * Fingerprint value should be portable and stable across library versions
 * and platforms.
 */
export declare function fingerprint64(input: string | Uint8Array): bigint;
/**
 * Create a new farmhash based i64 for a string or an array of bytes.
 * Fingerprint value should be portable and stable across library versions
 * and platforms.
 *
 * This matches the format used by BigQuery's FARM_FINGERPRINT function.
 */
export declare function bigqueryFingerprint(input: string | Uint8Array): bigint;
/**
 * Create a new farmhash based u32 for an array of bytes. Hash value may
 * vary with library version.
 */
export declare function hash32(input: string | Uint8Array): number;
/**
 * Create a new farmhash based u32 for an array of bytes with a given seed.
 * Hash value may vary with library version.
 */
export declare function hash32WithSeed(input: string | Uint8Array, seed: number): number;
/**
 * Create a new farmhash based u64 for an array of bytes. Hash value may
 * vary with library version.
 */
export declare function hash64(input: string | Uint8Array): bigint;
/**
 * Create a new farmhash based u64 for an array of bytes with a given seed.
 * Hash value may vary with library version.
 */
export declare function hash64WithSeed(input: string | Uint8Array, seed: bigint): bigint;
