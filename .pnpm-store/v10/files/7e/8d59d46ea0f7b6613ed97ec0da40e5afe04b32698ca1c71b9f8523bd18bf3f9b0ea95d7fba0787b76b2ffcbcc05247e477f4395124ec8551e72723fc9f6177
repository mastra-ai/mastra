/**
 * GHash from AES-GCM and its little-endian "mirror image" Polyval from AES-SIV.
 *
 * Implemented in terms of GHash with conversion function for keys
 * GCM GHASH from
 * [NIST SP800-38d](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf),
 * SIV from
 * [RFC 8452](https://www.rfc-editor.org/rfc/rfc8452).
 *
 * GHASH   modulo: x^128 + x^7   + x^2   + x     + 1
 * POLYVAL modulo: x^128 + x^127 + x^126 + x^121 + 1
 *
 * @module
 */
import { type IHash2 } from './utils.ts';
/**
 * `mulX_POLYVAL(ByteReverse(H))` from spec
 * @param k mutated in place
 */
export declare function _toGHASHKey(k: Uint8Array): Uint8Array;
type Value = {
    s0: number;
    s1: number;
    s2: number;
    s3: number;
};
export declare class GHASH implements IHash2 {
    readonly blockLen: number;
    readonly outputLen: number;
    protected s0: number;
    protected s1: number;
    protected s2: number;
    protected s3: number;
    protected finished: boolean;
    protected t: Value[];
    private W;
    private windowSize;
    constructor(key: Uint8Array, expectedLength?: number);
    protected _updateBlock(s0: number, s1: number, s2: number, s3: number): void;
    update(data: Uint8Array): this;
    destroy(): void;
    digestInto(out: Uint8Array): Uint8Array;
    digest(): Uint8Array;
}
export declare class Polyval extends GHASH {
    constructor(key: Uint8Array, expectedLength?: number);
    update(data: Uint8Array): this;
    digestInto(out: Uint8Array): Uint8Array;
}
export type CHashPV = ReturnType<typeof wrapConstructorWithKey>;
declare function wrapConstructorWithKey<H extends IHash2>(hashCons: (key: Uint8Array, expectedLength?: number) => H): {
    (msg: Uint8Array, key: Uint8Array): Uint8Array;
    outputLen: number;
    blockLen: number;
    create(key: Uint8Array, expectedLength?: number): H;
};
/** GHash MAC for AES-GCM. */
export declare const ghash: CHashPV;
/** Polyval MAC for AES-SIV. */
export declare const polyval: CHashPV;
export {};
//# sourceMappingURL=_polyval.d.ts.map