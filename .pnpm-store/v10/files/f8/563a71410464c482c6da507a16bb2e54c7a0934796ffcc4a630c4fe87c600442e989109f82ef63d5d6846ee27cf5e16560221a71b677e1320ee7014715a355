/**
 * Utilities for hex, bytes, CSPRNG.
 * @module
 */
/*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) */
/** Checks if something is Uint8Array. Be careful: nodejs Buffer will return true. */
export function isBytes(a: unknown): a is Uint8Array {
  return a instanceof Uint8Array || (ArrayBuffer.isView(a) && a.constructor.name === 'Uint8Array');
}

/** Asserts something is positive integer. */
export function anumber(n: number, title: string = ''): void {
  if (!Number.isSafeInteger(n) || n < 0) {
    const prefix = title && `"${title}" `;
    throw new Error(`${prefix}expected integer >= 0, got ${n}`);
  }
}

/** Asserts something is Uint8Array. */
export function abytes(value: Uint8Array, length?: number, title: string = ''): Uint8Array {
  const bytes = isBytes(value);
  const len = value?.length;
  const needsLen = length !== undefined;
  if (!bytes || (needsLen && len !== length)) {
    const prefix = title && `"${title}" `;
    const ofLen = needsLen ? ` of length ${length}` : '';
    const got = bytes ? `length=${len}` : `type=${typeof value}`;
    throw new Error(prefix + 'expected Uint8Array' + ofLen + ', got ' + got);
  }
  return value;
}

/** Asserts something is hash */
export function ahash(h: CHash): void {
  if (typeof h !== 'function' || typeof h.create !== 'function')
    throw new Error('Hash must wrapped by utils.createHasher');
  anumber(h.outputLen);
  anumber(h.blockLen);
}

/** Asserts a hash instance has not been destroyed / finished */
export function aexists(instance: any, checkFinished = true): void {
  if (instance.destroyed) throw new Error('Hash instance has been destroyed');
  if (checkFinished && instance.finished) throw new Error('Hash#digest() has already been called');
}

/** Asserts output is properly-sized byte array */
export function aoutput(out: any, instance: any): void {
  abytes(out, undefined, 'digestInto() output');
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error('"digestInto() output" expected to be of length >=' + min);
  }
}

/** Generic type encompassing 8/16/32-byte arrays - but not 64-byte. */
// prettier-ignore
export type TypedArray = Int8Array | Uint8ClampedArray | Uint8Array |
  Uint16Array | Int16Array | Uint32Array | Int32Array;

/** Cast u8 / u16 / u32 to u8. */
export function u8(arr: TypedArray): Uint8Array {
  return new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
}

/** Cast u8 / u16 / u32 to u32. */
export function u32(arr: TypedArray): Uint32Array {
  return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
}

/** Zeroize a byte array. Warning: JS provides no guarantees. */
export function clean(...arrays: TypedArray[]): void {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}

/** Create DataView of an array for easy byte-level manipulation. */
export function createView(arr: TypedArray): DataView {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}

/** The rotate right (circular right shift) operation for uint32 */
export function rotr(word: number, shift: number): number {
  return (word << (32 - shift)) | (word >>> shift);
}

/** The rotate left (circular left shift) operation for uint32 */
export function rotl(word: number, shift: number): number {
  return (word << shift) | ((word >>> (32 - shift)) >>> 0);
}

/** Is current platform little-endian? Most are. Big-Endian platform: IBM */
export const isLE: boolean = /* @__PURE__ */ (() =>
  new Uint8Array(new Uint32Array([0x11223344]).buffer)[0] === 0x44)();

/** The byte swap operation for uint32 */
export function byteSwap(word: number): number {
  return (
    ((word << 24) & 0xff000000) |
    ((word << 8) & 0xff0000) |
    ((word >>> 8) & 0xff00) |
    ((word >>> 24) & 0xff)
  );
}
/** Conditionally byte swap if on a big-endian platform */
export const swap8IfBE: (n: number) => number = isLE
  ? (n: number) => n
  : (n: number) => byteSwap(n);

