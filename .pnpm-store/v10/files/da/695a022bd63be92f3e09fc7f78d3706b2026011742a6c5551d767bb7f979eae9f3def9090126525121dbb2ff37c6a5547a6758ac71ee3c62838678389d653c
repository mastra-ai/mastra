/**
 * Decodes a base64 string to a byte array.
 *
 * - ignores white-space, including line breaks and tabs
 * - allows inner padding (can decode concatenated base64 strings)
 * - does not require padding
 * - understands base64url encoding:
 *   "-" instead of "+",
 *   "_" instead of "/",
 *   no padding
 */
export declare function base64Decode(base64Str: string): Uint8Array<ArrayBuffer>;
/**
 * Encode a byte array to a base64 string.
 *
 * By default, this function uses the standard base64 encoding with padding.
 *
 * To encode without padding, use encoding = "std_raw".
 *
 * To encode with the URL encoding, use encoding = "url", which replaces the
 * characters +/ by their URL-safe counterparts -_, and omits padding.
 */
export declare function base64Encode(bytes: Uint8Array, encoding?: "std" | "std_raw" | "url"): string;
