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

import { Type } from './enum.js';
import { clampRange, wrapIndex } from './util/vector.js';
import { DataType, strideForType } from './type.js';
import { Data, makeData, DataProps } from './data.js';
import { BigIntArray, TypedArray, TypedArrayDataType } from './interfaces.js';

import {
    isChunkedValid,
    computeChunkOffsets,
    computeChunkNullable,
    computeChunkNullCounts,
    sliceChunks,
    wrapChunkedCall1,
    wrapChunkedCall2,
    wrapChunkedIndexOf,
} from './util/chunk.js';

import { instance as getVisitor } from './visitor/get.js';
import { instance as setVisitor } from './visitor/set.js';
import { instance as indexOfVisitor } from './visitor/indexof.js';
import { instance as iteratorVisitor } from './visitor/iterator.js';

// @ts-ignore
import type { vectorFromArray } from './factories.js';

export interface Vector<T extends DataType = any> {
    ///
    // Virtual properties for the TypeScript compiler.
    // These do not exist at runtime.
    ///
    readonly TType: T['TType'];
    readonly TArray: T['TArray'];
    readonly TValue: T['TValue'];

    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/isConcatSpreadable
     */
    [Symbol.isConcatSpreadable]: true;
}

const visitorsByTypeId = {} as { [typeId: number]: { get: any; set: any; indexOf: any } };
const vectorPrototypesByTypeId = {} as { [typeId: number]: any };

/**
 * Array-like data structure. Use the convenience method {@link makeVector} and {@link vectorFromArray} to create vectors.
 */
export class Vector<T extends DataType = any> {

    constructor(input: readonly (Data<T> | Vector<T>)[]) {
        const data: Data<T>[] = input[0] instanceof Vector
            ? (input as Vector<T>[]).flatMap(x => x.data)
            : input as Data<T>[];
        if (data.length === 0 || data.some((x) => !(x instanceof Data))) {
            throw new TypeError('Vector constructor expects an Array of Data instances.');
        }
        const type = data[0]?.type;
        switch (data.length) {
            case 0: this._offsets = [0]; break;
            case 1: {
                // special case for unchunked vectors
                const { get, set, indexOf } = visitorsByTypeId[type.typeId];
                const unchunkedData = data[0];

                this.isValid = (index: number) => isChunkedValid(unchunkedData, index);
                this.get = (index: number) => get(unchunkedData, index);
                this.set = (index: number, value: T) => set(unchunkedData, index, value);
                this.indexOf = (index: number) => indexOf(unchunkedData, index);
                this._offsets = [0, unchunkedData.length];
                break;
            }
            default:
                Object.setPrototypeOf(this, vectorPrototypesByTypeId[type.typeId]);
                this._offsets = computeChunkOffsets(data);
                break;
        }
        this.data = data;
        this.type = type;
        this.stride = strideForType(type);
        this.numChildren = type.children?.length ?? 0;
        this.length = this._offsets.at(-1)!;
    }

    declare protected _offsets: number[] | Uint32Array;

    /**
     * The {@link DataType `DataType`} of this Vector.
     */
    public declare readonly type: T;

    /**
     * The primitive {@link Data `Data`} instances for this Vector's elements.
     */
    public declare readonly data: ReadonlyArray<Data<T>>;

    /**
     * The number of elements in this Vector.
     */
    public declare readonly length: number;

    /**
     * The number of primitive values per Vector element.
     */
    public declare readonly stride: number;

    /**
     * The number of child Vectors if this Vector is a nested dtype.
     */
    public declare readonly numChildren: number;

    /**
     * The aggregate size (in bytes) of this Vector's buffers and/or child Vectors.
     */
    public get byteLength() {
        return this.data.reduce((byteLength, data) => byteLength + data.byteLength, 0);
    }

    /**
     * Whether this Vector's elements can contain null values.
     */
    public get nullable() {
        return computeChunkNullable(this.data);
    }

    /**
     * The number of null elements in this Vector.
     */
    public get nullCount() {
        return computeChunkNullCounts(this.data);
    }