/** In place byte swap for Uint32Array */
export function byteSwap32(arr: Uint32Array): Uint32Array {
  for (let i = 0; i < arr.length; i++) {
    arr[i] = byteSwap(arr[i]);
  }
  return arr;
}

export const swap32IfBE: (u: Uint32Array) => Uint32Array = isLE
  ? (u: Uint32Array) => u
  : byteSwap32;

// Built-in hex conversion https://caniuse.com/mdn-javascript_builtins_uint8array_fromhex
const hasHexBuiltin: boolean = /* @__PURE__ */ (() =>
  // @ts-ignore
  typeof Uint8Array.from([]).toHex === 'function' && typeof Uint8Array.fromHex === 'function')();

// Array where index 0xf0 (240) is mapped to string 'f0'
const hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) =>
  i.toString(16).padStart(2, '0')
);

/**
 * Convert byte array to hex string. Uses built-in function, when available.
 * @example bytesToHex(Uint8Array.from([0xca, 0xfe, 0x01, 0x23])) // 'cafe0123'
 */
export function bytesToHex(bytes: Uint8Array): string {
  abytes(bytes);
  // @ts-ignore
  if (hasHexBuiltin) return bytes.toHex();
  // pre-caching improves the speed 6x
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += hexes[bytes[i]];
  }
  return hex;
}

// We use optimized technique to convert hex string to byte array
const asciis = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 } as const;
function asciiToBase16(ch: number): number | undefined {
  if (ch >= asciis._0 && ch <= asciis._9) return ch - asciis._0; // '2' => 50-48
  if (ch >= asciis.A && ch <= asciis.F) return ch - (asciis.A - 10); // 'B' => 66-(65-10)
  if (ch >= asciis.a && ch <= asciis.f) return ch - (asciis.a - 10); // 'b' => 98-(97-10)
  return;
}

/**
 * Convert hex string to byte array. Uses built-in function, when available.
 * @example hexToBytes('cafe0123') // Uint8Array.from([0xca, 0xfe, 0x01, 0x23])
 */
export function hexToBytes(hex: string): Uint8Array {
  if (typeof hex !== 'string') throw new Error('hex string expected, got ' + typeof hex);
  // @ts-ignore
  if (hasHexBuiltin) return Uint8Array.fromHex(hex);
  const hl = hex.length;
  const al = hl / 2;
  if (hl % 2) throw new Error('hex string expected, got unpadded hex of length ' + hl);
  const array = new Uint8Array(al);
  for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
    const n1 = asciiToBase16(hex.charCodeAt(hi));
    const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
    if (n1 === undefined || n2 === undefined) {
      const char = hex[hi] + hex[hi + 1];
      throw new Error('hex string expected, got non-hex character "' + char + '" at index ' + hi);
    }
    array[ai] = n1 * 16 + n2; // multiply first octet, e.g. 'a3' => 10*16+3 => 160 + 3 => 163
  }
  return array;
}

/**
 * There is no setImmediate in browser and setTimeout is slow.
 * Call of async fn will return Promise, which will be fullfiled only on
 * next scheduler queue processing step and this is exactly what we need.
 */
export const nextTick = async (): Promise<void> => {};

/** Returns control to thread each 'tick' ms to avoid blocking. */
export async function asyncLoop(
  iters: number,
  tick: number,
  cb: (i: number) => void
): Promise<void> {
  let ts = Date.now();
  for (let i = 0; i < iters; i++) {
    cb(i);
    // Date.now() is not monotonic, so in case if clock goes backwards we return return control too
    const diff = Date.now() - ts;
    if (diff >= 0 && diff < tick) continue;
    await nextTick();
    ts += diff;
  }
}

// Global symbols, but ts doesn't see them: https://github.com/microsoft/TypeScript/issues/31535
declare const TextEncoder: any;

/**
 * Converts string to bytes using UTF8 encoding.
 * Built-in doesn't validate input to be string: we do the check.
 * @example utf8ToBytes('abc') // Uint8Array.from([97, 98, 99])
 */
