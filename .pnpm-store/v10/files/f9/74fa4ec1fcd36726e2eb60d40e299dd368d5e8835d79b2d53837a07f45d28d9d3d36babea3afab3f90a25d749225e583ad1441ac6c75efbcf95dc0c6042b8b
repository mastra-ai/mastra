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

import { encodeUtf8 } from '../util/utf8.js';
import { TypedArray, TypedArrayConstructor, BigIntArrayConstructor } from '../interfaces.js';
import { isPromise, isIterable, isAsyncIterable, isIteratorResult, isFlatbuffersByteBuffer } from './compat.js';
import { ByteBuffer } from 'flatbuffers';

/** @ignore */
const SharedArrayBuf = (typeof SharedArrayBuffer !== 'undefined' ? SharedArrayBuffer : ArrayBuffer);

/** @ignore */
function collapseContiguousByteRanges(chunks: Uint8Array[]) {
    const result = chunks[0] ? [chunks[0]] : [];
    let xOffset: number, yOffset: number, xLen: number, yLen: number;
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
export function memcpy<TTarget extends ArrayBufferView, TSource extends ArrayBufferView>(target: TTarget, source: TSource, targetByteOffset = 0, sourceByteLength = source.byteLength) {
    const targetByteLength = target.byteLength;
    const dst = new Uint8Array(target.buffer, target.byteOffset, targetByteLength);
    const src = new Uint8Array(source.buffer, source.byteOffset, Math.min(sourceByteLength, targetByteLength));
    dst.set(src, targetByteOffset);
    return target;
}

/** @ignore */
export function joinUint8Arrays(chunks: Uint8Array[], size?: number | null): [Uint8Array, Uint8Array[], number] {
    // collapse chunks that share the same underlying ArrayBuffer and whose byte ranges overlap,
    // to avoid unnecessarily copying the bytes to do this buffer join. This is a common case during
    // streaming, where we may be reading partial byte ranges out of the same underlying ArrayBuffer
    const result = collapseContiguousByteRanges(chunks);
    const byteLength = result.reduce((x, b) => x + b.byteLength, 0);
    let source: Uint8Array, sliced: Uint8Array, buffer: Uint8Array | undefined;
    let offset = 0, index = -1;
    const length = Math.min(size || Number.POSITIVE_INFINITY, byteLength);
    for (const n = result.length; ++index < n;) {
        source = result[index];
        sliced = source.subarray(0, Math.min(source.length, length - offset));
        if (length <= (offset + sliced.length)) {
            if (sliced.length < source.length) {
                result[index] = source.subarray(sliced.length);
            } else if (sliced.length === source.length) { index++; }
            buffer ? memcpy(buffer, sliced, offset) : (buffer = sliced);
            break;
        }
        memcpy(buffer || (buffer = new Uint8Array(length)), sliced, offset);
        offset += sliced.length;
    }
    return [buffer || new Uint8Array(0), result.slice(index), byteLength - (buffer ? buffer.byteLength : 0)];
}

/** @ignore */
export type ArrayBufferViewInput = ArrayBufferView | ArrayBufferLike | ArrayBufferView | Iterable<number> | Iterable<bigint> | ArrayLike<number> | ArrayLike<bigint> | ByteBuffer | string | null | undefined |
    IteratorResult<ArrayBufferView | ArrayBufferLike | ArrayBufferView | Iterable<number> | Iterable<bigint> | ArrayLike<number> | ArrayLike<bigint> | ByteBuffer | string | null | undefined> |
    ReadableStreamReadResult<ArrayBufferView | ArrayBufferLike | ArrayBufferView | Iterable<number> | Iterable<bigint> | ArrayLike<number> | ArrayLike<bigint> | ByteBuffer | string | null | undefined>;

/** @ignore */
export function toArrayBufferView<
    T extends TypedArrayConstructor<any> | BigIntArrayConstructor<any>
>(ArrayBufferViewCtor: any, input: ArrayBufferViewInput): InstanceType<T> {

    let value: any = isIteratorResult(input) ? input.value : input;

    if (value instanceof ArrayBufferViewCtor) {
        if (ArrayBufferViewCtor === Uint8Array) {
            // Node's `Buffer` class passes the `instanceof Uint8Array` check, but we need
            // a real Uint8Array, since Buffer#slice isn't the same as Uint8Array#slice :/
            return new ArrayBufferViewCtor(value.buffer, value.byteOffset, value.byteLength);
        }
        return value;
    }
    if (!value) { return new ArrayBufferViewCtor(0); }
    if (typeof value === 'string') { value = encodeUtf8(value); }
    if (value instanceof ArrayBuffer) { return new ArrayBufferViewCtor(value); }
    if (value instanceof SharedArrayBuf) { return new ArrayBufferViewCtor(value); }
    if (isFlatbuffersByteBuffer(value)) { return toArrayBufferView(ArrayBufferViewCtor, value.bytes()); }
    return !ArrayBuffer.isView(value) ? ArrayBufferViewCtor.from(value) : (value.byteLength <= 0 ? new ArrayBufferViewCtor(0)
        : new ArrayBufferViewCtor(value.buffer, value.byteOffset, value.byteLength / ArrayBufferViewCtor.BYTES_PER_ELEMENT));
}

/** @ignore */ export const toInt8Array = (input: ArrayBufferViewInput) => toArrayBufferView(Int8Array, input);
/** @ignore */ export const toInt16Array = (input: ArrayBufferViewInput) => toArrayBufferView(Int16Array, input);
/** @ignore */ export const toInt32Array = (input: ArrayBufferViewInput) => toArrayBufferView(Int32Array, input);
/** @ignore */ export const toBigInt64Array = (input: ArrayBufferViewInput) => toArrayBufferView(BigInt64Array, input);
/** @ignore */ export const toUint8Array = (input: ArrayBufferViewInput) => toArrayBufferView(Uint8Array, input);
/** @ignore */ export const toUint16Array = (input: ArrayBufferViewInput) => toArrayBufferView(Uint16Array, input);
/** @ignore */ export const toUint32Array = (input: ArrayBufferViewInput) => toArrayBufferView(Uint32Array, input);
/** @ignore */ export const toBigUint64Array = (input: ArrayBufferViewInput) => toArrayBufferView(BigUint64Array, input);
/** @ignore */ export const toFloat32Array = (input: ArrayBufferViewInput) => toArrayBufferView(Float32Array, input);
/** @ignore */ export const toFloat64Array = (input: ArrayBufferViewInput) => toArrayBufferView(Float64Array, input);
/** @ignore */ export const toUint8ClampedArray = (input: ArrayBufferViewInput) => toArrayBufferView(Uint8ClampedArray, input);

/** @ignore */
type ArrayBufferViewIteratorInput = Iterable<ArrayBufferViewInput> | ArrayBufferViewInput;

/** @ignore */
const pump = <T extends Iterator<any> | AsyncIterator<any>>(iterator: T) => { iterator.next(); return iterator; };

/** @ignore */
export function* toArrayBufferViewIterator<T extends TypedArray>(ArrayCtor: TypedArrayConstructor<T>, source: ArrayBufferViewIteratorInput) {
    const wrap = function*<T>(x: T) { yield x; };
    const buffers: Iterable<ArrayBufferViewInput> =
        (typeof source === 'string') ? wrap(source)
            : (ArrayBuffer.isView(source)) ? wrap(source)
                : (source instanceof ArrayBuffer) ? wrap(source)
                    : (source instanceof SharedArrayBuf) ? wrap(source)
                        : !isIterable<ArrayBufferViewInput>(source) ? wrap(source) : source;

    yield* pump((function* (it: Iterator<ArrayBufferViewInput, any, number | undefined>): Generator<T, void, number | undefined> {
        let r: IteratorResult<any> = <any>null;
        do {
            r = it.next(yield toArrayBufferView(ArrayCtor, r));
        } while (!r.done);
    })(buffers[Symbol.iterator]()));
    return new ArrayCtor();
}

/** @ignore */ export const toInt8ArrayIterator = (input: ArrayBufferViewIteratorInput) => toArrayBufferViewIterator(Int8Array, input);
/** @ignore */ export const toInt16ArrayIterator = (input: ArrayBufferViewIteratorInput) => toArrayBufferViewIterator(Int16Array, input);
/** @ignore */ export const toInt32ArrayIterator = (input: ArrayBufferViewIteratorInput) => toArrayBufferViewIterator(Int32Array, input);
/** @ignore */ export const toUint8ArrayIterator = (input: ArrayBufferViewIteratorInput) => toArrayBufferViewIterator(Uint8Array, input);
/** @ignore */ export const toUint16ArrayIterator = (input: ArrayBufferViewIteratorInput) => toArrayBufferViewIterator(Uint16Array, input);
/** @ignore */ export const toUint32ArrayIterator = (input: ArrayBufferViewIteratorInput) => toArrayBufferViewIterator(Uint32Array, input);
/** @ignore */ export const toFloat32ArrayIterator = (input: ArrayBufferViewIteratorInput) => toArrayBufferViewIterator(Float32Array, input);
/** @ignore */ export const toFloat64ArrayIterator = (input: ArrayBufferViewIteratorInput) => toArrayBufferViewIterator(Float64Array, input);
/** @ignore */ export const toUint8ClampedArrayIterator = (input: ArrayBufferViewIteratorInput) => toArrayBufferViewIterator(Uint8ClampedArray, input);

/** @ignore */
type ArrayBufferViewAsyncIteratorInput = AsyncIterable<ArrayBufferViewInput> | Iterable<ArrayBufferViewInput> | PromiseLike<ArrayBufferViewInput> | ArrayBufferViewInput;

/** @ignore */
export async function* toArrayBufferViewAsyncIterator<T extends TypedArray>(ArrayCtor: TypedArrayConstructor<T>, source: ArrayBufferViewAsyncIteratorInput): AsyncGenerator<T, T, number | undefined> {

    // if a Promise, unwrap the Promise and iterate the resolved value
    if (isPromise<ArrayBufferViewInput>(source)) {
        return yield* toArrayBufferViewAsyncIterator(ArrayCtor, await source);
    }

    const wrap = async function*<T>(x: T) { yield await x; };
    const emit = async function* <T extends Iterable<any>>(source: T) {
        yield* pump((function* (it: Iterator<any>) {
            let r: IteratorResult<any> = <any>null;
            do {
                r = it.next(yield r?.value);
            } while (!r.done);
        })(source[Symbol.iterator]()));
    };

    const buffers: AsyncIterable<ArrayBufferViewInput> =
        (typeof source === 'string') ? wrap(source) // if string, wrap in an AsyncIterableIterator
            : (ArrayBuffer.isView(source)) ? wrap(source) // if TypedArray, wrap in an AsyncIterableIterator
                : (source instanceof ArrayBuffer) ? wrap(source) // if ArrayBuffer, wrap in an AsyncIterableIterator
                    : (source instanceof SharedArrayBuf) ? wrap(source) // if SharedArrayBuffer, wrap in an AsyncIterableIterator
                        : isIterable<ArrayBufferViewInput>(source) ? emit(source) // If Iterable, wrap in an AsyncIterableIterator and compose the `next` values
                            : !isAsyncIterable<ArrayBufferViewInput>(source) ? wrap(source) // If not an AsyncIterable, treat as a sentinel and wrap in an AsyncIterableIterator
                                : source; // otherwise if AsyncIterable, use it

    yield* pump((async function* (it: AsyncIterator<ArrayBufferViewInput, any, number | undefined>): AsyncGenerator<T, void, number | undefined> {
        let r: IteratorResult<any> = <any>null;
        do {
            r = await it.next(yield toArrayBufferView(ArrayCtor, r));
        } while (!r.done);
    })(buffers[Symbol.asyncIterator]()));
    return new ArrayCtor();
}

/** @ignore */ export const toInt8ArrayAsyncIterator = (input: ArrayBufferViewAsyncIteratorInput) => toArrayBufferViewAsyncIterator(Int8Array, input);
/** @ignore */ export const toInt16ArrayAsyncIterator = (input: ArrayBufferViewAsyncIteratorInput) => toArrayBufferViewAsyncIterator(Int16Array, input);
/** @ignore */ export const toInt32ArrayAsyncIterator = (input: ArrayBufferViewAsyncIteratorInput) => toArrayBufferViewAsyncIterator(Int32Array, input);
/** @ignore */ export const toUint8ArrayAsyncIterator = (input: ArrayBufferViewAsyncIteratorInput) => toArrayBufferViewAsyncIterator(Uint8Array, input);
/** @ignore */ export const toUint16ArrayAsyncIterator = (input: ArrayBufferViewAsyncIteratorInput) => toArrayBufferViewAsyncIterator(Uint16Array, input);
/** @ignore */ export const toUint32ArrayAsyncIterator = (input: ArrayBufferViewAsyncIteratorInput) => toArrayBufferViewAsyncIterator(Uint32Array, input);
/** @ignore */ export const toFloat32ArrayAsyncIterator = (input: ArrayBufferViewAsyncIteratorInput) => toArrayBufferViewAsyncIterator(Float32Array, input);
/** @ignore */ export const toFloat64ArrayAsyncIterator = (input: ArrayBufferViewAsyncIteratorInput) => toArrayBufferViewAsyncIterator(Float64Array, input);
/** @ignore */ export const toUint8ClampedArrayAsyncIterator = (input: ArrayBufferViewAsyncIteratorInput) => toArrayBufferViewAsyncIterator(Uint8ClampedArray, input);

/** @ignore */
export function rebaseValueOffsets(offset: number, length: number, valueOffsets: Int32Array): Int32Array;
export function rebaseValueOffsets(offset: number, length: number, valueOffsets: BigInt64Array): BigInt64Array;
export function rebaseValueOffsets(offset: number, length: number, valueOffsets: any) {
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
export function compareArrayLike<T extends ArrayLike<any>>(a: T, b: T) {
    let i = 0;
    const n = a.length;
    if (n !== b.length) { return false; }
    if (n > 0) {
        do { if (a[i] !== b[i]) { return false; } } while (++i < n);
    }
    return true;
}
