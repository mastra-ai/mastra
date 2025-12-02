import { type Pbkdf2Opt } from './pbkdf2.ts';
import { type KDFInput } from './utils.ts';
export type WebHash = {
    (msg: Uint8Array): Promise<Uint8Array>;
    webCryptoName: string;
    outputLen: number;
    blockLen: number;
};
/** WebCrypto SHA1 (RFC 3174) legacy hash function. It was cryptographically broken. */
/** WebCrypto SHA2-256 hash function from RFC 4634. */
export declare const sha256: WebHash;
/** WebCrypto SHA2-384 hash function from RFC 4634. */
export declare const sha384: WebHash;
/** WebCrypto SHA2-512 hash function from RFC 4634. */
export declare const sha512: WebHash;
/**
 * WebCrypto HMAC: RFC2104 message authentication code.
 * @param hash - function that would be used e.g. sha256. Webcrypto version.
 * @param key - key which would be used to authenticate message
 * @param message - message
 * @example
 * ```js
 * import { hmac, sha256 } from '@noble/hashes/webcrypto.js';
 * const mac1 = await hmac(sha256, 'key', 'message');
 * ```
 */
export declare const hmac: {
    (hash: WebHash, key: Uint8Array, message: Uint8Array): Promise<Uint8Array>;
    create(hash: WebHash, key: Uint8Array): any;
};
/**
 * WebCrypto HKDF (RFC 5869): derive keys from an initial input.
 * Combines hkdf_extract + hkdf_expand in one step
 * @param hash - hash function that would be used (e.g. sha256). Webcrypto version.
 * @param ikm - input keying material, the initial key
 * @param salt - optional salt value (a non-secret random value)
 * @param info - optional context and application specific information (can be a zero-length string)
 * @param length - length of output keying material in bytes
 * @example
 * ```js
 * import { hkdf, sha256 } from '@noble/hashes/webcrypto.js';
 * import { randomBytes } from '@noble/hashes/utils.js';
 * const inputKey = randomBytes(32);
 * const salt = randomBytes(32);
 * const info = 'application-key';
 * const hk1w = await hkdf(sha256, inputKey, salt, info, 32);
 * ```
 */
export declare function hkdf(hash: WebHash, ikm: Uint8Array, salt: Uint8Array | undefined, info: Uint8Array | undefined, length: number): Promise<Uint8Array>;
/**
 * WebCrypto PBKDF2-HMAC: RFC 2898 key derivation function
 * @param hash - hash function that would be used e.g. sha256. Webcrypto version.
 * @param password - password from which a derived key is generated
 * @param salt - cryptographic salt
 * @param opts - {c, dkLen} where c is work factor and dkLen is output message size
 * @example
 * ```js
 * const key = await pbkdf2(sha256, 'password', 'salt', { dkLen: 32, c: Math.pow(2, 18) });
 * ```
 */
export declare function pbkdf2(hash: WebHash, password: KDFInput, salt: KDFInput, opts: Pbkdf2Opt): Promise<Uint8Array>;
//# sourceMappingURL=webcrypto.d.ts.map