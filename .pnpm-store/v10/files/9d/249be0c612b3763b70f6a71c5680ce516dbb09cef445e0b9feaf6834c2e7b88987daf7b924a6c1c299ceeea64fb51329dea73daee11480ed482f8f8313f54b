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
import { Data, makeData } from './data.js';
import { vectorFromArray } from './factories.js';
import { makeVector, Vector } from './vector.js';
import { Field, Schema } from './schema.js';
import { DataType, Null, Struct, TypeMap } from './type.js';
import { compareSchemas } from './visitor/typecomparator.js';
import { distributeVectorsIntoRecordBatches } from './util/recordbatch.js';

import {
    isChunkedValid,
    computeChunkOffsets,
    computeChunkNullCounts,
    wrapChunkedCall1,
    wrapChunkedCall2,
    wrapChunkedIndexOf,
    sliceChunks,
} from './util/chunk.js';

import { instance as getVisitor } from './visitor/get.js';
import { instance as setVisitor } from './visitor/set.js';
import { instance as indexOfVisitor } from './visitor/indexof.js';
import { instance as iteratorVisitor } from './visitor/iterator.js';

import { DataProps } from './data.js';
import { clampRange, wrapIndex } from './util/vector.js';
import { ArrayDataType, BigIntArray, TypedArray, TypedArrayDataType } from './interfaces.js';
import { RecordBatch, _InternalEmptyPlaceholderRecordBatch } from './recordbatch.js';

/** @ignore */
export interface Table<T extends TypeMap = any> {
    ///
    // Virtual properties for the TypeScript compiler.
    // These do not exist at runtime.
    ///
    readonly TType: Struct<T>;
    readonly TArray: Struct<T>['TArray'];
    readonly TValue: Struct<T>['TValue'];

    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/isConcatSpreadable
     */
    [Symbol.isConcatSpreadable]: true;
}

/**
 * Tables are collections of {@link Vector}s and have a {@link Schema}. Use the convenience methods {@link makeTable}
 * or {@link tableFromArrays} to create a table in JavaScript. To create a table from the IPC format, use
 * {@link tableFromIPC}.
 */
export class Table<T extends TypeMap = any> {

    constructor();
    constructor(batches: Iterable<RecordBatch<T>>);
    constructor(...batches: readonly RecordBatch<T>[]);
    constructor(...columns: { [P in keyof T]: Vector<T[P]> }[]);
    constructor(...columns: { [P in keyof T]: Data<T[P]> | DataProps<T[P]> }[]);
    constructor(schema: Schema<T>, ...columns: { [P in keyof T]: Vector<T[P]> }[]);
    constructor(schema: Schema<T>, ...columns: { [P in keyof T]: Data<T[P]> | DataProps<T[P]> }[]);
    constructor(schema: Schema<T>, data?: RecordBatch<T> | RecordBatch<T>[]);
    constructor(schema: Schema<T>, data?: RecordBatch<T> | RecordBatch<T>[], offsets?: Uint32Array);
    constructor(...args: any[]) {

        if (args.length === 0) {
            this.batches = [];
            this.schema = new Schema([]);
            this._offsets = [0];
            return this;
        }

        let schema: Schema<T> | undefined;
        let offsets: Uint32Array | number[] | undefined;

        if (args[0] instanceof Schema) {
            schema = args.shift() as Schema<T>;
        }

        if (args.at(-1) instanceof Uint32Array) {
            offsets = args.pop();
        }

        const unwrap = (x: any): RecordBatch<T>[] => {
            if (x) {
                if (x instanceof RecordBatch) {
                    return [x];
                } else if (x instanceof Table) {
                    return x.batches;
                } else if (x instanceof Data) {
                    if (x.type instanceof Struct) {
                        return [new RecordBatch(new Schema(x.type.children), x)];
                    }
                } else if (Array.isArray(x)) {
                    return x.flatMap(v => unwrap(v));
                } else if (typeof x[Symbol.iterator] === 'function') {
                    return [...x].flatMap(v => unwrap(v));
                } else if (typeof x === 'object') {
                    const keys = Object.keys(x) as (keyof T)[];
                    const vecs = keys.map((k) => new Vector([x[k]]));
                    const batchSchema = schema ?? new Schema(keys.map((k, i) => new Field(String(k), vecs[i].type, vecs[i].nullable)));
                    const [, batches] = distributeVectorsIntoRecordBatches(batchSchema, vecs);
                    return batches.length === 0 ? [new RecordBatch(x)] : batches;
                }
            }
            return [];
        };

        const batches = args.flatMap(v => unwrap(v));

        schema = schema ?? batches[0]?.schema ?? new Schema([]);

        if (!(schema instanceof Schema)) {
            throw new TypeError('Table constructor expects a [Schema, RecordBatch[]] pair.');
        }

        for (const batch of batches) {
            if (!(batch instanceof RecordBatch)) {
                throw new TypeError('Table constructor expects a [Schema, RecordBatch[]] pair.');
            }
            if (!compareSchemas(schema, batch.schema)) {
                throw new TypeError('Table and inner RecordBatch schemas must be equivalent.');
            }
        }

        this.schema = schema;
        this.batches = batches;
        this._offsets = offsets ?? computeChunkOffsets(this.data);
    }

