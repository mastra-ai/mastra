import { type CHash, type Hash } from './utils.ts';
/** Blake hash options. dkLen is output length. key is used in MAC mode. salt is used in KDF mode. */
export type Blake2Opts = {
    dkLen?: number;
    key?: Uint8Array;
    salt?: Uint8Array;
    personalization?: Uint8Array;
};
/** Internal base class for BLAKE2. */
export declare abstract class _BLAKE2<T extends _BLAKE2<T>> implements Hash<T> {
    protected abstract compress(msg: Uint32Array, offset: number, isLast: boolean): void;
    protected abstract get(): number[];
    protected abstract set(...args: number[]): void;
    abstract destroy(): void;
    protected buffer: Uint8Array;
    protected buffer32: Uint32Array;
    protected finished: boolean;
    protected destroyed: boolean;
    protected length: number;
    protected pos: number;
    readonly blockLen: number;
    readonly outputLen: number;
    constructor(blockLen: number, outputLen: number);
    update(data: Uint8Array): this;
    digestInto(out: Uint8Array): void;
    digest(): Uint8Array;
    _cloneInto(to?: T): T;
    clone(): T;
}
/** Internal blake2b hash class. */
export declare class _BLAKE2b extends _BLAKE2<_BLAKE2b> {
    private v0l;
    private v0h;
    private v1l;
    private v1h;
    private v2l;
    private v2h;
    private v3l;
    private v3h;
    private v4l;
    private v4h;
    private v5l;
    private v5h;
    private v6l;
    private v6h;
    private v7l;
    private v7h;
    constructor(opts?: Blake2Opts);
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
    protected set(v0l: number, v0h: number, v1l: number, v1h: number, v2l: number, v2h: number, v3l: number, v3h: number, v4l: number, v4h: number, v5l: number, v5h: number, v6l: number, v6h: number, v7l: number, v7h: number): void;
    protected compress(msg: Uint32Array, offset: number, isLast: boolean): void;
    destroy(): void;
}
/**
 * Blake2b hash function. 64-bit. 1.5x slower than blake2s in JS.
 * @param msg - message that would be hashed
 * @param opts - dkLen output length, key for MAC mode, salt, personalization
 */
export declare const blake2b: CHash<_BLAKE2b, Blake2Opts>;
/** Internal type, 16 numbers. */
export type Num16 = {
    v0: number;
    v1: number;
    v2: number;
    v3: number;
    v4: number;
    v5: number;
    v6: number;
    v7: number;
    v8: number;
    v9: number;
    v10: number;
    v11: number;
    v12: number;
    v13: number;
    v14: number;
    v15: number;
};
/** BLAKE2-compress core method. */
export declare function compress(s: Uint8Array, offset: number, msg: Uint32Array, rounds: number, v0: number, v1: number, v2: number, v3: number, v4: number, v5: number, v6: number, v7: number, v8: number, v9: number, v10: number, v11: number, v12: number, v13: number, v14: number, v15: number): Num16;
/** Internal blake2s hash class. */
export declare class _BLAKE2s extends _BLAKE2<_BLAKE2s> {
    private v0;
    private v1;
    private v2;
    private v3;
    private v4;
    private v5;
    private v6;
    private v7;
    constructor(opts?: Blake2Opts);
    protected get(): [number, number, number, number, number, number, number, number];
    protected set(v0: number, v1: number, v2: number, v3: number, v4: number, v5: number, v6: number, v7: number): void;
    protected compress(msg: Uint32Array, offset: number, isLast: boolean): void;
    destroy(): void;
}
/**
 * Blake2s hash function. Focuses on 8-bit to 32-bit platforms. 1.5x faster than blake2b in JS.
 * @param msg - message that would be hashed
 * @param opts - dkLen output length, key for MAC mode, salt, personalization
 */
export declare const blake2s: CHash<_BLAKE2s, Blake2Opts>;
//# sourceMappingURL=blake2.d.ts.map