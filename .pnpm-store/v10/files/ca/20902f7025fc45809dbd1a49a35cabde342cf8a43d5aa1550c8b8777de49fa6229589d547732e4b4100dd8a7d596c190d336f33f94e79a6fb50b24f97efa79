/**
 * SHA2 hash function. A.k.a. sha256, sha384, sha512, sha512_224, sha512_256.
 * SHA256 is the fastest hash implementable in JS, even faster than Blake3.
 * Check out [RFC 4634](https://www.rfc-editor.org/rfc/rfc4634) and
 * [FIPS 180-4](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf).
 * @module
 */
import { HashMD } from './_md.ts';
import { type CHash } from './utils.ts';
/** Internal 32-byte base SHA2 hash class. */
declare abstract class SHA2_32B<T extends SHA2_32B<T>> extends HashMD<T> {
    protected abstract A: number;
    protected abstract B: number;
    protected abstract C: number;
    protected abstract D: number;
    protected abstract E: number;
    protected abstract F: number;
    protected abstract G: number;
    protected abstract H: number;
    constructor(outputLen: number);
    protected get(): [number, number, number, number, number, number, number, number];
    protected set(A: number, B: number, C: number, D: number, E: number, F: number, G: number, H: number): void;
    protected process(view: DataView, offset: number): void;
    protected roundClean(): void;
    destroy(): void;
}
/** Internal SHA2-256 hash class. */
export declare class _SHA256 extends SHA2_32B<_SHA256> {
    protected A: number;
    protected B: number;
    protected C: number;
    protected D: number;
    protected E: number;
    protected F: number;
    protected G: number;
    protected H: number;
    constructor();
}
/** Internal SHA2-224 hash class. */
export declare class _SHA224 extends SHA2_32B<_SHA224> {
    protected A: number;
    protected B: number;
    protected C: number;
    protected D: number;
    protected E: number;
    protected F: number;
    protected G: number;
    protected H: number;
    constructor();
}
/** Internal 64-byte base SHA2 hash class. */
declare abstract class SHA2_64B<T extends SHA2_64B<T>> extends HashMD<T> {
    protected abstract Ah: number;
    protected abstract Al: number;
    protected abstract Bh: number;
    protected abstract Bl: number;
    protected abstract Ch: number;
    protected abstract Cl: number;
    protected abstract Dh: number;
    protected abstract Dl: number;
    protected abstract Eh: number;
    protected abstract El: number;
    protected abstract Fh: number;
    protected abstract Fl: number;
    protected abstract Gh: number;
    protected abstract Gl: number;
    protected abstract Hh: number;
    protected abstract Hl: number;
    constructor(outputLen: number);
    protected get(): [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number
    ];
    protected set(Ah: number, Al: number, Bh: number, Bl: number, Ch: number, Cl: number, Dh: number, Dl: number, Eh: number, El: number, Fh: number, Fl: number, Gh: number, Gl: number, Hh: number, Hl: number): void;
    protected process(view: DataView, offset: number): void;
    protected roundClean(): void;
    destroy(): void;
}
/** Internal SHA2-512 hash class. */
export declare class _SHA512 extends SHA2_64B<_SHA512> {
    protected Ah: number;
    protected Al: number;
    protected Bh: number;
    protected Bl: number;
    protected Ch: number;
    protected Cl: number;
    protected Dh: number;
    protected Dl: number;
    protected Eh: number;
    protected El: number;
    protected Fh: number;
    protected Fl: number;
    protected Gh: number;
    protected Gl: number;
    protected Hh: number;
    protected Hl: number;
    constructor();
}
/** Internal SHA2-384 hash class. */
export declare class _SHA384 extends SHA2_64B<_SHA384> {
    protected Ah: number;
    protected Al: number;
    protected Bh: number;
    protected Bl: number;
    protected Ch: number;
    protected Cl: number;
    protected Dh: number;
    protected Dl: number;
    protected Eh: number;
    protected El: number;
    protected Fh: number;
    protected Fl: number;
    protected Gh: number;
    protected Gl: number;
    protected Hh: number;
    protected Hl: number;
    constructor();
}
/** Internal SHA2-512/224 hash class. */
export declare class _SHA512_224 extends SHA2_64B<_SHA512_224> {
    protected Ah: number;
    protected Al: number;
    protected Bh: number;
    protected Bl: number;
    protected Ch: number;
    protected Cl: number;
    protected Dh: number;
    protected Dl: number;
    protected Eh: number;
    protected El: number;
    protected Fh: number;
    protected Fl: number;
    protected Gh: number;
    protected Gl: number;
    protected Hh: number;
    protected Hl: number;
    constructor();
}
/** Internal SHA2-512/256 hash class. */
export declare class _SHA512_256 extends SHA2_64B<_SHA512_256> {
    protected Ah: number;
    protected Al: number;
    protected Bh: number;
    protected Bl: number;
    protected Ch: number;
    protected Cl: number;
    protected Dh: number;
    protected Dl: number;
    protected Eh: number;
    protected El: number;
    protected Fh: number;
    protected Fl: number;
    protected Gh: number;
    protected Gl: number;
    protected Hh: number;
    protected Hl: number;
    constructor();
}
/**
 * SHA2-256 hash function from RFC 4634. In JS it's the fastest: even faster than Blake3. Some info:
 *
 * - Trying 2^128 hashes would get 50% chance of collision, using birthday attack.
 * - BTC network is doing 2^70 hashes/sec (2^95 hashes/year) as per 2025.
 * - Each sha256 hash is executing 2^18 bit operations.
 * - Good 2024 ASICs can do 200Th/sec with 3500 watts of power, corresponding to 2^36 hashes/joule.
 */
export declare const sha256: CHash<_SHA256>;
/** SHA2-224 hash function from RFC 4634 */
export declare const sha224: CHash<_SHA224>;
/** SHA2-512 hash function from RFC 4634. */
export declare const sha512: CHash<_SHA512>;
/** SHA2-384 hash function from RFC 4634. */
export declare const sha384: CHash<_SHA384>;
/**
 * SHA2-512/256 "truncated" hash function, with improved resistance to length extension attacks.
 * See the paper on [truncated SHA512](https://eprint.iacr.org/2010/548.pdf).
 */
export declare const sha512_256: CHash<_SHA512_256>;
/**
 * SHA2-512/224 "truncated" hash function, with improved resistance to length extension attacks.
 * See the paper on [truncated SHA512](https://eprint.iacr.org/2010/548.pdf).
 */
export declare const sha512_224: CHash<_SHA512_224>;
export {};
//# sourceMappingURL=sha2.d.ts.map