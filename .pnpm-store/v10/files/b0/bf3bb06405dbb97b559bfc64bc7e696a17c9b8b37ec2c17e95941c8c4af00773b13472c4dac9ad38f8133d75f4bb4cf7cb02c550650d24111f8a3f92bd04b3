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

import { Field, Schema } from './schema.js';
import * as dtypes from './type.js';
import { Data, DataProps } from './data.js';
import { BuilderType, JavaScriptDataType } from './interfaces.js';
import { Vector, makeVector } from './vector.js';
import { Builder, BuilderOptions } from './builder.js';
import { instance as getBuilderConstructor } from './visitor/builderctor.js';
import { ArrayDataType, BigIntArray, JavaScriptArrayDataType, TypedArray, TypedArrayDataType } from './interfaces.js';
import { Table } from './table.js';
import { RecordBatch } from './recordbatch.js';
import { compareTypes } from './visitor/typecomparator.js';

export function makeBuilder<T extends dtypes.DataType = any, TNull = any>(options: BuilderOptions<T, TNull>): BuilderType<T, TNull> {

    const type = options.type;
    const builder = new (getBuilderConstructor.getVisitFn<T>(type)())(options) as Builder<T, TNull>;

    if (type.children && type.children.length > 0) {

        const children = options['children'] || [] as BuilderOptions[];
        const defaultOptions = { 'nullValues': options['nullValues'] };
        const getChildOptions = Array.isArray(children)
            ? ((_: Field, i: number) => children[i] || defaultOptions)
            : (({ name }: Field) => children[name] || defaultOptions);

        for (const [index, field] of type.children.entries()) {
            const { type } = field;
            const opts = getChildOptions(field, index);
            builder.children.push(makeBuilder({ ...opts, type }));
        }
    }

    return builder as BuilderType<T, TNull>;
}

/**
 * Creates a Vector from a JavaScript array via a {@link Builder}.
 * Use {@link makeVector} if you only want to create a vector from a typed array.
 *
 * @example
 * ```ts
 * const vf64 = vectorFromArray([1, 2, 3]);
 * const vi8 = vectorFromArray([1, 2, 3], new Int8);
 * const vdict = vectorFromArray(['foo', 'bar']);
 * const vstruct = vectorFromArray([{a: 'foo', b: 42}, {a: 'bar', b: 12}]);
 * ```
 */
export function vectorFromArray(values: readonly (null | undefined)[], type?: dtypes.Null): Vector<dtypes.Null>;
export function vectorFromArray(values: readonly (null | undefined | boolean)[], type?: dtypes.Bool): Vector<dtypes.Bool>;
export function vectorFromArray<T extends dtypes.Utf8 | dtypes.Dictionary<dtypes.Utf8> = dtypes.Dictionary<dtypes.Utf8, dtypes.Int32>>(values: readonly (null | undefined | string)[], type?: T): Vector<T>;
export function vectorFromArray<T extends dtypes.TimestampMillisecond>(values: readonly (null | undefined | Date)[], type?: T): Vector<T>;
export function vectorFromArray<T extends dtypes.Int>(values: readonly (null | undefined | number)[], type: T): Vector<T>;
export function vectorFromArray<T extends dtypes.Int64 | dtypes.Uint64 = dtypes.Int64>(values: readonly (null | undefined | bigint)[], type?: T): Vector<T>;
export function vectorFromArray<T extends dtypes.Float = dtypes.Float64>(values: readonly (null | undefined | number)[], type?: T): Vector<T>;
export function vectorFromArray<T extends dtypes.DataType>(values: readonly (unknown)[], type: T): Vector<T>;
export function vectorFromArray<T extends readonly unknown[]>(values: T): Vector<JavaScriptArrayDataType<T>>;
/** Creates a Vector from a typed array via {@link makeVector}. */
export function vectorFromArray<T extends TypedArray | BigIntArray>(data: T): Vector<TypedArrayDataType<T>>;

export function vectorFromArray<T extends dtypes.DataType>(data: Data<T>): Vector<T>;
export function vectorFromArray<T extends dtypes.DataType>(data: Vector<T>): Vector<T>;
export function vectorFromArray<T extends dtypes.DataType>(data: DataProps<T>): Vector<T>;
export function vectorFromArray<T extends TypedArray | BigIntArray | readonly unknown[]>(data: T): Vector<ArrayDataType<T>>;

