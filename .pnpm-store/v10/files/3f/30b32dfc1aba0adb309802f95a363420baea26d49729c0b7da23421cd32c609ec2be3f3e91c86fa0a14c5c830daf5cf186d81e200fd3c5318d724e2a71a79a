/**
 * SHA3 (keccak) addons.
 *
 * * cSHAKE, KMAC, TupleHash, ParallelHash + XOF variants from
 *   [NIST SP 800-185](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-185.pdf)
 * * KangarooTwelve 🦘 and TurboSHAKE - reduced-round keccak from
 *   [k12-draft-17](https://datatracker.ietf.org/doc/draft-irtf-cfrg-kangarootwelve/17/)
 * * KeccakPRG: Pseudo-random generator based on Keccak [(pdf)](https://keccak.team/files/CSF-0.1.pdf)
 * @module
 */
import { Keccak, type ShakeOpts } from './sha3.ts';
import { type CHash, type CHashXOF, type Hash, type HashXOF, type KDFInput, type PRG } from './utils.ts';
export type cShakeOpts = ShakeOpts & {
    personalization?: Uint8Array;
    NISTfn?: KDFInput;
};
export type ITupleHash = {
    (messages: Uint8Array[], opts?: cShakeOpts): Uint8Array;
    create(opts?: cShakeOpts): _TupleHash;
};
/** 128-bit NIST cSHAKE XOF. */
export declare const cshake128: CHashXOF<Keccak, cShakeOpts>;
/** 256-bit NIST cSHAKE XOF. */
export declare const cshake256: CHashXOF<Keccak, cShakeOpts>;
/** Internal KMAC mac class. */
export declare class _KMAC extends Keccak implements HashXOF<_KMAC> {
    constructor(blockLen: number, outputLen: number, enableXOF: boolean, key: Uint8Array, opts?: cShakeOpts);
    protected finish(): void;
    _cloneInto(to?: _KMAC): _KMAC;
    clone(): _KMAC;
}
export type IKMAC = {
    (key: Uint8Array, message: Uint8Array, opts?: KangarooOpts): Uint8Array;
    create(key: Uint8Array, opts?: cShakeOpts): _KMAC;
};
/** 128-bit Keccak MAC. */
export declare const kmac128: IKMAC;
/** 256-bit Keccak MAC. */
export declare const kmac256: IKMAC;
/** 128-bit Keccak-MAC XOF. */
export declare const kmac128xof: IKMAC;
/** 256-bit Keccak-MAC XOF. */
export declare const kmac256xof: IKMAC;
/** Internal TupleHash class. */
export declare class _TupleHash extends Keccak implements HashXOF<_TupleHash> {
    constructor(blockLen: number, outputLen: number, enableXOF: boolean, opts?: cShakeOpts);
    protected finish(): void;
    _cloneInto(to?: _TupleHash): _TupleHash;
    clone(): _TupleHash;
}
/** 128-bit TupleHASH. tuple(['ab', 'cd']) != tuple(['a', 'bcd']) */
export declare const tuplehash128: ITupleHash;
/** 256-bit TupleHASH. tuple(['ab', 'cd']) != tuple(['a', 'bcd']) */
export declare const tuplehash256: ITupleHash;
/** 128-bit TupleHASH XOF. */
export declare const tuplehash128xof: ITupleHash;
/** 256-bit TupleHASH XOF. */
export declare const tuplehash256xof: ITupleHash;
type ParallelOpts = KangarooOpts & {
    blockLen?: number;
};
/** Internal Parallel Keccak Hash class. */
export declare class _ParallelHash extends Keccak implements HashXOF<_ParallelHash> {
    private leafHash?;
    protected leafCons: () => Hash<Keccak>;
    private chunkPos;
    private chunksDone;
    private chunkLen;
    constructor(blockLen: number, outputLen: number, leafCons: () => Hash<Keccak>, enableXOF: boolean, opts?: ParallelOpts);
    protected finish(): void;
    _cloneInto(to?: _ParallelHash): _ParallelHash;
    destroy(): void;
    clone(): _ParallelHash;
}
/** 128-bit ParallelHash. In JS, it is not parallel. */
export declare const parallelhash128: CHash<Keccak, ParallelOpts>;
/** 256-bit ParallelHash. In JS, it is not parallel. */
export declare const parallelhash256: CHash<Keccak, ParallelOpts>;
/** 128-bit ParallelHash XOF. In JS, it is not parallel. */
export declare const parallelhash128xof: CHashXOF<Keccak, ParallelOpts>;
/** 256-bit ParallelHash. In JS, it is not parallel. */
export declare const parallelhash256xof: CHashXOF<Keccak, ParallelOpts>;
/** D means Domain separation byte */
export type TurboshakeOpts = ShakeOpts & {
    D?: number;
};
/**
 * TurboSHAKE 128-bit: reduced 12-round keccak.
 * Should've been a simple "shake with 12 rounds", but we got a whole new spec about Turbo SHAKE Pro MAX.
 */
