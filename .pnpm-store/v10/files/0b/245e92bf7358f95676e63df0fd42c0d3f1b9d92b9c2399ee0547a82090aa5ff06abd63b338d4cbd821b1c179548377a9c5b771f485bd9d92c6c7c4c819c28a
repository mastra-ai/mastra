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
exports.OffsetsBufferBuilder = exports.BitmapBufferBuilder = exports.DataBufferBuilder = exports.BufferBuilder = void 0;
const buffer_js_1 = require("../util/buffer.js");
/** @ignore */
function roundLengthUpToNearest64Bytes(len, BPE) {
    const bytesMinus1 = Math.ceil(len) * BPE - 1;
    return ((bytesMinus1 - bytesMinus1 % 64 + 64) || 64) / BPE;
}
/** @ignore */
function resizeArray(arr, len = 0) {
    return arr.length >= len ?
        arr.subarray(0, len) :
        (0, buffer_js_1.memcpy)(new arr.constructor(len), arr, 0);
}
/** @ignore */
class BufferBuilder {
    constructor(bufferType, initialSize = 0, stride = 1) {
        this.length = Math.ceil(initialSize / stride);
        this.buffer = new bufferType(this.length);
        this.stride = stride;
        this.BYTES_PER_ELEMENT = bufferType.BYTES_PER_ELEMENT;
        this.ArrayType = bufferType;
    }
    get byteLength() {
        return Math.ceil(this.length * this.stride) * this.BYTES_PER_ELEMENT;
    }
    get reservedLength() { return this.buffer.length / this.stride; }
    get reservedByteLength() { return this.buffer.byteLength; }
    // @ts-ignore
    set(index, value) { return this; }
    append(value) { return this.set(this.length, value); }
    reserve(extra) {
        if (extra > 0) {
            this.length += extra;
            const stride = this.stride;
            const length = this.length * stride;
            const reserved = this.buffer.length;
            if (length >= reserved) {
                this._resize(reserved === 0
                    ? roundLengthUpToNearest64Bytes(length * 1, this.BYTES_PER_ELEMENT)
                    : roundLengthUpToNearest64Bytes(length * 2, this.BYTES_PER_ELEMENT));
            }
        }
        return this;
    }
    flush(length = this.length) {
        length = roundLengthUpToNearest64Bytes(length * this.stride, this.BYTES_PER_ELEMENT);
        const array = resizeArray(this.buffer, length);
        this.clear();
        return array;
    }
    clear() {
        this.length = 0;
        this.buffer = new this.ArrayType();
        return this;
    }
    _resize(newLength) {
        return this.buffer = resizeArray(this.buffer, newLength);
    }
}
exports.BufferBuilder = BufferBuilder;
/** @ignore */
class DataBufferBuilder extends BufferBuilder {
    last() { return this.get(this.length - 1); }
    get(index) { return this.buffer[index]; }
    set(index, value) {
        this.reserve(index - this.length + 1);
        this.buffer[index * this.stride] = value;
        return this;
    }
}
exports.DataBufferBuilder = DataBufferBuilder;
/** @ignore */
class BitmapBufferBuilder extends DataBufferBuilder {
    constructor() {
        super(Uint8Array, 0, 1 / 8);
        this.numValid = 0;
    }
    get numInvalid() { return this.length - this.numValid; }
    get(idx) { return this.buffer[idx >> 3] >> idx % 8 & 1; }
    set(idx, val) {
        const { buffer } = this.reserve(idx - this.length + 1);
        const byte = idx >> 3, bit = idx % 8, cur = buffer[byte] >> bit & 1;
        // If `val` is truthy and the current bit is 0, flip it to 1 and increment `numValid`.
        // If `val` is falsey and the current bit is 1, flip it to 0 and decrement `numValid`.
        val ? cur === 0 && ((buffer[byte] |= (1 << bit)), ++this.numValid)
            : cur === 1 && ((buffer[byte] &= ~(1 << bit)), --this.numValid);
        return this;
    }
    clear() {
        this.numValid = 0;
        return super.clear();
    }
}
exports.BitmapBufferBuilder = BitmapBufferBuilder;
/** @ignore */
class OffsetsBufferBuilder extends DataBufferBuilder {
    constructor(type) {
        super(type.OffsetArrayType, 1, 1);
    }
    append(value) {
        return this.set(this.length - 1, value);
    }
    set(index, value) {
        const offset = this.length - 1;
        const buffer = this.reserve(index - offset + 1).buffer;
        if (offset < index++ && offset >= 0) {
            buffer.fill(buffer[offset], offset, index);
        }
        buffer[index] = buffer[index - 1] + value;
        return this;
    }
    flush(length = this.length - 1) {
        if (length > this.length) {
            this.set(length - 1, this.BYTES_PER_ELEMENT > 4 ? BigInt(0) : 0);
        }
        return super.flush(length + 1);
    }
}
exports.OffsetsBufferBuilder = OffsetsBufferBuilder;

//# sourceMappingURL=buffer.js.map
