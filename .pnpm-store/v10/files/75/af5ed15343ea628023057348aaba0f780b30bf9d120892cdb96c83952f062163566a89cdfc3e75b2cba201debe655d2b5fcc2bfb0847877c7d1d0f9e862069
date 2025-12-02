import type { IReader, IReaderResettable } from './types';
export declare class Reader implements IReader, IReaderResettable {
    uint8: Uint8Array;
    view: DataView;
    x: number;
    end: number;
    constructor(uint8?: Uint8Array, view?: DataView, x?: number, end?: number);
    reset(uint8: Uint8Array): void;
    size(): number;
    peek(): number;
    peak(): number;
    skip(length: number): void;
    buf(size?: number): Uint8Array;
    subarray(start?: number, end?: number): Uint8Array;
    slice(start?: number, end?: number): Reader;
    cut(size?: number): Reader;
    u8(): number;
    i8(): number;
    u16(): number;
    i16(): number;
    u32(): number;
    i32(): number;
    u64(): bigint;
    i64(): bigint;
    f32(): number;
    f64(): number;
    utf8(size: number): string;
    ascii(length: number): string;
}
