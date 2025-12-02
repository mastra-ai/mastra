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

import { Data, makeData } from './data.js';
import { Table } from './table.js';
import { Vector } from './vector.js';
import { Schema, Field } from './schema.js';
import { DataType, Struct, Null, TypeMap } from './type.js';
import { wrapIndex } from './util/vector.js';

import { instance as getVisitor } from './visitor/get.js';
import { instance as setVisitor } from './visitor/set.js';
import { instance as indexOfVisitor } from './visitor/indexof.js';
import { instance as iteratorVisitor } from './visitor/iterator.js';

/** @ignore */
export interface RecordBatch<T extends TypeMap = any> {
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

/** @ignore */
export class RecordBatch<T extends TypeMap = any> {

    constructor(columns: { [P in keyof T]: Data<T[P]> });
    constructor(schema: Schema<T>, data?: Data<Struct<T>>);
    constructor(...args: any[]) {
        switch (args.length) {
            case 2: {
                [this.schema] = args;
                if (!(this.schema instanceof Schema)) {
                    throw new TypeError('RecordBatch constructor expects a [Schema, Data] pair.');
                }
                [,
                    this.data = makeData({
                        nullCount: 0,
                        type: new Struct<T>(this.schema.fields),
                        children: this.schema.fields.map((f) => makeData({ type: f.type, nullCount: 0 }))
                    })
                ] = args;
                if (!(this.data instanceof Data)) {
                    throw new TypeError('RecordBatch constructor expects a [Schema, Data] pair.');
                }
                [this.schema, this.data] = ensureSameLengthData<T>(this.schema, this.data.children as Data<T[keyof T]>[]);
                break;
            }
            case 1: {
                const [obj] = args;
                const { fields, children, length } = Object.keys(obj).reduce((memo, name, i) => {
                    memo.children[i] = obj[name];
                    memo.length = Math.max(memo.length, obj[name].length);
                    memo.fields[i] = Field.new({ name, type: obj[name].type, nullable: true });
                    return memo;
                }, {
                    length: 0,
                    fields: new Array<Field<T[keyof T]>>(),
                    children: new Array<Data<T[keyof T]>>(),
                });

                const schema = new Schema<T>(fields);
                const data = makeData({ type: new Struct<T>(fields), length, children, nullCount: 0 });
                [this.schema, this.data] = ensureSameLengthData<T>(schema, data.children as Data<T[keyof T]>[], length);
                break;
            }
            default: throw new TypeError('RecordBatch constructor expects an Object mapping names to child Data, or a [Schema, Data] pair.');
        }
    }

    protected _dictionaries?: Map<number, Vector>;

    public readonly schema: Schema<T>;
    public readonly data: Data<Struct<T>>;

    public get dictionaries() {
        return this._dictionaries || (this._dictionaries = collectDictionaries(this.schema.fields, this.data.children));
    }

    /**
     * The number of columns in this RecordBatch.
     */
    public get numCols() { return this.schema.fields.length; }

    /**
     * The number of rows in this RecordBatch.
     */
    public get numRows() { return this.data.length; }

    /**
     * The number of null rows in this RecordBatch.
     */
    public get nullCount() {
        return this.data.nullCount;
    }

    /**
     * Check whether an row is null.
     * @param index The index at which to read the validity bitmap.
     */
    public isValid(index: number) {
        return this.data.getValid(index);
    }

    /**
     * Get a row by position.
     * @param index The index of the row to read.
     */
    public get(index: number) {
        return getVisitor.visit(this.data, index);
    }

    /**
      * Get a row value by position.
      * @param index The index of the row to read. A negative index will count back from the last row.
      */
    public at(index: number) {
        return this.get(wrapIndex(index, this.numRows));
    }

    /**
     * Set a row by position.
     * @param index The index of the row to write.
     * @param value The value to set.
     */
    public set(index: number, value: Struct<T>['TValue']) {
        return setVisitor.visit(this.data, index, value);
    }

