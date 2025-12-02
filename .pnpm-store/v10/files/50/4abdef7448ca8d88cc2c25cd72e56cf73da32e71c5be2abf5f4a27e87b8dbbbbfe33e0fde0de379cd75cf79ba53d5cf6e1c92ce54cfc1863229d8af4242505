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
import { __asyncDelegator, __asyncGenerator, __asyncValues, __await } from "tslib";
import { encodeUtf8 } from '../util/utf8.mjs';
import { isPromise, isIterable, isAsyncIterable, isIteratorResult, isFlatbuffersByteBuffer } from './compat.mjs';
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
export function memcpy(target, source, targetByteOffset = 0, sourceByteLength = source.byteLength) {
    const targetByteLength = target.byteLength;
    const dst = new Uint8Array(target.buffer, target.byteOffset, targetByteLength);
    const src = new Uint8Array(source.buffer, source.byteOffset, Math.min(sourceByteLength, targetByteLength));
    dst.set(src, targetByteOffset);
    return target;
}
/** @ignore */
export function joinUint8Arrays(chunks, size) {
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
/** @ignore */
export function toArrayBufferView(ArrayBufferViewCtor, input) {
    let value = isIteratorResult(input) ? input.value : input;
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
        value = encodeUtf8(value);
    }
    if (value instanceof ArrayBuffer) {
        return new ArrayBufferViewCtor(value);
    }
    if (value instanceof SharedArrayBuf) {
        return new ArrayBufferViewCtor(value);
    }
    if (isFlatbuffersByteBuffer(value)) {
        return toArrayBufferView(ArrayBufferViewCtor, value.bytes());
    }
    return !ArrayBuffer.isView(value) ? ArrayBufferViewCtor.from(value) : (value.byteLength <= 0 ? new ArrayBufferViewCtor(0)
        : new ArrayBufferViewCtor(value.buffer, value.byteOffset, value.byteLength / ArrayBufferViewCtor.BYTES_PER_ELEMENT));
}
/** @ignore */ export const toInt8Array = (input) => toArrayBufferView(Int8Array, input);
/** @ignore */ export const toInt16Array = (input) => toArrayBufferView(Int16Array, input);
/** @ignore */ export const toInt32Array = (input) => toArrayBufferView(Int32Array, input);
/** @ignore */ export const toBigInt64Array = (input) => toArrayBufferView(BigInt64Array, input);
/** @ignore */ export const toUint8Array = (input) => toArrayBufferView(Uint8Array, input);
/** @ignore */ export const toUint16Array = (input) => toArrayBufferView(Uint16Array, input);
/** @ignore */ export const toUint32Array = (input) => toArrayBufferView(Uint32Array, input);
/** @ignore */ export const toBigUint64Array = (input) => toArrayBufferView(BigUint64Array, input);
/** @ignore */ export const toFloat32Array = (input) => toArrayBufferView(Float32Array, input);
/** @ignore */ export const toFloat64Array = (input) => toArrayBufferView(Float64Array, input);
/** @ignore */ export const toUint8ClampedArray = (input) => toArrayBufferView(Uint8ClampedArray, input);
/** @ignore */
const pump = (iterator) => { iterator.next(); return iterator; };
/** @ignore */
export function* toArrayBufferViewIterator(ArrayCtor, source) {
    const wrap = function* (x) { yield x; };
    const buffers = (typeof source === 'string') ? wrap(source)
        : (ArrayBuffer.isView(source)) ? wrap(source)
            : (source instanceof ArrayBuffer) ? wrap(source)
                : (source instanceof SharedArrayBuf) ? wrap(source)
                    : !isIterable(source) ? wrap(source) : source;
    yield* pump((function* (it) {
        let r = null;
        do {
            r = it.next(yield toArrayBufferView(ArrayCtor, r));
        } while (!r.done);
    })(buffers[Symbol.iterator]()));
    return new ArrayCtor();
}
/** @ignore */ export const toInt8ArrayIterator = (input) => toArrayBufferViewIterator(Int8Array, input);
/** @ignore */ export const toInt16ArrayIterator = (input) => toArrayBufferViewIterator(Int16Array, input);
/** @ignore */ export const toInt32ArrayIterator = (input) => toArrayBufferViewIterator(Int32Array, input);
/** @ignore */ export const toUint8ArrayIterator = (input) => toArrayBufferViewIterator(Uint8Array, input);
/** @ignore */ export const toUint16ArrayIterator = (input) => toArrayBufferViewIterator(Uint16Array, input);
/** @ignore */ export const toUint32ArrayIterator = (input) => toArrayBufferViewIterator(Uint32Array, input);
/** @ignore */ export const toFloat32ArrayIterator = (input) => toArrayBufferViewIterator(Float32Array, input);
/** @ignore */ export const toFloat64ArrayIterator = (input) => toArrayBufferViewIterator(Float64Array, input);
/** @ignore */ export const toUint8ClampedArrayIterator = (input) => toArrayBufferViewIterator(Uint8ClampedArray, input);
/** @ignore */
export function toArrayBufferViewAsyncIterator(ArrayCtor, source) {
    return __asyncGenerator(this, arguments, function* toArrayBufferViewAsyncIterator_1() {
        // if a Promise, unwrap the Promise and iterate the resolved value
        if (isPromise(source)) {
            return yield __await(yield __await(yield* __asyncDelegator(__asyncValues(toArrayBufferViewAsyncIterator(ArrayCtor, yield __await(source))))));
        }
        const wrap = function (x) { return __asyncGenerator(this, arguments, function* () { yield yield __await(yield __await(x)); }); };
        const emit = function (source) {
            return __asyncGenerator(this, arguments, function* () {
                yield __await(yield* __asyncDelegator(__asyncValues(pump((function* (it) {
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
                        : isIterable(source) ? emit(source) // If Iterable, wrap in an AsyncIterableIterator and compose the `next` values
                            : !isAsyncIterable(source) ? wrap(source) // If not an AsyncIterable, treat as a sentinel and wrap in an AsyncIterableIterator
                                : source; // otherwise if AsyncIterable, use it
        yield __await(// otherwise if AsyncIterable, use it
        yield* __asyncDelegator(__asyncValues(pump((function (it) {
            return __asyncGenerator(this, arguments, function* () {
                let r = null;
                do {
                    r = yield __await(it.next(yield yield __await(toArrayBufferView(ArrayCtor, r))));
                } while (!r.done);
            });
        })(buffers[Symbol.asyncIterator]())))));
        return yield __await(new ArrayCtor());
    });
}
/** @ignore */ export const toInt8ArrayAsyncIterator = (input) => toArrayBufferViewAsyncIterator(Int8Array, input);
/** @ignore */ export const toInt16ArrayAsyncIterator = (input) => toArrayBufferViewAsyncIterator(Int16Array, input);
/** @ignore */ export const toInt32ArrayAsyncIterator = (input) => toArrayBufferViewAsyncIterator(Int32Array, input);
/** @ignore */ export const toUint8ArrayAsyncIterator = (input) => toArrayBufferViewAsyncIterator(Uint8Array, input);
/** @ignore */ export const toUint16ArrayAsyncIterator = (input) => toArrayBufferViewAsyncIterator(Uint16Array, input);
/** @ignore */ export const toUint32ArrayAsyncIterator = (input) => toArrayBufferViewAsyncIterator(Uint32Array, input);
/** @ignore */ export const toFloat32ArrayAsyncIterator = (input) => toArrayBufferViewAsyncIterator(Float32Array, input);
/** @ignore */ export const toFloat64ArrayAsyncIterator = (input) => toArrayBufferViewAsyncIterator(Float64Array, input);
/** @ignore */ export const toUint8ClampedArrayAsyncIterator = (input) => toArrayBufferViewAsyncIterator(Uint8ClampedArray, input);
export function rebaseValueOffsets(offset, length, valueOffsets) {
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
/** @ignore */
export function compareArrayLike(a, b) {
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

//# sourceMappingURL=buffer.mjs.map