export function vectorFromArray(init: any, type?: dtypes.DataType) {
    if (init instanceof Data || init instanceof Vector || init.type instanceof dtypes.DataType || ArrayBuffer.isView(init)) {
        return makeVector(init as any);
    }
    const options: IterableBuilderOptions = { type: type ?? inferType(init), nullValues: [null] };
    const chunks = [...builderThroughIterable(options)(init)];
    const vector = chunks.length === 1 ? chunks[0] : chunks.reduce((a, b) => a.concat(b));
    if (dtypes.DataType.isDictionary(vector.type)) {
        return vector.memoize();
    }
    return vector;
}

/**
 * Creates a {@link Table} from an array of objects.
 *
 * @param array A table of objects.
 */
export function tableFromJSON<T extends Record<string, unknown>>(array: T[]): Table<{ [P in keyof T]: JavaScriptDataType<T[P]> }> {
    const vector = vectorFromArray(array) as Vector<dtypes.Struct<any>>;
    const batch = new RecordBatch(new Schema(vector.type.children), vector.data[0]);
    return new Table(batch);
}

/** @ignore */
function inferType<T extends readonly unknown[]>(values: T): JavaScriptArrayDataType<T>;
function inferType(value: readonly unknown[]): dtypes.DataType {
    if (value.length === 0) { return new dtypes.Null; }
    let nullsCount = 0;
    let arraysCount = 0;
    let objectsCount = 0;
    let numbersCount = 0;
    let stringsCount = 0;
    let bigintsCount = 0;
    let booleansCount = 0;
    let datesCount = 0;

    for (const val of value) {
        if (val == null) { ++nullsCount; continue; }
        switch (typeof val) {
            case 'bigint': ++bigintsCount; continue;
            case 'boolean': ++booleansCount; continue;
            case 'number': ++numbersCount; continue;
            case 'string': ++stringsCount; continue;
            case 'object':
                if (Array.isArray(val)) {
                    ++arraysCount;
                } else if (Object.prototype.toString.call(val) === '[object Date]') {
                    ++datesCount;
                } else {
                    ++objectsCount;
                }
                continue;
        }
        throw new TypeError('Unable to infer Vector type from input values, explicit type declaration expected.');
    }

    if (numbersCount + nullsCount === value.length) {
        return new dtypes.Float64;
    } else if (stringsCount + nullsCount === value.length) {
        return new dtypes.Dictionary(new dtypes.Utf8, new dtypes.Int32);
    } else if (bigintsCount + nullsCount === value.length) {
        return new dtypes.Int64;
    } else if (booleansCount + nullsCount === value.length) {
        return new dtypes.Bool;
    } else if (datesCount + nullsCount === value.length) {
        return new dtypes.TimestampMillisecond;
    } else if (arraysCount + nullsCount === value.length) {
        const array = value as Array<unknown>[];
        const childType = inferType(array[array.findIndex((ary) => ary != null)]);
        if (array.every((ary) => ary == null || compareTypes(childType, inferType(ary)))) {
            return new dtypes.List(new Field('', childType, true));
        }
    } else if (objectsCount + nullsCount === value.length) {
        const fields = new Map<string, Field>();
        for (const row of value as Record<string, unknown>[]) {
            for (const key of Object.keys(row)) {
                if (!fields.has(key) && row[key] != null) {
                    // use the type inferred for the first instance of a found key
                    fields.set(key, new Field(key, inferType([row[key]]), true));
                }
            }
        }
        return new dtypes.Struct([...fields.values()]);
    }

    throw new TypeError('Unable to infer Vector type from input values, explicit type declaration expected.');
}

/**
 * A set of options to create an Iterable or AsyncIterable `Builder` transform function.
 * @see {@link builderThroughIterable}
 * @see {@link builderThroughAsyncIterable}
 */
export interface IterableBuilderOptions<T extends dtypes.DataType = any, TNull = any> extends BuilderOptions<T, TNull> {
    highWaterMark?: number;
    queueingStrategy?: 'bytes' | 'count';
    dictionaryHashFunction?: (value: any) => string | number;
    valueToChildTypeId?: (builder: Builder<T, TNull>, value: any, offset: number) => number;
}

/** @ignore */
type ThroughIterable<T extends dtypes.DataType = any, TNull = any> = (source: Iterable<T['TValue'] | TNull>) => IterableIterator<Vector<T>>;