export function utf8ToBytes(str: string): Uint8Array {
  if (typeof str !== 'string') throw new Error('string expected');
  return new Uint8Array(new TextEncoder().encode(str)); // https://bugzil.la/1681809
}

/** KDFs can accept string or Uint8Array for user convenience. */
export type KDFInput = string | Uint8Array;

/**
 * Helper for KDFs: consumes uint8array or string.
 * When string is passed, does utf8 decoding, using TextDecoder.
 */
export function kdfInputToBytes(data: KDFInput, errorTitle = ''): Uint8Array {
  if (typeof data === 'string') return utf8ToBytes(data);
  return abytes(data, undefined, errorTitle);
}

/** Copies several Uint8Arrays into one. */
export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  let sum = 0;
  for (let i = 0; i < arrays.length; i++) {
    const a = arrays[i];
    abytes(a);
    sum += a.length;
  }
  const res = new Uint8Array(sum);
  for (let i = 0, pad = 0; i < arrays.length; i++) {
    const a = arrays[i];
    res.set(a, pad);
    pad += a.length;
  }
  return res;
}

type EmptyObj = {};
/** Merges default options and passed options. */
export function checkOpts<T1 extends EmptyObj, T2 extends EmptyObj>(
  defaults: T1,
  opts?: T2
): T1 & T2 {
  if (opts !== undefined && {}.toString.call(opts) !== '[object Object]')
    throw new Error('options must be object or undefined');
  const merged = Object.assign(defaults, opts);
  return merged as T1 & T2;
}

/** Common interface for all hashes. */
export interface Hash<T> {
  blockLen: number; // Bytes per block
  outputLen: number; // Bytes in output
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
  xof(bytes: number): Uint8Array; // Read 'bytes' bytes from digest stream
  xofInto(buf: Uint8Array): Uint8Array; // read buf.length bytes from digest stream into buf
};

/** Hash constructor */
export type HasherCons<T, Opts = undefined> = Opts extends undefined ? () => T : (opts?: Opts) => T;
/** Optional hash params. */
export type HashInfo = {
  oid?: Uint8Array; // DER encoded OID in bytes
};
/** Hash function */
export type CHash<T extends Hash<T> = Hash<any>, Opts = undefined> = {
  outputLen: number;
  blockLen: number;
} & HashInfo &
  (Opts extends undefined
    ? {
        (msg: Uint8Array): Uint8Array;
        create(): T;
      }
    : {
        (msg: Uint8Array, opts?: Opts): Uint8Array;
        create(opts?: Opts): T;
      });
/** XOF with output */
export type CHashXOF<T extends HashXOF<T> = HashXOF<any>, Opts = undefined> = CHash<T, Opts>;

/** Creates function with outputLen, blockLen, create properties from a class constructor. */
export function createHasher<T extends Hash<T>, Opts = undefined>(
  hashCons: HasherCons<T, Opts>,
  info: HashInfo = {}
): CHash<T, Opts> {
  const hashC: any = (msg: Uint8Array, opts?: Opts) => hashCons(opts).update(msg).digest();
  const tmp = hashCons(undefined);
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = (opts?: Opts) => hashCons(opts);
  Object.assign(hashC, info);
  return Object.freeze(hashC);
}

/** Cryptographically secure PRNG. Uses internal OS-level `crypto.getRandomValues`. */
export function randomBytes(bytesLength = 32): Uint8Array {
  const cr = typeof globalThis === 'object' ? (globalThis as any).crypto : null;
  if (typeof cr?.getRandomValues !== 'function')
    throw new Error('crypto.getRandomValues must be defined');
  return cr.getRandomValues(new Uint8Array(bytesLength));
}

/** Creates OID opts for NIST hashes, with prefix 06 09 60 86 48 01 65 03 04 02. */
export const oidNist = (suffix: number): Required<HashInfo> => ({
  oid: Uint8Array.from([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, suffix]),
});