    /**
     * The Array or TypedArray constructor used for the JS representation
     *  of the element's values in {@link Vector.prototype.toArray `toArray()`}.
     */
    public get ArrayType(): T['ArrayType'] { return this.type.ArrayType; }

    /**
     * The name that should be printed when the Vector is logged in a message.
     */
    public get [Symbol.toStringTag]() {
        return `${this.VectorName}<${this.type[Symbol.toStringTag]}>`;
    }

    /**
     * The name of this Vector.
     */
    public get VectorName() { return `${Type[this.type.typeId]}Vector`; }

    /**
     * Check whether an element is null.
     * @param index The index at which to read the validity bitmap.
     */
    // @ts-ignore
    public isValid(index: number): boolean { return false; }

    /**
     * Get an element value by position.
     * @param index The index of the element to read.
     */
    // @ts-ignore
    public get(index: number): T['TValue'] | null { return null; }

    /**
     * Get an element value by position.
     * @param index The index of the element to read. A negative index will count back from the last element.
     */
    public at(index: number): T['TValue'] | null {
        return this.get(wrapIndex(index, this.length));
    }

    /**
     * Set an element value by position.
     * @param index The index of the element to write.
     * @param value The value to set.
     */
    // @ts-ignore
    public set(index: number, value: T['TValue'] | null): void { return; }

    /**
     * Retrieve the index of the first occurrence of a value in an Vector.
     * @param element The value to locate in the Vector.
     * @param offset The index at which to begin the search. If offset is omitted, the search starts at index 0.
     */
    // @ts-ignore
    public indexOf(element: T['TValue'], offset?: number): number { return -1; }

    public includes(element: T['TValue'], offset?: number): boolean {
        // eslint-disable-next-line unicorn/prefer-includes
        return this.indexOf(element, offset) > -1;
    }

    /**
     * Iterator for the Vector's elements.
     */
    public [Symbol.iterator](): IterableIterator<T['TValue'] | null> {
        return iteratorVisitor.visit(this);
    }

    /**
     * Combines two or more Vectors of the same type.
     * @param others Additional Vectors to add to the end of this Vector.
     */
    public concat(...others: Vector<T>[]): Vector<T> {
        return new Vector(this.data.concat(others.flatMap((x) => x.data).flat(Number.POSITIVE_INFINITY)));
    }

    /**
     * Return a zero-copy sub-section of this Vector.
     * @param start The beginning of the specified portion of the Vector.
     * @param end The end of the specified portion of the Vector. This is exclusive of the element at the index 'end'.
     */
    public slice(begin?: number, end?: number): Vector<T> {
        return new Vector(clampRange(this, begin, end, ({ data, _offsets }, begin, end) =>
            sliceChunks(data, _offsets, begin, end)
        ));
    }

    public toJSON() { return [...this]; }

    /**
     * Return a JavaScript Array or TypedArray of the Vector's elements.
     *
     * @note If this Vector contains a single Data chunk and the Vector's type is a
     *  primitive numeric type corresponding to one of the JavaScript TypedArrays, this
     *  method returns a zero-copy slice of the underlying TypedArray values. If there's
     *  more than one chunk, the resulting TypedArray will be a copy of the data from each
     *  chunk's underlying TypedArray values.
     *
     * @returns An Array or TypedArray of the Vector's elements, based on the Vector's DataType.
     */
    public toArray(): T['TArray'] {
        const { type, data, length, stride, ArrayType } = this;
        // Fast case, return subarray if possible
        switch (type.typeId) {
            case Type.Int:
            case Type.Float:
            case Type.Decimal:
            case Type.Time:
            case Type.Timestamp:
                switch (data.length) {
                    case 0: return new ArrayType();
                    case 1: return data[0].values.subarray(0, length * stride);
                    default: return data.reduce((memo, { values, length: chunk_length }) => {
                        memo.array.set(values.subarray(0, chunk_length * stride), memo.offset);
                        memo.offset += chunk_length * stride;
                        return memo;
                    }, { array: new ArrayType(length * stride), offset: 0 }).array;
                }
        }
        // Otherwise if not primitive, slow copy
        return [...this] as T['TArray'];
    }

