import { Data } from '../data.js';
import { DataType } from '../type.js';
/** @ignore */
export declare class ChunkedIterator<T extends DataType> implements IterableIterator<T['TValue'] | null> {
    private numChunks;
    private getChunkIterator;
    private chunkIndex;
    private chunkIterator;
    constructor(numChunks: number, getChunkIterator: (chunkIndex: number) => IterableIterator<T['TValue'] | null>);
    next(): IteratorResult<T['TValue'] | null>;
    [Symbol.iterator](): this;
}
/** @ignore */
export declare function computeChunkNullable<T extends DataType>(chunks: ReadonlyArray<Data<T>>): boolean;
/** @ignore */
export declare function computeChunkNullCounts<T extends DataType>(chunks: ReadonlyArray<Data<T>>): number;
/** @ignore */
export declare function computeChunkOffsets<T extends DataType>(chunks: ReadonlyArray<Data<T>>): Uint32Array;
/** @ignore */
export declare function sliceChunks<T extends DataType>(chunks: ReadonlyArray<Data<T>>, offsets: Uint32Array | Array<number>, begin: number, end: number): Data<T>[];
/** @ignore */
export declare function binarySearch<T extends DataType, F extends (chunks: ReadonlyArray<Data<T>>, _1: number, _2: number) => any>(chunks: ReadonlyArray<Data<T>>, offsets: Uint32Array | number[], idx: number, fn: F): any;
/** @ignore */
export declare function isChunkedValid<T extends DataType>(data: Data<T>, index: number): boolean;
/** @ignore */
export declare function wrapChunkedCall1<T extends DataType>(fn: (c: Data<T>, _1: number) => any): (this: any, index: number) => any;
/** @ignore */
export declare function wrapChunkedCall2<T extends DataType>(fn: (c: Data<T>, _1: number, _2: any) => any): (this: any, index: number, value: any) => any;
/** @ignore */
export declare function wrapChunkedIndexOf<T extends DataType>(indexOf: (c: Data<T>, e: T['TValue'], o?: number) => any): (this: any, element: T['TValue'], offset?: number) => any;
