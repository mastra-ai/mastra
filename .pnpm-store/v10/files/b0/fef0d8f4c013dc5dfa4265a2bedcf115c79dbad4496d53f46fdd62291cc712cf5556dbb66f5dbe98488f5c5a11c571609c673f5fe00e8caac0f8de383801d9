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
var _a;
import { Type } from './enum.mjs';
import { clampRange, wrapIndex } from './util/vector.mjs';
import { DataType, strideForType } from './type.mjs';
import { Data, makeData } from './data.mjs';
import { isChunkedValid, computeChunkOffsets, computeChunkNullable, computeChunkNullCounts, sliceChunks, wrapChunkedCall1, wrapChunkedCall2, wrapChunkedIndexOf, } from './util/chunk.mjs';
import { instance as getVisitor } from './visitor/get.mjs';
import { instance as setVisitor } from './visitor/set.mjs';
import { instance as indexOfVisitor } from './visitor/indexof.mjs';
import { instance as iteratorVisitor } from './visitor/iterator.mjs';
const visitorsByTypeId = {};
const vectorPrototypesByTypeId = {};
/**
 * Array-like data structure. Use the convenience method {@link makeVector} and {@link vectorFromArray} to create vectors.
 */
export class Vector {
    constructor(input) {
        var _b, _c, _d;
        const data = input[0] instanceof Vector
            ? input.flatMap(x => x.data)
            : input;
        if (data.length === 0 || data.some((x) => !(x instanceof Data))) {
            throw new TypeError('Vector constructor expects an Array of Data instances.');
        }
        const type = (_b = data[0]) === null || _b === void 0 ? void 0 : _b.type;
        switch (data.length) {
            case 0:
                this._offsets = [0];
                break;
            case 1: {
                // special case for unchunked vectors
                const { get, set, indexOf } = visitorsByTypeId[type.typeId];
                const unchunkedData = data[0];
                this.isValid = (index) => isChunkedValid(unchunkedData, index);
                this.get = (index) => get(unchunkedData, index);
                this.set = (index, value) => set(unchunkedData, index, value);
                this.indexOf = (index) => indexOf(unchunkedData, index);
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
        this.numChildren = (_d = (_c = type.children) === null || _c === void 0 ? void 0 : _c.length) !== null && _d !== void 0 ? _d : 0;
        this.length = this._offsets.at(-1);
    }
    /**
     * The aggregate size (in bytes) of this Vector's buffers and/or child Vectors.
     */
    get byteLength() {
        return this.data.reduce((byteLength, data) => byteLength + data.byteLength, 0);
    }
    /**
     * Whether this Vector's elements can contain null values.
     */
    get nullable() {
        return computeChunkNullable(this.data);
    }
    /**
     * The number of null elements in this Vector.
     */
    get nullCount() {
        return computeChunkNullCounts(this.data);
    }
    /**
     * The Array or TypedArray constructor used for the JS representation
     *  of the element's values in {@link Vector.prototype.toArray `toArray()`}.
     */
    get ArrayType() { return this.type.ArrayType; }
    /**
     * The name that should be printed when the Vector is logged in a message.
     */
    get [Symbol.toStringTag]() {
        return `${this.VectorName}<${this.type[Symbol.toStringTag]}>`;
    }
    /**
     * The name of this Vector.
     */
    get VectorName() { return `${Type[this.type.typeId]}Vector`; }
    /**
     * Check whether an element is null.
     * @param index The index at which to read the validity bitmap.
     */
    // @ts-ignore
    isValid(index) { return false; }
    /**
     * Get an element value by position.
     * @param index The index of the element to read.
     */
    // @ts-ignore
    get(index) { return null; }
    /**
     * Get an element value by position.
     * @param index The index of the element to read. A negative index will count back from the last element.
     */
    at(index) {
        return this.get(wrapIndex(index, this.length));
    }
    /**
     * Set an element value by position.
     * @param index The index of the element to write.
     * @param value The value to set.
     */
    // @ts-ignore
    set(index, value) { return; }
    /**
     * Retrieve the index of the first occurrence of a value in an Vector.
     * @param element The value to locate in the Vector.
     * @param offset The index at which to begin the search. If offset is omitted, the search starts at index 0.
     */
    // @ts-ignore
    indexOf(element, offset) { return -1; }
    includes(element, offset) {
        // eslint-disable-next-line unicorn/prefer-includes
        return this.indexOf(element, offset) > -1;
    }
    /**
     * Iterator for the Vector's elements.
     */
    [Symbol.iterator]() {
        return iteratorVisitor.visit(this);
    }
    /**
     * Combines two or more Vectors of the same type.
     * @param others Additional Vectors to add to the end of this Vector.
     */
    concat(...others) {
        return new Vector(this.data.concat(others.flatMap((x) => x.data).flat(Number.POSITIVE_INFINITY)));
    }
    /**
     * Return a zero-copy sub-section of this Vector.
     * @param start The beginning of the specified portion of the Vector.
     * @param end The end of the specified portion of the Vector. This is exclusive of the element at the index 'end'.
     */
    slice(begin, end) {
        return new Vector(clampRange(this, begin, end, ({ data, _offsets }, begin, end) => sliceChunks(data, _offsets, begin, end)));
    }
    toJSON() { return [...this]; }
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
    toArray() {
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
        return [...this];
    }
    /**
     * Returns a string representation of the Vector.
     *
     * @returns A string representation of the Vector.
     */
    toString() {
        return `[${[...this].join(',')}]`;
    }
    /**
     * Returns a child Vector by name, or null if this Vector has no child with the given name.
     * @param name The name of the child to retrieve.
     */
    getChild(name) {
        var _b;
        return this.getChildAt((_b = this.type.children) === null || _b === void 0 ? void 0 : _b.findIndex((f) => f.name === name));
    }
    /**
     * Returns a child Vector by index, or null if this Vector has no child at the supplied index.
     * @param index The index of the child to retrieve.
     */
    getChildAt(index) {
        if (index > -1 && index < this.numChildren) {
            return new Vector(this.data.map(({ children }) => children[index]));
        }
        return null;
    }
    get isMemoized() {
        if (DataType.isDictionary(this.type)) {
            return this.data[0].dictionary.isMemoized;
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
    memoize() {
        if (DataType.isDictionary(this.type)) {
            const dictionary = new MemoizedVector(this.data[0].dictionary);
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
    unmemoize() {
        if (DataType.isDictionary(this.type) && this.isMemoized) {
            const dictionary = this.data[0].dictionary.unmemoize();
            const newData = this.data.map((data) => {
                const newData = data.clone();
                newData.dictionary = dictionary;
                return newData;
            });
            return new Vector(newData);
        }
        return this;
    }
}
_a = Symbol.toStringTag;
// Initialize this static property via an IIFE so bundlers don't tree-shake
// out this logic, but also so we're still compliant with `"sideEffects": false`
Vector[_a] = ((proto) => {
    proto.type = DataType.prototype;
    proto.data = [];
    proto.length = 0;
    proto.stride = 1;
    proto.numChildren = 0;
    proto._offsets = new Uint32Array([0]);
    proto[Symbol.isConcatSpreadable] = true;
    const typeIds = Object.keys(Type)
        .map((T) => Type[T])
        .filter((T) => typeof T === 'number' && T !== Type.NONE);
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
class MemoizedVector extends Vector {
    constructor(vector) {
        super(vector.data);
        const get = this.get;
        const set = this.set;
        const slice = this.slice;
        const cache = new Array(this.length);
        Object.defineProperty(this, 'get', {
            value(index) {
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
            value(index, value) {
                set.call(this, index, value);
                cache[index] = value;
            }
        });
        Object.defineProperty(this, 'slice', {
            value: (begin, end) => new MemoizedVector(slice.call(this, begin, end))
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
import * as dtypes from './type.mjs';
export function makeVector(init) {
    if (init) {
        if (init instanceof Data) {
            return new Vector([init]);
        }
        if (init instanceof Vector) {
            return new Vector(init.data);
        }
        if (init.type instanceof DataType) {
            return new Vector([makeData(init)]);
        }
        if (Array.isArray(init)) {
            return new Vector(init.flatMap(v => unwrapInputs(v)));
        }
        if (ArrayBuffer.isView(init)) {
            if (init instanceof DataView) {
                init = new Uint8Array(init.buffer);
            }
            const props = { offset: 0, length: init.length, nullCount: -1, data: init };
            if (init instanceof Int8Array) {
                return new Vector([makeData(Object.assign(Object.assign({}, props), { type: new dtypes.Int8 }))]);
            }
            if (init instanceof Int16Array) {
                return new Vector([makeData(Object.assign(Object.assign({}, props), { type: new dtypes.Int16 }))]);
            }
            if (init instanceof Int32Array) {
                return new Vector([makeData(Object.assign(Object.assign({}, props), { type: new dtypes.Int32 }))]);
            }
            if (init instanceof BigInt64Array) {
                return new Vector([makeData(Object.assign(Object.assign({}, props), { type: new dtypes.Int64 }))]);
            }
            if (init instanceof Uint8Array || init instanceof Uint8ClampedArray) {
                return new Vector([makeData(Object.assign(Object.assign({}, props), { type: new dtypes.Uint8 }))]);
            }
            if (init instanceof Uint16Array) {
                return new Vector([makeData(Object.assign(Object.assign({}, props), { type: new dtypes.Uint16 }))]);
            }
            if (init instanceof Uint32Array) {
                return new Vector([makeData(Object.assign(Object.assign({}, props), { type: new dtypes.Uint32 }))]);
            }
            if (init instanceof BigUint64Array) {
                return new Vector([makeData(Object.assign(Object.assign({}, props), { type: new dtypes.Uint64 }))]);
            }
            if (init instanceof Float32Array) {
                return new Vector([makeData(Object.assign(Object.assign({}, props), { type: new dtypes.Float32 }))]);
            }
            if (init instanceof Float64Array) {
                return new Vector([makeData(Object.assign(Object.assign({}, props), { type: new dtypes.Float64 }))]);
            }
            throw new Error('Unrecognized input');
        }
    }
    throw new Error('Unrecognized input');
}
function unwrapInputs(x) {
    return x instanceof Data ? [x] : (x instanceof Vector ? x.data : makeVector(x).data);
}

//# sourceMappingURL=vector.mjs.map