    /**
     * Returns a string representation of the Vector.
     *
     * @returns A string representation of the Vector.
     */
    public toString() {
        return `[${[...this].join(',')}]`;
    }

    /**
     * Returns a child Vector by name, or null if this Vector has no child with the given name.
     * @param name The name of the child to retrieve.
     */
    public getChild<R extends keyof T['TChildren']>(name: R) {
        return this.getChildAt(this.type.children?.findIndex((f) => f.name === name));
    }

    /**
     * Returns a child Vector by index, or null if this Vector has no child at the supplied index.
     * @param index The index of the child to retrieve.
     */
    public getChildAt<R extends DataType = any>(index: number): Vector<R> | null {
        if (index > -1 && index < this.numChildren) {
            return new Vector(this.data.map(({ children }) => children[index] as Data<R>));
        }
        return null;
    }

    public get isMemoized(): boolean {
        if (DataType.isDictionary(this.type)) {
            return this.data[0].dictionary!.isMemoized;
        }
        return false;
    }

    /**
     * Adds memoization to the Vector's {@link get} method. For dictionary
     * vectors, this method return a vector that memoizes only the dictionary
     * values.
     *
     * Memoization is very useful when decoding a value is expensive such as
     * Utf8. The memoization creates a cache of the size of the Vector and
     * therefore increases memory usage.
     *
     * @returns A new vector that memoizes calls to {@link get}.
     */
    public memoize(): MemoizedVector<T> {
        if (DataType.isDictionary(this.type)) {
            const dictionary = new MemoizedVector(this.data[0].dictionary!);
            const newData = this.data.map((data) => {
                const cloned = data.clone();
                cloned.dictionary = dictionary;
                return cloned;
            });
            return new Vector(newData);
        }
        return new MemoizedVector(this);
    }

    /**
     * Returns a vector without memoization of the {@link get} method. If this
     * vector is not memoized, this method returns this vector.
     *
     * @returns A new vector without memoization.
     */
    public unmemoize(): Vector<T> {
        if (DataType.isDictionary(this.type) && this.isMemoized) {
            const dictionary = this.data[0].dictionary!.unmemoize();
            const newData = this.data.map((data) => {
                const newData = data.clone();
                newData.dictionary = dictionary;
                return newData;
            });
            return new Vector(newData);
        }
        return this;
    }

    // Initialize this static property via an IIFE so bundlers don't tree-shake
    // out this logic, but also so we're still compliant with `"sideEffects": false`
    protected static [Symbol.toStringTag] = ((proto: Vector) => {
        (proto as any).type = DataType.prototype;
        (proto as any).data = [];
        (proto as any).length = 0;
        (proto as any).stride = 1;
        (proto as any).numChildren = 0;
        (proto as any)._offsets = new Uint32Array([0]);
        (proto as any)[Symbol.isConcatSpreadable] = true;

        const typeIds: Type[] = Object.keys(Type)
            .map((T: any) => Type[T] as any)
            .filter((T: any) => typeof T === 'number' && T !== Type.NONE);

        for (const typeId of typeIds) {
            const get = getVisitor.getVisitFnByTypeId(typeId);
            const set = setVisitor.getVisitFnByTypeId(typeId);
            const indexOf = indexOfVisitor.getVisitFnByTypeId(typeId);

            visitorsByTypeId[typeId] = { get, set, indexOf };
            vectorPrototypesByTypeId[typeId] = Object.create(proto, {
                ['isValid']: { value: wrapChunkedCall1(isChunkedValid) },
                ['get']: { value: wrapChunkedCall1(getVisitor.getVisitFnByTypeId(typeId)) },
                ['set']: { value: wrapChunkedCall2(setVisitor.getVisitFnByTypeId(typeId)) },
                ['indexOf']: { value: wrapChunkedIndexOf(indexOfVisitor.getVisitFnByTypeId(typeId)) },
            });
        }

        return 'Vector';
    })(Vector.prototype);
}