    /**
     * Retrieve the index of the first occurrence of a row in an RecordBatch.
     * @param element The row to locate in the RecordBatch.
     * @param offset The index at which to begin the search. If offset is omitted, the search starts at index 0.
     */
    public indexOf(element: Struct<T>['TValue'], offset?: number): number {
        return indexOfVisitor.visit(this.data, element, offset);
    }

    /**
     * Iterator for rows in this RecordBatch.
     */
    public [Symbol.iterator]() {
        return iteratorVisitor.visit(new Vector([this.data])) as IterableIterator<Struct<T>['TValue']>;
    }

    /**
     * Return a JavaScript Array of the RecordBatch rows.
     * @returns An Array of RecordBatch rows.
     */
    public toArray() {
        return [...this];
    }

    /**
     * Combines two or more RecordBatch of the same schema.
     * @param others Additional RecordBatch to add to the end of this RecordBatch.
     */
    public concat(...others: RecordBatch<T>[]) {
        return new Table(this.schema, [this, ...others]);
    }

    /**
     * Return a zero-copy sub-section of this RecordBatch.
     * @param start The beginning of the specified portion of the RecordBatch.
     * @param end The end of the specified portion of the RecordBatch. This is exclusive of the row at the index 'end'.
     */
    public slice(begin?: number, end?: number): RecordBatch<T> {
        const [slice] = new Vector([this.data]).slice(begin, end).data;
        return new RecordBatch(this.schema, slice);
    }

    /**
     * Returns a child Vector by name, or null if this Vector has no child with the given name.
     * @param name The name of the child to retrieve.
     */
    public getChild<P extends keyof T>(name: P) {
        return this.getChildAt<T[P]>(this.schema.fields?.findIndex((f) => f.name === name));
    }

    /**
     * Returns a child Vector by index, or null if this Vector has no child at the supplied index.
     * @param index The index of the child to retrieve.
     */
    public getChildAt<R extends T[keyof T] = any>(index: number): Vector<R> | null {
        if (index > -1 && index < this.schema.fields.length) {
            return new Vector([this.data.children[index]]) as Vector<R>;
        }
        return null;
    }

    /**
     * Sets a child Vector by name.
     * @param name The name of the child to overwrite.
     * @returns A new RecordBatch with the new child for the specified name.
     */
    public setChild<P extends keyof T, R extends DataType>(name: P, child: Vector<R>) {
        return this.setChildAt(this.schema.fields?.findIndex((f) => f.name === name), child) as RecordBatch<T & { [K in P]: R }>;
    }

    /**
     * Sets a child Vector by index.
     * @param index The index of the child to overwrite.
     * @returns A new RecordBatch with the new child at the specified index.
     */
    public setChildAt(index: number, child?: null): RecordBatch;
    public setChildAt<R extends DataType = any>(index: number, child: Vector<R>): RecordBatch;
    public setChildAt(index: number, child: any) {
        let schema: Schema = this.schema;
        let data: Data<Struct> = this.data;
        if (index > -1 && index < this.numCols) {
            if (!child) {
                child = new Vector([makeData({ type: new Null, length: this.numRows })]);
            }
            const fields = schema.fields.slice() as Field<any>[];
            const children = data.children.slice() as Data<any>[];
            const field = fields[index].clone({ type: child.type });
            [fields[index], children[index]] = [field, child.data[0]];
            schema = new Schema(fields, new Map(this.schema.metadata));
            data = makeData({ type: new Struct<T>(fields), children });
        }
        return new RecordBatch(schema, data);
    }

    /**
     * Construct a new RecordBatch containing only specified columns.
     *
     * @param columnNames Names of columns to keep.
     * @returns A new RecordBatch of columns matching the specified names.
     */
    public select<K extends keyof T = any>(columnNames: K[]) {
        const schema = this.schema.select(columnNames);
        const type = new Struct(schema.fields);
        const children = [] as Data<T[K]>[];
        for (const name of columnNames) {
            const index = this.schema.fields.findIndex((f) => f.name === name);
            if (~index) {
                children[index] = this.data.children[index] as Data<T[K]>;
            }
        }
        return new RecordBatch(schema, makeData({ type, length: this.numRows, children }));
    }