/**
 * Transform a synchronous `Iterable` of arbitrary JavaScript values into a
 * sequence of Arrow Vector<T> following the chunking semantics defined in
 * the supplied `options` argument.
 *
 * This function returns a function that accepts an `Iterable` of values to
 * transform. When called, this function returns an Iterator of `Vector<T>`.
 *
 * The resulting `Iterator<Vector<T>>` yields Vectors based on the
 * `queueingStrategy` and `highWaterMark` specified in the `options` argument.
 *
 * * If `queueingStrategy` is `"count"` (or omitted), The `Iterator<Vector<T>>`
 *   will flush the underlying `Builder` (and yield a new `Vector<T>`) once the
 *   Builder's `length` reaches or exceeds the supplied `highWaterMark`.
 * * If `queueingStrategy` is `"bytes"`, the `Iterator<Vector<T>>` will flush
 *   the underlying `Builder` (and yield a new `Vector<T>`) once its `byteLength`
 *   reaches or exceeds the supplied `highWaterMark`.
 *
 * @param {IterableBuilderOptions<T, TNull>} options An object of properties which determine the `Builder` to create and the chunking semantics to use.
 * @returns A function which accepts a JavaScript `Iterable` of values to
 *          write, and returns an `Iterator` that yields Vectors according
 *          to the chunking semantics defined in the `options` argument.
 * @nocollapse
 */
export function builderThroughIterable<T extends dtypes.DataType = any, TNull = any>(options: IterableBuilderOptions<T, TNull>) {
    const { ['queueingStrategy']: queueingStrategy = 'count' } = options;
    const { ['highWaterMark']: highWaterMark = queueingStrategy !== 'bytes' ? Number.POSITIVE_INFINITY : 2 ** 14 } = options;
    const sizeProperty: 'length' | 'byteLength' = queueingStrategy !== 'bytes' ? 'length' : 'byteLength';
    return function* (source: Iterable<T['TValue'] | TNull>) {
        let numChunks = 0;
        const builder = makeBuilder(options);
        for (const value of source) {
            if (builder.append(value)[sizeProperty] >= highWaterMark) {
                ++numChunks && (yield builder.toVector());
            }
        }
        if (builder.finish().length > 0 || numChunks === 0) {
            yield builder.toVector();
        }
    } as ThroughIterable<T, TNull>;
}

/** @ignore */
type ThroughAsyncIterable<T extends dtypes.DataType = any, TNull = any> = (source: Iterable<T['TValue'] | TNull> | AsyncIterable<T['TValue'] | TNull>) => AsyncIterableIterator<Vector<T>>;

/**
 * Transform an `AsyncIterable` of arbitrary JavaScript values into a
 * sequence of Arrow Vector<T> following the chunking semantics defined in
 * the supplied `options` argument.
 *
 * This function returns a function that accepts an `AsyncIterable` of values to
 * transform. When called, this function returns an AsyncIterator of `Vector<T>`.
 *
 * The resulting `AsyncIterator<Vector<T>>` yields Vectors based on the
 * `queueingStrategy` and `highWaterMark` specified in the `options` argument.
 *
 * * If `queueingStrategy` is `"count"` (or omitted), The `AsyncIterator<Vector<T>>`
 *   will flush the underlying `Builder` (and yield a new `Vector<T>`) once the
 *   Builder's `length` reaches or exceeds the supplied `highWaterMark`.
 * * If `queueingStrategy` is `"bytes"`, the `AsyncIterator<Vector<T>>` will flush
 *   the underlying `Builder` (and yield a new `Vector<T>`) once its `byteLength`
 *   reaches or exceeds the supplied `highWaterMark`.
 *
 * @param {IterableBuilderOptions<T, TNull>} options An object of properties which determine the `Builder` to create and the chunking semantics to use.
 * @returns A function which accepts a JavaScript `AsyncIterable` of values
 *          to write, and returns an `AsyncIterator` that yields Vectors
 *          according to the chunking semantics defined in the `options`
 *          argument.
 * @nocollapse
 */
export function builderThroughAsyncIterable<T extends dtypes.DataType = any, TNull = any>(options: IterableBuilderOptions<T, TNull>) {
    const { ['queueingStrategy']: queueingStrategy = 'count' } = options;
    const { ['highWaterMark']: highWaterMark = queueingStrategy !== 'bytes' ? Number.POSITIVE_INFINITY : 2 ** 14 } = options;
    const sizeProperty: 'length' | 'byteLength' = queueingStrategy !== 'bytes' ? 'length' : 'byteLength';
    return async function* (source: Iterable<T['TValue'] | TNull> | AsyncIterable<T['TValue'] | TNull>) {
        let numChunks = 0;
        const builder = makeBuilder(options);
        for await (const value of source) {
            if (builder.append(value)[sizeProperty] >= highWaterMark) {
                ++numChunks && (yield builder.toVector());
            }
        }
        if (builder.finish().length > 0 || numChunks === 0) {
            yield builder.toVector();
        }
    } as ThroughAsyncIterable<T, TNull>;
}