class MemoizedVector<T extends DataType = any> extends Vector<T> {

    public constructor(vector: Vector<T>) {
        super(vector.data);

        const get = this.get;
        const set = this.set;
        const slice = this.slice;

        const cache = new Array<T['TValue'] | null>(this.length);

        Object.defineProperty(this, 'get', {
            value(index: number) {
                const cachedValue = cache[index];
                if (cachedValue !== undefined) {
                    return cachedValue;
                }
                const value = get.call(this, index);
                cache[index] = value;
                return value;
            }
        });

        Object.defineProperty(this, 'set', {
            value(index: number, value: T['TValue'] | null) {
                set.call(this, index, value);
                cache[index] = value;
            }
        });

        Object.defineProperty(this, 'slice', {
            value: (begin?: number, end?: number) => new MemoizedVector(slice.call(this, begin, end))
        });

        Object.defineProperty(this, 'isMemoized', { value: true });

        Object.defineProperty(this, 'unmemoize', {
            value: () => new Vector(this.data)
        });

        Object.defineProperty(this, 'memoize', {
            value: () => this
        });
    }
}

import * as dtypes from './type.js';

/**
 * Creates a Vector without data copies.
 *
 * @example
 * ```ts
 * const vector = makeVector(new Int32Array([1, 2, 3]));
 * ```
 */
export function makeVector<T extends TypedArray | BigIntArray>(data: T | readonly T[]): Vector<TypedArrayDataType<T>>;
export function makeVector<T extends DataView>(data: T | readonly T[]): Vector<dtypes.Int8>;
export function makeVector<T extends DataType>(data: Data<T> | readonly Data<T>[]): Vector<T>;
export function makeVector<T extends DataType>(data: Vector<T> | readonly Vector<T>[]): Vector<T>;
export function makeVector<T extends DataType>(data: DataProps<T> | readonly DataProps<T>[]): Vector<T>;

export function makeVector(init: any) {
    if (init) {
        if (init instanceof Data) { return new Vector([init]); }
        if (init instanceof Vector) { return new Vector(init.data); }
        if (init.type instanceof DataType) { return new Vector([makeData(init)]); }
        if (Array.isArray(init)) {
            return new Vector(init.flatMap(v => unwrapInputs(v)));
        }
        if (ArrayBuffer.isView(init)) {
            if (init instanceof DataView) {
                init = new Uint8Array(init.buffer);
            }
            const props = { offset: 0, length: init.length, nullCount: -1, data: init };
            if (init instanceof Int8Array) { return new Vector([makeData({ ...props, type: new dtypes.Int8 })]); }
            if (init instanceof Int16Array) { return new Vector([makeData({ ...props, type: new dtypes.Int16 })]); }
            if (init instanceof Int32Array) { return new Vector([makeData({ ...props, type: new dtypes.Int32 })]); }
            if (init instanceof BigInt64Array) { return new Vector([makeData({ ...props, type: new dtypes.Int64 })]); }
            if (init instanceof Uint8Array || init instanceof Uint8ClampedArray) { return new Vector([makeData({ ...props, type: new dtypes.Uint8 })]); }
            if (init instanceof Uint16Array) { return new Vector([makeData({ ...props, type: new dtypes.Uint16 })]); }
            if (init instanceof Uint32Array) { return new Vector([makeData({ ...props, type: new dtypes.Uint32 })]); }
            if (init instanceof BigUint64Array) { return new Vector([makeData({ ...props, type: new dtypes.Uint64 })]); }
            if (init instanceof Float32Array) { return new Vector([makeData({ ...props, type: new dtypes.Float32 })]); }
            if (init instanceof Float64Array) { return new Vector([makeData({ ...props, type: new dtypes.Float64 })]); }
            throw new Error('Unrecognized input');
        }
    }
    throw new Error('Unrecognized input');
}

function unwrapInputs(x: any) {
    return x instanceof Data ? [x] : (x instanceof Vector ? x.data : makeVector(x).data);
}