    declare protected _offsets: Uint32Array | number[];
    declare protected _nullCount: number;

    declare public readonly schema: Schema<T>;

    /**
     * The contiguous {@link RecordBatch `RecordBatch`} chunks of the Table rows.
     */
    declare public readonly batches: RecordBatch<T>[];

    /**
     * The contiguous {@link RecordBatch `RecordBatch`} chunks of the Table rows.
     */
    public get data() { return this.batches.map(({ data }) => data); }

    /**
     * The number of columns in this Table.
     */
    public get numCols() { return this.schema.fields.length; }

    /**
     * The number of rows in this Table.
     */
    public get numRows() {
        return this.data.reduce((numRows, data) => numRows + data.length, 0);
    }

    /**
     * The number of null rows in this Table.
     */
    public get nullCount() {
        if (this._nullCount === -1) {
            this._nullCount = computeChunkNullCounts(this.data);
        }
        return this._nullCount;
    }

    /**
     * Check whether an element is null.
     *
     * @param index The index at which to read the validity bitmap.
     */
    // @ts-ignore
    public isValid(index: number): boolean { return false; }

    /**
     * Get an element value by position.
     *
     * @param index The index of the element to read.
     */
    // @ts-ignore
    public get(index: number): Struct<T>['TValue'] | null { return null; }

    /**
      * Get an element value by position.
      * @param index The index of the element to read. A negative index will count back from the last element.
      */
    // @ts-ignore
    public at(index: number): Struct<T>['TValue'] | null {
        return this.get(wrapIndex(index, this.numRows));
    }

    /**
     * Set an element value by position.
     *
     * @param index The index of the element to write.
     * @param value The value to set.
     */
    // @ts-ignore
    public set(index: number, value: Struct<T>['TValue'] | null): void { return; }

    /**
     * Retrieve the index of the first occurrence of a value in an Vector.
     *
     * @param element The value to locate in the Vector.
     * @param offset The index at which to begin the search. If offset is omitted, the search starts at index 0.
     */
    // @ts-ignore
    public indexOf(element: Struct<T>['TValue'], offset?: number): number { return -1; }

    /**
     * Iterator for rows in this Table.
     */
    public [Symbol.iterator]() {
        if (this.batches.length > 0) {
            return iteratorVisitor.visit(new Vector(this.data)) as IterableIterator<Struct<T>['TValue']>;
        }
        return (new Array(0))[Symbol.iterator]();
    }

    /**
     * Return a JavaScript Array of the Table rows.
     *
     * @returns An Array of Table rows.
     */
    public toArray() {
        return [...this];
    }

    /**
     * Returns a string representation of the Table rows.
     *
     * @returns A string representation of the Table rows.
     */
    public toString() {
        return `[\n  ${this.toArray().join(',\n  ')}\n]`;
    }

