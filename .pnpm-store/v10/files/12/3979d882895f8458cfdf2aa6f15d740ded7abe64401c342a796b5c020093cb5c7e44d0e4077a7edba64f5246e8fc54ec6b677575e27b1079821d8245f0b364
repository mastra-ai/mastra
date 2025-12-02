/**
 * Utilities for hex, bytes, CSPRNG.
 * @module
 */
/*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) */
/** Checks if something is Uint8Array. Be careful: nodejs Buffer will return true. */
export declare function isBytes(a: unknown): a is Uint8Array;
/** Asserts something is positive integer. */
export declare function anumber(n: number, title?: string): void;
/** Asserts something is Uint8Array. */
export declare function abytes(value: Uint8Array, length?: number, title?: string): Uint8Array;
/** Asserts something is hash */
export declare function ahash(h: CHash): void;
/** Asserts a hash instance has not been destroyed / finished */
export declare function aexists(instance: any, checkFinished?: boolean): void;
/** Asserts output is properly-sized byte array */
export declare function aoutput(out: any, instance: any): void;
/** Generic type encompassing 8/16/32-byte arrays - but not 64-byte. */
export type TypedArray = Int8Array | Uint8ClampedArray | Uint8Array | Uint16Array | Int16Array | Uint32Array | Int32Array;
/** Cast u8 / u16 / u32 to u8. */
export declare function u8(arr: TypedArray): Uint8Array;
/** Cast u8 / u16 / u32 to u32. */
export declare function u32(arr: TypedArray): Uint32Array;
/** Zeroize a byte array. Warning: JS provides no guarantees. */
export declare function clean(...arrays: TypedArray[]): void;
/** Create DataView of an array for easy byte-level manipulation. */
export declare function createView(arr: TypedArray): DataView;
/** The rotate right (circular right shift) operation for uint32 */
export declare function rotr(word: number, shift: number): number;
/** The rotate left (circular left shift) operation for uint32 */
export declare function rotl(word: number, shift: number): number;
/** Is current platform little-endian? Most are. Big-Endian platform: IBM */
export declare const isLE: boolean;
/** The byte swap operation for uint32 */
export declare function byteSwap(word: number): number;
/** Conditionally byte swap if on a big-endian platform */
export declare const swap8IfBE: (n: number) => number;
/** In place byte swap for Uint32Array */
export declare function byteSwap32(arr: Uint32Array): Uint32Array;
export declare const swap32IfBE: (u: Uint32Array) => Uint32Array;
/**
 * Convert byte array to hex string. Uses built-in function, when available.
 * @example bytesToHex(Uint8Array.from([0xca, 0xfe, 0x01, 0x23])) // 'cafe0123'
 */
export declare function bytesToHex(bytes: Uint8Array): string;
/**
 * Convert hex string to byte array. Uses built-in function, when available.
 * @example hexToBytes('cafe0123') // Uint8Array.from([0xca, 0xfe, 0x01, 0x23])
 */
export declare function hexToBytes(hex: string): Uint8Array;
/**
 * There is no setImmediate in browser and setTimeout is slow.
 * Call of async fn will return Promise, which will be fullfiled only on
 * next scheduler queue processing step and this is exactly what we need.
 */
export declare const nextTick: () => Promise<void>;
/** Returns control to thread each 'tick' ms to avoid blocking. */
export declare function asyncLoop(iters: number, tick: number, cb: (i: number) => void): Promise<void>;
/**
 * Converts string to bytes using UTF8 encoding.
 * Built-in doesn't validate input to be string: we do the check.
 * @example utf8ToBytes('abc') // Uint8Array.from([97, 98, 99])
 */
export declare function utf8ToBytes(str: string): Uint8Array;
/** KDFs can accept string or Uint8Array for user convenience. */
export type KDFInput = string | Uint8Array;
/**
 * Helper for KDFs: consumes uint8array or string.
 * When string is passed, does utf8 decoding, using TextDecoder.
 */
export declare function kdfInputToBytes(data: KDFInput, errorTitle?: string): Uint8Array;
/** Copies several Uint8Arrays into one. */
export declare function concatBytes(...arrays: Uint8Array[]): Uint8Array;
type EmptyObj = {};
/** Merges default options and passed options. */
export declare function checkOpts<T1 extends EmptyObj, T2 extends EmptyObj>(defaults: T1, opts?: T2): T1 & T2;
/** Common interface for all hashes. */
export interface Hash<T> {
    blockLen: number;
    outputLen: number;
    update(buf: Uint8Array): this;
    digestInto(buf: Uint8Array): void;
    digest(): Uint8Array;
    destroy(): void;
    _cloneInto(to?: T): T;
    clone(): T;
}
/** PseudoRandom (number) Generator */
export interface PRG {
    addEntropy(seed: Uint8Array): void;
    randomBytes(length: number): Uint8Array;
    clean(): void;
}
/**
 * XOF: streaming API to read digest in chunks.
 * Same as 'squeeze' in keccak/k12 and 'seek' in blake3, but more generic name.
 * When hash used in XOF mode it is up to user to call '.destroy' afterwards, since we cannot
 * destroy state, next call can require more bytes.
 */
export type HashXOF<T extends Hash<T>> = Hash<T> & {
    xof(bytes: number): Uint8Array;
    xofInto(buf: Uint8Array): Uint8Array;
};
/** Hash constructor */
export type HasherCons<T, Opts = undefined> = Opts extends undefined ? () => T : (opts?: Opts) => T;
/** Optional hash params. */
export type HashInfo = {
    oid?: Uint8Array;
};
/** Hash function */
export type CHash<T extends Hash<T> = Hash<any>, Opts = undefined> = {
    outputLen: number;
    blockLen: number;
} & HashInfo & (Opts extends undefined ? {
    (msg: Uint8Array): Uint8Array;
    create(): T;
} : {
    (msg: Uint8Array, opts?: Opts): Uint8Array;
    create(opts?: Opts): T;
});
/** XOF with output */
export type CHashXOF<T extends HashXOF<T> = HashXOF<any>, Opts = undefined> = CHash<T, Opts>;
/** Creates function with outputLen, blockLen, create properties from a class constructor. */
export declare function createHasher<T extends Hash<T>, Opts = undefined>(hashCons: HasherCons<T, Opts>, info?: HashInfo): CHash<T, Opts>;
/** Cryptographically secure PRNG. Uses internal OS-level `crypto.getRandomValues`. */
export declare function randomBytes(bytesLength?: number): Uint8Array;
/** Creates OID opts for NIST hashes, with prefix 06 09 60 86 48 01 65 03 04 02. */
export declare const oidNist: (suffix: number) => Required<HashInfo>;
export {};
//# sourceMappingURL=utils.d.ts.map