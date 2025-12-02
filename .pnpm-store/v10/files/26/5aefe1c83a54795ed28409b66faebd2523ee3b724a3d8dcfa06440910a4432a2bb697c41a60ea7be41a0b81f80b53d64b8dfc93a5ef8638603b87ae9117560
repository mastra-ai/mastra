/**
 * WebCrypto-based AES gcm/ctr/cbc, `managedNonce` and `randomBytes`.
 * We use WebCrypto aka globalThis.crypto, which exists in browsers and node.js 16+.
 * @module
 */
import { type AsyncCipher } from './utils.ts';
/**
 * Internal webcrypto utils. Can be overridden of crypto.subtle is not present,
 * for example in React Native.
 */
export declare const utils: {
    encrypt: (key: Uint8Array, ...all: any[]) => Promise<Uint8Array>;
    decrypt: (key: Uint8Array, ...all: any[]) => Promise<Uint8Array>;
};
/** AES-CBC, native webcrypto version */
export declare const cbc: ((key: Uint8Array, iv: Uint8Array) => AsyncCipher) & {
    blockSize: number;
    nonceLength: number;
};
/** AES-CTR, native webcrypto version */
export declare const ctr: ((key: Uint8Array, nonce: Uint8Array) => AsyncCipher) & {
    blockSize: number;
    nonceLength: number;
};
/** AES-GCM, native webcrypto version */
export declare const gcm: ((key: Uint8Array, nonce: Uint8Array, AAD?: Uint8Array) => AsyncCipher) & {
    blockSize: number;
    nonceLength: number;
};
//# sourceMappingURL=webcrypto.d.ts.map