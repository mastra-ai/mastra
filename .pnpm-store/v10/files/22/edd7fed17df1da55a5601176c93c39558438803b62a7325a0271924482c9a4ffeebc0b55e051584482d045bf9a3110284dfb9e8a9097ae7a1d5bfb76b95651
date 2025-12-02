import { type Cipher, type CipherWithOutput, type PRG } from './utils.ts';
/** Key expansion used in CTR. */
declare function expandKeyLE(key: Uint8Array): Uint32Array;
declare function expandKeyDecLE(key: Uint8Array): Uint32Array;
declare function encrypt(xk: Uint32Array, s0: number, s1: number, s2: number, s3: number): {
    s0: number;
    s1: number;
    s2: number;
    s3: number;
};
declare function decrypt(xk: Uint32Array, s0: number, s1: number, s2: number, s3: number): {
    s0: number;
    s1: number;
    s2: number;
    s3: number;
};
declare function ctrCounter(xk: Uint32Array, nonce: Uint8Array, src: Uint8Array, dst?: Uint8Array): Uint8Array;
declare function ctr32(xk: Uint32Array, isLE: boolean, nonce: Uint8Array, src: Uint8Array, dst?: Uint8Array): Uint8Array;
/**
 * **CTR** (Counter Mode): Turns a block cipher into a stream cipher using a counter and IV (nonce).
 * Efficient and parallelizable. Requires a unique nonce per encryption. Unauthenticated: needs MAC.
 */
export declare const ctr: ((key: Uint8Array, nonce: Uint8Array) => CipherWithOutput) & {
    blockSize: number;
    nonceLength: number;
};
/** Options for ECB and CBC. */
export type BlockOpts = {
    disablePadding?: boolean;
};
/**
 * **ECB** (Electronic Codebook): Deterministic encryption; identical plaintext blocks yield
 * identical ciphertexts. Not secure due to pattern leakage.
 * See [AES Penguin](https://words.filippo.io/the-ecb-penguin/).
 */
export declare const ecb: ((key: Uint8Array, opts?: BlockOpts) => CipherWithOutput) & {
    blockSize: number;
};
/**
 * **CBC** (Cipher Block Chaining): Each plaintext block is XORed with the
 * previous block of ciphertext before encryption.
 * Hard to use: requires proper padding and an IV. Unauthenticated: needs MAC.
 */
export declare const cbc: ((key: Uint8Array, iv: Uint8Array, opts?: BlockOpts) => CipherWithOutput) & {
    blockSize: number;
    nonceLength: number;
};
/**
 * CFB: Cipher Feedback Mode. The input for the block cipher is the previous cipher output.
 * Unauthenticated: needs MAC.
 */
export declare const cfb: ((key: Uint8Array, iv: Uint8Array) => CipherWithOutput) & {
    blockSize: number;
    nonceLength: number;
};
/**
 * **GCM** (Galois/Counter Mode): Combines CTR mode with polynomial MAC. Efficient and widely used.
 * Not perfect:
 * a) conservative key wear-out is `2**32` (4B) msgs.
 * b) key wear-out under random nonces is even smaller: `2**23` (8M) messages for `2**-50` chance.
 * c) MAC can be forged: see Poly1305 documentation.
 */
export declare const gcm: ((key: Uint8Array, nonce: Uint8Array, AAD?: Uint8Array) => Cipher) & {
    blockSize: number;
    nonceLength: number;
    tagLength: number;
    varSizeNonce: true;
};
/**
 * **SIV** (Synthetic IV): GCM with nonce-misuse resistance.
 * Repeating nonces reveal only the fact plaintexts are identical.
 * Also suffers from GCM issues: key wear-out limits & MAC forging.
 * See [RFC 8452](https://www.rfc-editor.org/rfc/rfc8452).
 */
export declare const gcmsiv: ((key: Uint8Array, nonce: Uint8Array, AAD?: Uint8Array) => Cipher) & {
    blockSize: number;
    nonceLength: number;
    tagLength: number;
    varSizeNonce: true;
};
/**
 * AES-GCM-SIV, not AES-SIV.
 * This is legace name, use `gcmsiv` export instead.
 * @deprecated
 */
export declare const siv: typeof gcmsiv;
declare function encryptBlock(xk: Uint32Array, block: Uint8Array): Uint8Array;
declare function decryptBlock(xk: Uint32Array, block: Uint8Array): Uint8Array;
/**
 * AES-KW (key-wrap). Injects static IV into plaintext, adds counter, encrypts 6 times.
 * Reduces block size from 16 to 8 bytes.
 * For padded version, use aeskwp.
 * [RFC 3394](https://www.rfc-editor.org/rfc/rfc3394/),
 * [NIST.SP.800-38F](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-38F.pdf).
 */
export declare const aeskw: ((kek: Uint8Array) => Cipher) & {
    blockSize: number;
};
/**
 * AES-KW, but with padding and allows random keys.
 * Second u32 of IV is used as counter for length.
 * [RFC 5649](https://www.rfc-editor.org/rfc/rfc5649)
 */
export declare const aeskwp: ((kek: Uint8Array) => Cipher) & {
    blockSize: number;
};
declare class _AesCtrDRBG implements PRG {
    readonly blockLen: number;
    private key;
    private nonce;
    private state;
    private reseedCnt;
    constructor(keyLen: number, seed: Uint8Array, personalization?: Uint8Array);
    private update;
    addEntropy(seed: Uint8Array, info?: Uint8Array): void;
    randomBytes(len: number, info?: Uint8Array): Uint8Array;
    clean(): void;
}
export type AesCtrDrbg = (seed: Uint8Array, personalization?: Uint8Array) => _AesCtrDRBG;
/**
 * AES-CTR DRBG 128-bit - CSPRNG (cryptographically secure pseudorandom number generator).
 * It's best to limit usage to non-production, non-critical cases: for example, test-only.
 */
export declare const rngAesCtrDrbg128: AesCtrDrbg;
/**
 * AES-CTR DRBG 256-bit - CSPRNG (cryptographically secure pseudorandom number generator).
 * It's best to limit usage to non-production, non-critical cases: for example, test-only.
 */
export declare const rngAesCtrDrbg256: AesCtrDrbg;
/** Unsafe low-level internal methods. May change at any time. */
export declare const unsafe: {
    expandKeyLE: typeof expandKeyLE;
    expandKeyDecLE: typeof expandKeyDecLE;
    encrypt: typeof encrypt;
    decrypt: typeof decrypt;
    encryptBlock: typeof encryptBlock;
    decryptBlock: typeof decryptBlock;
    ctrCounter: typeof ctrCounter;
    ctr32: typeof ctr32;
};
export {};
//# sourceMappingURL=aes.d.ts.map