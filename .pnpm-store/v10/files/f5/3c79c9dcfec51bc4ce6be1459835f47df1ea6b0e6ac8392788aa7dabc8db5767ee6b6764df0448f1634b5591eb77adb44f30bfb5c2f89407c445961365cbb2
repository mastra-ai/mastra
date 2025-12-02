"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapChunkedIndexOf = exports.wrapChunkedCall2 = exports.wrapChunkedCall1 = exports.isChunkedValid = exports.binarySearch = exports.sliceChunks = exports.computeChunkOffsets = exports.computeChunkNullCounts = exports.computeChunkNullable = exports.ChunkedIterator = void 0;
/** @ignore */
class ChunkedIterator {
    constructor(numChunks = 0, getChunkIterator) {
        this.numChunks = numChunks;
        this.getChunkIterator = getChunkIterator;
        this.chunkIndex = 0;
        this.chunkIterator = this.getChunkIterator(0);
    }
    next() {
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
exports.ChunkedIterator = ChunkedIterator;
/** @ignore */
function computeChunkNullable(chunks) {
    return chunks.some(chunk => chunk.nullable);
}
exports.computeChunkNullable = computeChunkNullable;
/** @ignore */
function computeChunkNullCounts(chunks) {
    return chunks.reduce((nullCount, chunk) => nullCount + chunk.nullCount, 0);
}
exports.computeChunkNullCounts = computeChunkNullCounts;
/** @ignore */
function computeChunkOffsets(chunks) {
    return chunks.reduce((offsets, chunk, index) => {
        offsets[index + 1] = offsets[index] + chunk.length;
        return offsets;
    }, new Uint32Array(chunks.length + 1));
}
exports.computeChunkOffsets = computeChunkOffsets;
/** @ignore */
function sliceChunks(chunks, offsets, begin, end) {
    const slices = [];
    for (let i = -1, n = chunks.length; ++i < n;) {
        const chunk = chunks[i];
        const offset = offsets[i];
        const { length } = chunk;
        // Stop if the child is to the right of the slice boundary
        if (offset >= end) {
            break;
        }
        // Exclude children to the left of of the slice boundary
        if (begin >= offset + length) {
            continue;
        }
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
exports.sliceChunks = sliceChunks;
/** @ignore */
function binarySearch(chunks, offsets, idx, fn) {
    let lhs = 0, mid = 0, rhs = offsets.length - 1;
    do {
        if (lhs >= rhs - 1) {
            return (idx < offsets[rhs]) ? fn(chunks, lhs, idx - offsets[lhs]) : null;
        }
        mid = lhs + (Math.trunc((rhs - lhs) * .5));
        idx < offsets[mid] ? (rhs = mid) : (lhs = mid);
    } while (lhs < rhs);
}
exports.binarySearch = binarySearch;
/** @ignore */
function isChunkedValid(data, index) {
    return data.getValid(index);
}
exports.isChunkedValid = isChunkedValid;
/** @ignore */
function wrapChunkedCall1(fn) {
    function chunkedFn(chunks, i, j) { return fn(chunks[i], j); }
    return function (index) {
        const data = this.data;
        return binarySearch(data, this._offsets, index, chunkedFn);
    };
}
exports.wrapChunkedCall1 = wrapChunkedCall1;
/** @ignore */
function wrapChunkedCall2(fn) {
    let _2;
    function chunkedFn(chunks, i, j) { return fn(chunks[i], j, _2); }
    return function (index, value) {
        const data = this.data;
        _2 = value;
        const result = binarySearch(data, this._offsets, index, chunkedFn);
        _2 = undefined;
        return result;
    };
}
exports.wrapChunkedCall2 = wrapChunkedCall2;
/** @ignore */
function wrapChunkedIndexOf(indexOf) {
    let _1;
    function chunkedIndexOf(data, chunkIndex, fromIndex) {
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
    return function (element, offset) {
        _1 = element;
        const data = this.data;
        const result = typeof offset !== 'number'
            ? chunkedIndexOf(data, 0, 0)
            : binarySearch(data, this._offsets, offset, chunkedIndexOf);
        _1 = undefined;
        return result;
    };
}
exports.wrapChunkedIndexOf = wrapChunkedIndexOf;

//# sourceMappingURL=chunk.js.map