export declare const turboshake128: CHashXOF<Keccak, TurboshakeOpts>;
/** TurboSHAKE 256-bit: reduced 12-round keccak. */
export declare const turboshake256: CHashXOF<Keccak, TurboshakeOpts>;
/** K12 options. */
export type KangarooOpts = {
    dkLen?: number;
    personalization?: Uint8Array;
};
/** Internal K12 hash class. */
export declare class _KangarooTwelve extends Keccak implements HashXOF<_KangarooTwelve> {
    readonly chunkLen = 8192;
    private leafHash?;
    protected leafLen: number;
    private personalization;
    private chunkPos;
    private chunksDone;
    constructor(blockLen: number, leafLen: number, outputLen: number, rounds: number, opts: KangarooOpts);
    update(data: Uint8Array): this;
    protected finish(): void;
    destroy(): void;
    _cloneInto(to?: _KangarooTwelve): _KangarooTwelve;
    clone(): _KangarooTwelve;
}
/** 128-bit KangarooTwelve (k12): reduced 12-round keccak. */
export declare const kt128: CHash<_KangarooTwelve, KangarooOpts>;
/** 256-bit KangarooTwelve (k12): reduced 12-round keccak. */
export declare const kt256: CHash<_KangarooTwelve, KangarooOpts>;
/** KangarooTwelve-based MAC options. */
export type HopMAC = (key: Uint8Array, message: Uint8Array, personalization: Uint8Array, dkLen?: number) => Uint8Array;
/**
 * 128-bit KangarooTwelve-based MAC.
 *
 * These untested (there is no test vectors or implementation available). Use at your own risk.
 * HopMAC128(Key, M, C, L) = KT128(Key, KT128(M, C, 32), L)
 * HopMAC256(Key, M, C, L) = KT256(Key, KT256(M, C, 64), L)
 */
export declare const HopMAC128: HopMAC;
/** 256-bit KangarooTwelve-based MAC. */
export declare const HopMAC256: HopMAC;
/**
 * More at https://github.com/XKCP/XKCP/tree/master/lib/high/Keccak/PRG.
 */
export declare class _KeccakPRG extends Keccak implements PRG {
    protected rate: number;
    constructor(capacity: number);
    protected keccak(): void;
    update(data: Uint8Array): this;
    protected finish(): void;
    digestInto(_out: Uint8Array): Uint8Array;
    addEntropy(seed: Uint8Array): void;
    randomBytes(length: number): Uint8Array;
    clean(): void;
    _cloneInto(to?: _KeccakPRG): _KeccakPRG;
    clone(): _KeccakPRG;
}
/** KeccakPRG: Pseudo-random generator based on Keccak. https://keccak.team/files/CSF-0.1.pdf */
export declare const keccakprg: (capacity?: number) => _KeccakPRG;
export {};
//# sourceMappingURL=sha3-addons.d.ts.map