    /**
     * Combines two or more Tables of the same schema.
     *
     * @param others Additional Tables to add to the end of this Tables.
     */
    public concat(...others: Table<T>[]) {
        const schema = this.schema;
        const data = this.data.concat(others.flatMap(({ data }) => data));
        return new Table(schema, data.map((data) => new RecordBatch(schema, data)));
    }

    /**
     * Return a zero-copy sub-section of this Table.
     *
     * @param begin The beginning of the specified portion of the Table.
     * @param end The end of the specified portion of the Table. This is exclusive of the element at the index 'end'.
     */
    public slice(begin?: number, end?: number): Table<T> {
        const schema = this.schema;
        [begin, end] = clampRange({ length: this.numRows }, begin, end);
        const data = sliceChunks(this.data, this._offsets, begin, end);
        return new Table(schema, data.map((chunk) => new RecordBatch(schema, chunk)));
    }

    /**
     * Returns a child Vector by name, or null if this Vector has no child with the given name.
     *
     * @param name The name of the child to retrieve.
     */
    public getChild<P extends keyof T>(name: P) {
        return this.getChildAt<T[P]>(this.schema.fields.findIndex((f) => f.name === name));
    }

    /**
     * Returns a child Vector by index, or null if this Vector has no child at the supplied index.
     *
     * @param index The index of the child to retrieve.
     */
    public getChildAt<R extends T[keyof T] = any>(index: number): Vector<R> | null {
        if (index > -1 && index < this.schema.fields.length) {
            const data = this.data.map((data) => data.children[index] as Data<R>);
            if (data.length === 0) {
                const { type } = this.schema.fields[index] as Field<R>;
                const empty = makeData<R>({ type, length: 0, nullCount: 0 });
                data.push(empty._changeLengthAndBackfillNullBitmap(this.numRows));
            }
            return new Vector(data);
        }
        return null;
    }

    /**
     * Sets a child Vector by name.
     *
     * @param name The name of the child to overwrite.
     * @returns A new Table with the supplied child for the specified name.
     */
    public setChild<P extends keyof T, R extends DataType>(name: P, child: Vector<R>) {
        return this.setChildAt(this.schema.fields?.findIndex((f) => f.name === name), child) as Table<T & { [K in P]: R }>;
    }

    /**
     * Sets a child Vector by index.
     *
     * @param index The index of the child to overwrite.
     * @returns A new Table with the supplied child at the specified index.
     */
    public setChildAt(index: number, child?: null): Table;
    public setChildAt<R extends DataType = any>(index: number, child: Vector<R>): Table;
    public setChildAt(index: number, child: any) {
        let schema: Schema = this.schema;
        let batches: RecordBatch[] = [...this.batches];
        if (index > -1 && index < this.numCols) {
            if (!child) {
                child = new Vector([makeData({ type: new Null, length: this.numRows })]);
            }
            const fields = schema.fields.slice() as Field<any>[];
            const field = fields[index].clone({ type: child.type });
            const children = this.schema.fields.map((_, i) => this.getChildAt(i)!);
            [fields[index], children[index]] = [field, child];
            [schema, batches] = distributeVectorsIntoRecordBatches(schema, children);
        }
        return new Table(schema, batches);
    }

    /**
     * Construct a new Table containing only specified columns.
     *
     * @param columnNames Names of columns to keep.
     * @returns A new Table of columns matching the specified names.
     */
    public select<K extends keyof T = any>(columnNames: K[]) {
        const nameToIndex = this.schema.fields.reduce((m, f, i) => m.set(f.name as K, i), new Map<K, number>());
        return this.selectAt(columnNames.map((columnName) => nameToIndex.get(columnName)!).filter((x) => x > -1));
    }

