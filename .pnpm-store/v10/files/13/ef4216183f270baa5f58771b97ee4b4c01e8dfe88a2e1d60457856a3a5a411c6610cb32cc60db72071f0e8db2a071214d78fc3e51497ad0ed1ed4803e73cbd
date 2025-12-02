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
exports.compareArrayLike = exports.rebaseValueOffsets = exports.toUint8ClampedArrayAsyncIterator = exports.toFloat64ArrayAsyncIterator = exports.toFloat32ArrayAsyncIterator = exports.toUint32ArrayAsyncIterator = exports.toUint16ArrayAsyncIterator = exports.toUint8ArrayAsyncIterator = exports.toInt32ArrayAsyncIterator = exports.toInt16ArrayAsyncIterator = exports.toInt8ArrayAsyncIterator = exports.toArrayBufferViewAsyncIterator = exports.toUint8ClampedArrayIterator = exports.toFloat64ArrayIterator = exports.toFloat32ArrayIterator = exports.toUint32ArrayIterator = exports.toUint16ArrayIterator = exports.toUint8ArrayIterator = exports.toInt32ArrayIterator = exports.toInt16ArrayIterator = exports.toInt8ArrayIterator = exports.toArrayBufferViewIterator = exports.toUint8ClampedArray = exports.toFloat64Array = exports.toFloat32Array = exports.toBigUint64Array = exports.toUint32Array = exports.toUint16Array = exports.toUint8Array = exports.toBigInt64Array = exports.toInt32Array = exports.toInt16Array = exports.toInt8Array = exports.toArrayBufferView = exports.joinUint8Arrays = exports.memcpy = void 0;
const tslib_1 = require("tslib");
const utf8_js_1 = require("../util/utf8.js");
const compat_js_1 = require("./compat.js");
/** @ignore */
const SharedArrayBuf = (typeof SharedArrayBuffer !== 'undefined' ? SharedArrayBuffer : ArrayBuffer);
/** @ignore */
function collapseContiguousByteRanges(chunks) {
    const result = chunks[0] ? [chunks[0]] : [];
    let xOffset, yOffset, xLen, yLen;
    for (let x, y, i = 0, j = 0, n = chunks.length; ++i < n;) {
        x = result[j];
        y = chunks[i];
        // continue if x and y don't share the same underlying ArrayBuffer, or if x isn't before y
        if (!x || !y || x.buffer !== y.buffer || y.byteOffset < x.byteOffset) {
            y && (result[++j] = y);
            continue;
        }
        ({ byteOffset: xOffset, byteLength: xLen } = x);
        ({ byteOffset: yOffset, byteLength: yLen } = y);
        // continue if the byte ranges of x and y aren't contiguous
        if ((xOffset + xLen) < yOffset || (yOffset + yLen) < xOffset) {
            y && (result[++j] = y);
            continue;
        }
        result[j] = new Uint8Array(x.buffer, xOffset, yOffset - xOffset + yLen);
    }
    return result;
}
/** @ignore */
function memcpy(target, source, targetByteOffset = 0, sourceByteLength = source.byteLength) {
    const targetByteLength = target.byteLength;
    const dst = new Uint8Array(target.buffer, target.byteOffset, targetByteLength);
    const src = new Uint8Array(source.buffer, source.byteOffset, Math.min(sourceByteLength, targetByteLength));
    dst.set(src, targetByteOffset);
    return target;
}
exports.memcpy = memcpy;
/** @ignore */
function joinUint8Arrays(chunks, size) {
    // collapse chunks that share the same underlying ArrayBuffer and whose byte ranges overlap,
    // to avoid unnecessarily copying the bytes to do this buffer join. This is a common case during
    // streaming, where we may be reading partial byte ranges out of the same underlying ArrayBuffer
    const result = collapseContiguousByteRanges(chunks);
    const byteLength = result.reduce((x, b) => x + b.byteLength, 0);
    let source, sliced, buffer;
    let offset = 0, index = -1;
    const length = Math.min(size || Number.POSITIVE_INFINITY, byteLength);
    for (const n = result.length; ++index < n;) {
        source = result[index];
        sliced = source.subarray(0, Math.min(source.length, length - offset));
        if (length <= (offset + sliced.length)) {
            if (sliced.length < source.length) {
                result[index] = source.subarray(sliced.length);
            }
            else if (sliced.length === source.length) {
                index++;
            }
            buffer ? memcpy(buffer, sliced, offset) : (buffer = sliced);
            break;
        }
        memcpy(buffer || (buffer = new Uint8Array(length)), sliced, offset);
        offset += sliced.length;
    }
    return [buffer || new Uint8Array(0), result.slice(index), byteLength - (buffer ? buffer.byteLength : 0)];
}
exports.joinUint8Arrays = joinUint8Arrays;
/** @ignore */
function toArrayBufferView(ArrayBufferViewCtor, input) {
    let value = (0, compat_js_1.isIteratorResult)(input) ? input.value : input;
    if (value instanceof ArrayBufferViewCtor) {
        if (ArrayBufferViewCtor === Uint8Array) {
            // Node's `Buffer` class passes the `instanceof Uint8Array` check, but we need
            // a real Uint8Array, since Buffer#slice isn't the same as Uint8Array#slice :/
            return new ArrayBufferViewCtor(value.buffer, value.byteOffset, value.byteLength);
        }
        return value;
    }
    if (!value) {
        return new ArrayBufferViewCtor(0);
    }
    if (typeof value === 'string') {
        value = (0, utf8_js_1.encodeUtf8)(value);
    }
    if (value instanceof ArrayBuffer) {
        return new ArrayBufferViewCtor(value);
    }
    if (value instanceof SharedArrayBuf) {
        return new ArrayBufferViewCtor(value);
    }
    if ((0, compat_js_1.isFlatbuffersByteBuffer)(value)) {
        return toArrayBufferView(ArrayBufferViewCtor, value.bytes());
    }
    return !ArrayBuffer.isView(value) ? ArrayBufferViewCtor.from(value) : (value.byteLength <= 0 ? new ArrayBufferViewCtor(0)
        : new ArrayBufferViewCtor(value.buffer, value.byteOffset, value.byteLength / ArrayBufferViewCtor.BYTES_PER_ELEMENT));
}
exports.toArrayBufferView = toArrayBufferView;
/** @ignore */ const toInt8Array = (input) => toArrayBufferView(Int8Array, input);
exports.toInt8Array = toInt8Array;
/** @ignore */ const toInt16Array = (input) => toArrayBufferView(Int16Array, input);
exports.toInt16Array = toInt16Array;
/** @ignore */ const toInt32Array = (input) => toArrayBufferView(Int32Array, input);
exports.toInt32Array = toInt32Array;
/** @ignore */ const toBigInt64Array = (input) => toArrayBufferView(BigInt64Array, input);
exports.toBigInt64Array = toBigInt64Array;
/** @ignore */ const toUint8Array = (input) => toArrayBufferView(Uint8Array, input);
exports.toUint8Array = toUint8Array;
/** @ignore */ const toUint16Array = (input) => toArrayBufferView(Uint16Array, input);
exports.toUint16Array = toUint16Array;
/** @ignore */ const toUint32Array = (input) => toArrayBufferView(Uint32Array, input);
exports.toUint32Array = toUint32Array;
/** @ignore */ const toBigUint64Array = (input) => toArrayBufferView(BigUint64Array, input);
exports.toBigUint64Array = toBigUint64Array;
/** @ignore */ const toFloat32Array = (input) => toArrayBufferView(Float32Array, input);
exports.toFloat32Array = toFloat32Array;
/** @ignore */ const toFloat64Array = (input) => toArrayBufferView(Float64Array, input);
exports.toFloat64Array = toFloat64Array;
/** @ignore */ const toUint8ClampedArray = (input) => toArrayBufferView(Uint8ClampedArray, input);
exports.toUint8ClampedArray = toUint8ClampedArray;
/** @ignore */
const pump = (iterator) => { iterator.next(); return iterator; };
/** @ignore */
function* toArrayBufferViewIterator(ArrayCtor, source) {
    const wrap = function* (x) { yield x; };
    const buffers = (typeof source === 'string') ? wrap(source)
        : (ArrayBuffer.isView(source)) ? wrap(source)
            : (source instanceof ArrayBuffer) ? wrap(source)
                : (source instanceof SharedArrayBuf) ? wrap(source)
                    : !(0, compat_js_1.isIterable)(source) ? wrap(source) : source;
    yield* pump((function* (it) {
        let r = null;
        do {
            r = it.next(yield toArrayBufferView(ArrayCtor, r));
        } while (!r.done);
    })(buffers[Symbol.iterator]()));
    return new ArrayCtor();
}
exports.toArrayBufferViewIterator = toArrayBufferViewIterator;
/** @ignore */ const toInt8ArrayIterator = (input) => toArrayBufferViewIterator(Int8Array, input);
exports.toInt8ArrayIterator = toInt8ArrayIterator;
/** @ignore */ const toInt16ArrayIterator = (input) => toArrayBufferViewIterator(Int16Array, input);
exports.toInt16ArrayIterator = toInt16ArrayIterator;
/** @ignore */ const toInt32ArrayIterator = (input) => toArrayBufferViewIterator(Int32Array, input);
exports.toInt32ArrayIterator = toInt32ArrayIterator;
/** @ignore */ const toUint8ArrayIterator = (input) => toArrayBufferViewIterator(Uint8Array, input);
exports.toUint8ArrayIterator = toUint8ArrayIterator;
/** @ignore */ const toUint16ArrayIterator = (input) => toArrayBufferViewIterator(Uint16Array, input);
exports.toUint16ArrayIterator = toUint16ArrayIterator;
/** @ignore */ const toUint32ArrayIterator = (input) => toArrayBufferViewIterator(Uint32Array, input);
exports.toUint32ArrayIterator = toUint32ArrayIterator;
/** @ignore */ const toFloat32ArrayIterator = (input) => toArrayBufferViewIterator(Float32Array, input);
exports.toFloat32ArrayIterator = toFloat32ArrayIterator;
/** @ignore */ const toFloat64ArrayIterator = (input) => toArrayBufferViewIterator(Float64Array, input);
exports.toFloat64ArrayIterator = toFloat64ArrayIterator;
/** @ignore */ const toUint8ClampedArrayIterator = (input) => toArrayBufferViewIterator(Uint8ClampedArray, input);
exports.toUint8ClampedArrayIterator = toUint8ClampedArrayIterator;
/** @ignore */
function toArrayBufferViewAsyncIterator(ArrayCtor, source) {
    return tslib_1.__asyncGenerator(this, arguments, function* toArrayBufferViewAsyncIterator_1() {
        // if a Promise, unwrap the Promise and iterate the resolved value
        if ((0, compat_js_1.isPromise)(source)) {
            return yield tslib_1.__await(yield tslib_1.__await(yield* tslib_1.__asyncDelegator(tslib_1.__asyncValues(toArrayBufferViewAsyncIterator(ArrayCtor, yield tslib_1.__await(source))))));
        }
        const wrap = function (x) { return tslib_1.__asyncGenerator(this, arguments, function* () { yield yield tslib_1.__await(yield tslib_1.__await(x)); }); };
        const emit = function (source) {
            return tslib_1.__asyncGenerator(this, arguments, function* () {
                yield tslib_1.__await(yield* tslib_1.__asyncDelegator(tslib_1.__asyncValues(pump((function* (it) {
                    let r = null;
                    do {
                        r = it.next(yield r === null || r === void 0 ? void 0 : r.value);
                    } while (!r.done);
                })(source[Symbol.iterator]())))));
            });
        };
        const buffers = (typeof source === 'string') ? wrap(source) // if string, wrap in an AsyncIterableIterator
            : (ArrayBuffer.isView(source)) ? wrap(source) // if TypedArray, wrap in an AsyncIterableIterator
                : (source instanceof ArrayBuffer) ? wrap(source) // if ArrayBuffer, wrap in an AsyncIterableIterator
                    : (source instanceof SharedArrayBuf) ? wrap(source) // if SharedArrayBuffer, wrap in an AsyncIterableIterator
                        : (0, compat_js_1.isIterable)(source) ? emit(source) // If Iterable, wrap in an AsyncIterableIterator and compose the `next` values
                            : !(0, compat_js_1.isAsyncIterable)(source) ? wrap(source) // If not an AsyncIterable, treat as a sentinel and wrap in an AsyncIterableIterator
                                : source; // otherwise if AsyncIterable, use it
        yield tslib_1.__await(// otherwise if AsyncIterable, use it
        yield* tslib_1.__asyncDelegator(tslib_1.__asyncValues(pump((function (it) {
            return tslib_1.__asyncGenerator(this, arguments, function* () {
                let r = null;
                do {
                    r = yield tslib_1.__await(it.next(yield yield tslib_1.__await(toArrayBufferView(ArrayCtor, r))));
                } while (!r.done);
            });
        })(buffers[Symbol.asyncIterator]())))));
        return yield tslib_1.__await(new ArrayCtor());
    });
}
exports.toArrayBufferViewAsyncIterator = toArrayBufferViewAsyncIterator;
/** @ignore */ const toInt8ArrayAsyncIterator = (input) => toArrayBufferViewAsyncIterator(Int8Array, input);
exports.toInt8ArrayAsyncIterator = toInt8ArrayAsyncIterator;
/** @ignore */ const toInt16ArrayAsyncIterator = (input) => toArrayBufferViewAsyncIterator(Int16Array, input);
exports.toInt16ArrayAsyncIterator = toInt16ArrayAsyncIterator;
/** @ignore */ const toInt32ArrayAsyncIterator = (input) => toArrayBufferViewAsyncIterator(Int32Array, input);
exports.toInt32ArrayAsyncIterator = toInt32ArrayAsyncIterator;
/** @ignore */ const toUint8ArrayAsyncIterator = (input) => toArrayBufferViewAsyncIterator(Uint8Array, input);
exports.toUint8ArrayAsyncIterator = toUint8ArrayAsyncIterator;
/** @ignore */ const toUint16ArrayAsyncIterator = (input) => toArrayBufferViewAsyncIterator(Uint16Array, input);
exports.toUint16ArrayAsyncIterator = toUint16ArrayAsyncIterator;
/** @ignore */ const toUint32ArrayAsyncIterator = (input) => toArrayBufferViewAsyncIterator(Uint32Array, input);
exports.toUint32ArrayAsyncIterator = toUint32ArrayAsyncIterator;
/** @ignore */ const toFloat32ArrayAsyncIterator = (input) => toArrayBufferViewAsyncIterator(Float32Array, input);
exports.toFloat32ArrayAsyncIterator = toFloat32ArrayAsyncIterator;
/** @ignore */ const toFloat64ArrayAsyncIterator = (input) => toArrayBufferViewAsyncIterator(Float64Array, input);
exports.toFloat64ArrayAsyncIterator = toFloat64ArrayAsyncIterator;
/** @ignore */ const toUint8ClampedArrayAsyncIterator = (input) => toArrayBufferViewAsyncIterator(Uint8ClampedArray, input);
exports.toUint8ClampedArrayAsyncIterator = toUint8ClampedArrayAsyncIterator;
function rebaseValueOffsets(offset, length, valueOffsets) {
    // If we have a non-zero offset, create a new offsets array with the values
    // shifted by the start offset, such that the new start offset is 0
    if (offset !== 0) {
        valueOffsets = valueOffsets.slice(0, length);
        for (let i = -1, n = valueOffsets.length; ++i < n;) {
            valueOffsets[i] += offset;
        }
    }
    return valueOffsets.subarray(0, length);
}
exports.rebaseValueOffsets = rebaseValueOffsets;
/** @ignore */
function compareArrayLike(a, b) {
    let i = 0;
    const n = a.length;
    if (n !== b.length) {
        return false;
    }
    if (n > 0) {
        do {
            if (a[i] !== b[i]) {
                return false;
            }
        } while (++i < n);
    }
    return true;
}
exports.compareArrayLike = compareArrayLike;

//# sourceMappingURL=buffer.js.map
