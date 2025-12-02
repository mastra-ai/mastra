import { type ARXCipher, type XorStream } from './utils.ts';
/**
 * hsalsa hashes key and nonce into key' and nonce' for salsa20.
 * Identical to `hsalsa_small`.
 * Need to find a way to merge it with `salsaCore` without 25% performance hit.
 */
export declare function hsalsa(s: Uint32Array, k: Uint32Array, i: Uint32Array, out: Uint32Array): void;
/**
 * Salsa20 from original paper. 12-byte nonce.
 * With smaller nonce, it's not safe to make it random (CSPRNG), due to collision chance.
 */
export declare const salsa20: XorStream;
/** xsalsa20 eXtended-nonce salsa. With 24-byte nonce, it's safe to make it random (CSPRNG). */
export declare const xsalsa20: XorStream;
/**
 * xsalsa20-poly1305 eXtended-nonce (24 bytes) salsa.
 * With 24-byte nonce, it's safe to make it random (CSPRNG).
 * Also known as `secretbox` from libsodium / nacl.
 */
export declare const xsalsa20poly1305: ARXCipher;
/**
 * Alias to `xsalsa20poly1305`, for compatibility with libsodium / nacl.
 * Check out [noble-sodium](https://github.com/serenity-kit/noble-sodium)
 * for `crypto_box`.
 */
export declare function secretbox(key: Uint8Array, nonce: Uint8Array): {
    seal: (plaintext: Uint8Array, output?: Uint8Array) => Uint8Array;
    open: (ciphertext: Uint8Array, output?: Uint8Array) => Uint8Array;
};
//# sourceMappingURL=salsa.d.ts.map