    /**
     * Construct a new Table containing only columns at the specified indices.
     *
     * @param columnIndices Indices of columns to keep.
     * @returns A new Table of columns at the specified indices.
     */
    public selectAt<K extends T[keyof T] = any>(columnIndices: number[]) {
        const schema = this.schema.selectAt(columnIndices);
        const data = this.batches.map((batch) => batch.selectAt(columnIndices));
        return new Table<{ [key: string]: K }>(schema, data);
    }

    public assign<R extends TypeMap = any>(other: Table<R>) {

        const fields = this.schema.fields;
        const [indices, oldToNew] = other.schema.fields.reduce((memo, f2, newIdx) => {
            const [indices, oldToNew] = memo;
            const i = fields.findIndex((f) => f.name === f2.name);
            ~i ? (oldToNew[i] = newIdx) : indices.push(newIdx);
            return memo;
        }, [[], []] as number[][]);

        const schema = this.schema.assign(other.schema);
        const columns = [
            ...fields.map((_, i) => [i, oldToNew[i]]).map(([i, j]) =>
                (j === undefined ? this.getChildAt(i) : other.getChildAt(j))!),
            ...indices.map((i) => other.getChildAt(i)!)
        ].filter(Boolean) as Vector<(T & R)[keyof T | keyof R]>[];

        return new Table<T & R>(...distributeVectorsIntoRecordBatches<any>(schema, columns));
    }

    // Initialize this static property via an IIFE so bundlers don't tree-shake
    // out this logic, but also so we're still compliant with `"sideEffects": false`
    protected static [Symbol.toStringTag] = ((proto: Table) => {
        (proto as any).schema = null;
        (proto as any).batches = [];
        (proto as any)._offsets = new Uint32Array([0]);
        (proto as any)._nullCount = -1;
        (proto as any)[Symbol.isConcatSpreadable] = true;
        (proto as any)['isValid'] = wrapChunkedCall1(isChunkedValid);
        (proto as any)['get'] = wrapChunkedCall1(getVisitor.getVisitFn(Type.Struct));
        (proto as any)['set'] = wrapChunkedCall2(setVisitor.getVisitFn(Type.Struct));
        (proto as any)['indexOf'] = wrapChunkedIndexOf(indexOfVisitor.getVisitFn(Type.Struct));
        return 'Table';
    })(Table.prototype);
}


type VectorsMap<T extends TypeMap> = { [P in keyof T]: Vector<T[P]> };

/**
 * Creates a new Table from an object of typed arrays.
 *
*  @example
 * ```ts
 * const table = makeTable({
 *   a: new Int8Array([1, 2, 3]),
 * })
 * ```
 *
 * @param input Input an object of typed arrays.
 * @returns A new Table.
 */
export function makeTable<I extends Record<string | number | symbol, TypedArray>>(input: I): Table<{ [P in keyof I]: TypedArrayDataType<I[P]> }> {
    type T = { [P in keyof I]: TypedArrayDataType<I[P]> };
    const vecs = {} as VectorsMap<T>;
    const inputs = Object.entries(input) as [keyof I, I[keyof I]][];
    for (const [key, col] of inputs) {
        vecs[key] = makeVector(col);
    }
    return new Table<T>(vecs);
}

/**
 * Creates a new Table from an object of typed arrays or JavaScript arrays.
 *
 *  @example
 * ```ts
 * const table = tableFromArrays({
 *   a: [1, 2, 3],
 *   b: new Int8Array([1, 2, 3]),
 * })
 * ```
 *
 * @param input Input an object of typed arrays or JavaScript arrays.
 * @returns A new Table.
 */
export function tableFromArrays<I extends Record<string | number | symbol, TypedArray | BigIntArray | readonly unknown[]>>(input: I): Table<{ [P in keyof I]: ArrayDataType<I[P]> }> {
    type T = { [P in keyof I]: ArrayDataType<I[P]> };
    const vecs = {} as VectorsMap<T>;
    const inputs = Object.entries(input) as [keyof I, I[keyof I]][];
    for (const [key, col] of inputs) {
        vecs[key] = vectorFromArray(col);
    }
    return new Table<T>(vecs);
}
