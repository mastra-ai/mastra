// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import { Data } from '../data.js';
import { DataType } from '../type.js';

/** @ignore */
export class ChunkedIterator<T extends DataType> implements IterableIterator<T['TValue'] | null> {
    private chunkIndex = 0;
    private chunkIterator: IterableIterator<T['TValue'] | null>;

    constructor(
        private numChunks: number = 0,
        private getChunkIterator: (chunkIndex: number) => IterableIterator<T['TValue'] | null>
    ) {
        this.chunkIterator = this.getChunkIterator(0);
    }

    next(): IteratorResult<T['TValue'] | null> {
        while (this.chunkIndex < this.numChunks) {
            const next = this.chunkIterator.next();

            if (!next.done) {
                return next;
            }

            if (++this.chunkIndex < this.numChunks) {
                this.chunkIterator = this.getChunkIterator(this.chunkIndex);
            }
        }

        return { done: true, value: null };
    }

    [Symbol.iterator]() {
        return this;
    }
}

/** @ignore */
export function computeChunkNullable<T extends DataType>(chunks: ReadonlyArray<Data<T>>) {
    return chunks.some(chunk => chunk.nullable);
}

/** @ignore */
export function computeChunkNullCounts<T extends DataType>(chunks: ReadonlyArray<Data<T>>) {
    return chunks.reduce((nullCount, chunk) => nullCount + chunk.nullCount, 0);
}

/** @ignore */
export function computeChunkOffsets<T extends DataType>(chunks: ReadonlyArray<Data<T>>) {
    return chunks.reduce((offsets, chunk, index) => {
        offsets[index + 1] = offsets[index] + chunk.length;
        return offsets;
    }, new Uint32Array(chunks.length + 1));
}

/** @ignore */
export function sliceChunks<T extends DataType>(chunks: ReadonlyArray<Data<T>>, offsets: Uint32Array | Array<number>, begin: number, end: number) {
    const slices: Data<T>[] = [];
    for (let i = -1, n = chunks.length; ++i < n;) {
        const chunk = chunks[i];
        const offset = offsets[i];
        const { length } = chunk;
        // Stop if the child is to the right of the slice boundary
        if (offset >= end) { break; }
        // Exclude children to the left of of the slice boundary
        if (begin >= offset + length) { continue; }
        // Include entire child if between both left and right boundaries
        if (offset >= begin && (offset + length) <= end) {
            slices.push(chunk);
            continue;
        }
        // Include the child slice that overlaps one of the slice boundaries
        const from = Math.max(0, begin - offset);
        const to = Math.min(end - offset, length);
        slices.push(chunk.slice(from, to - from));
    }
    if (slices.length === 0) {
        slices.push(chunks[0].slice(0, 0));
    }
    return slices;
}

/** @ignore */
export function binarySearch<
    T extends DataType,
    F extends (chunks: ReadonlyArray<Data<T>>, _1: number, _2: number) => any
>(chunks: ReadonlyArray<Data<T>>, offsets: Uint32Array | number[], idx: number, fn: F) {
    let lhs = 0, mid = 0, rhs = offsets.length - 1;
    do {
        if (lhs >= rhs - 1) {
            return (idx < offsets[rhs]) ? fn(chunks, lhs, idx - offsets[lhs]) : null;
        }
        mid = lhs + (Math.trunc((rhs - lhs) * .5));
        idx < offsets[mid] ? (rhs = mid) : (lhs = mid);
    } while (lhs < rhs);
}

/** @ignore */
export function isChunkedValid<T extends DataType>(data: Data<T>, index: number): boolean {
    return data.getValid(index);
}

/** @ignore */
export function wrapChunkedCall1<T extends DataType>(fn: (c: Data<T>, _1: number) => any) {
    function chunkedFn(chunks: ReadonlyArray<Data<T>>, i: number, j: number) { return fn(chunks[i], j); }
    return function (this: any, index: number) {
        const data = this.data as ReadonlyArray<Data<T>>;
        return binarySearch(data, this._offsets, index, chunkedFn);
    };
}

/** @ignore */
export function wrapChunkedCall2<T extends DataType>(fn: (c: Data<T>, _1: number, _2: any) => any) {
    let _2: any;
    function chunkedFn(chunks: ReadonlyArray<Data<T>>, i: number, j: number) { return fn(chunks[i], j, _2); }
    return function (this: any, index: number, value: any) {
        const data = this.data as ReadonlyArray<Data<T>>;
        _2 = value;
        const result = binarySearch(data, this._offsets, index, chunkedFn);
        _2 = undefined;
        return result;
    };
}

/** @ignore */
export function wrapChunkedIndexOf<T extends DataType>(indexOf: (c: Data<T>, e: T['TValue'], o?: number) => any) {
    let _1: any;
    function chunkedIndexOf(data: ReadonlyArray<Data<T>>, chunkIndex: number, fromIndex: number) {
        let begin = fromIndex, index = 0, total = 0;
        for (let i = chunkIndex - 1, n = data.length; ++i < n;) {
            const chunk = data[i];
            if (~(index = indexOf(chunk, _1, begin))) {
                return total + index;
            }
            begin = 0;
            total += chunk.length;
        }
        return -1;
    }
    return function (this: any, element: T['TValue'], offset?: number) {
        _1 = element;
        const data = this.data as ReadonlyArray<Data<T>>;
        const result = typeof offset !== 'number'
            ? chunkedIndexOf(data, 0, 0)
            : binarySearch(data, this._offsets, offset, chunkedIndexOf);
        _1 = undefined;
        return result;
    };
}
