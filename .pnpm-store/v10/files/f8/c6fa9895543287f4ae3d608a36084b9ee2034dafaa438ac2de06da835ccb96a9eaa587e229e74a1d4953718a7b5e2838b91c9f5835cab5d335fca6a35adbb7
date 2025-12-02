import { T as TypedArray } from './shared/utils.0ddb0a7a.cjs';

/**
 * Base32 encoding and decoding utility.
 */
declare const base32: {
    /**
     * Encodes data into a Base32 string.
     * @param data - The data to encode (ArrayBuffer, TypedArray, or string).
     * @param options - Encoding options.
     * @returns The Base32 encoded string.
     */
    encode(data: ArrayBuffer | TypedArray | string, options?: {
        padding?: boolean;
    }): string;
    /**
     * Decodes a Base32 string into a Uint8Array.
     * @param data - The Base32 encoded string or ArrayBuffer/TypedArray.
     * @returns The decoded Uint8Array.
     */
    decode(data: string | ArrayBuffer | TypedArray): Uint8Array;
};
/**
 * Base32hex encoding and decoding utility.
 */
declare const base32hex: {
    /**
     * Encodes data into a Base32hex string.
     * @param data - The data to encode (ArrayBuffer, TypedArray, or string).
     * @param options - Encoding options.
     * @returns The Base32hex encoded string.
     */
    encode(data: ArrayBuffer | TypedArray | string, options?: {
        padding?: boolean;
    }): string;
    /**
     * Decodes a Base32hex string into a Uint8Array.
     * @param data - The Base32hex encoded string.
     * @returns The decoded Uint8Array.
     */
    decode(data: string): Uint8Array;
};

export { base32, base32hex };