    /**
     * Construct a new RecordBatch containing only columns at the specified indices.
     *
     * @param columnIndices Indices of columns to keep.
     * @returns A new RecordBatch of columns matching at the specified indices.
     */
    public selectAt<K extends T = any>(columnIndices: number[]) {
        const schema = this.schema.selectAt<K>(columnIndices);
        const children = columnIndices.map((i) => this.data.children[i]).filter(Boolean);
        const subset = makeData({ type: new Struct(schema.fields), length: this.numRows, children });
        return new RecordBatch<{ [P in keyof K]: K[P] }>(schema, subset);
    }

    // Initialize this static property via an IIFE so bundlers don't tree-shake
    // out this logic, but also so we're still compliant with `"sideEffects": false`
    protected static [Symbol.toStringTag] = ((proto: RecordBatch) => {
        (proto as any)._nullCount = -1;
        (proto as any)[Symbol.isConcatSpreadable] = true;
        return 'RecordBatch';
    })(RecordBatch.prototype);
}


/** @ignore */
function ensureSameLengthData<T extends TypeMap = any>(
    schema: Schema<T>,
    chunks: Data<T[keyof T]>[],
    maxLength = chunks.reduce((max, col) => Math.max(max, col.length), 0)
) {
    const fields = [...schema.fields];
    const children = [...chunks] as Data<T[keyof T]>[];
    const nullBitmapSize = ((maxLength + 63) & ~63) >> 3;

    for (const [idx, field] of schema.fields.entries()) {
        const chunk = chunks[idx];
        if (!chunk || chunk.length !== maxLength) {
            fields[idx] = field.clone({ nullable: true });
            children[idx] = chunk?._changeLengthAndBackfillNullBitmap(maxLength) ?? makeData({
                type: field.type,
                length: maxLength,
                nullCount: maxLength,
                nullBitmap: new Uint8Array(nullBitmapSize)
            });
        }
    }

    return [
        schema.assign(fields),
        makeData({ type: new Struct<T>(fields), length: maxLength, children })
    ] as [Schema<T>, Data<Struct<T>>];
}

/** @ignore */
function collectDictionaries(fields: Field[], children: readonly Data[], dictionaries = new Map<number, Vector>()): Map<number, Vector> {
    if ((fields?.length ?? 0) > 0 && (fields?.length === children?.length)) {
        for (let i = -1, n = fields.length; ++i < n;) {
            const { type } = fields[i];
            const data = children[i];
            for (const next of [data, ...(data?.dictionary?.data || [])]) {
                collectDictionaries(type.children, next?.children, dictionaries);
            }
            if (DataType.isDictionary(type)) {
                const { id } = type;
                if (!dictionaries.has(id)) {
                    if (data?.dictionary) {
                        dictionaries.set(id, data.dictionary);
                    }
                } else if (dictionaries.get(id) !== data.dictionary) {
                    throw new Error(`Cannot create Schema containing two different dictionaries with the same Id`);
                }
            }
        }
    }
    return dictionaries;
}

/**
 * An internal class used by the `RecordBatchReader` and `RecordBatchWriter`
 * implementations to differentiate between a stream with valid zero-length
 * RecordBatches, and a stream with a Schema message, but no RecordBatches.
 * @see https://github.com/apache/arrow/pull/4373
 * @ignore
 * @private
 */
export class _InternalEmptyPlaceholderRecordBatch<T extends TypeMap = any> extends RecordBatch<T> {
    constructor(schema: Schema<T>) {
        const children = schema.fields.map((f) => makeData({ type: f.type }));
        const data = makeData({ type: new Struct<T>(schema.fields), nullCount: 0, children });
        super(schema, data);
    }
}
