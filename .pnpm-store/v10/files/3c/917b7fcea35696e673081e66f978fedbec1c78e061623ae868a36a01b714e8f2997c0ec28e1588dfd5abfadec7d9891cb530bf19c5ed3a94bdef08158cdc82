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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.tableFromArrays = exports.makeTable = exports.Table = void 0;
const enum_js_1 = require("./enum.js");
const data_js_1 = require("./data.js");
const factories_js_1 = require("./factories.js");
const vector_js_1 = require("./vector.js");
const schema_js_1 = require("./schema.js");
const type_js_1 = require("./type.js");
const typecomparator_js_1 = require("./visitor/typecomparator.js");
const recordbatch_js_1 = require("./util/recordbatch.js");
const chunk_js_1 = require("./util/chunk.js");
const get_js_1 = require("./visitor/get.js");
const set_js_1 = require("./visitor/set.js");
const indexof_js_1 = require("./visitor/indexof.js");
const iterator_js_1 = require("./visitor/iterator.js");
const vector_js_2 = require("./util/vector.js");
const recordbatch_js_2 = require("./recordbatch.js");
/**
 * Tables are collections of {@link Vector}s and have a {@link Schema}. Use the convenience methods {@link makeTable}
 * or {@link tableFromArrays} to create a table in JavaScript. To create a table from the IPC format, use
 * {@link tableFromIPC}.
 */
class Table {
    constructor(...args) {
        var _b, _c;
        if (args.length === 0) {
            this.batches = [];
            this.schema = new schema_js_1.Schema([]);
            this._offsets = [0];
            return this;
        }
        let schema;
        let offsets;
        if (args[0] instanceof schema_js_1.Schema) {
            schema = args.shift();
        }
        if (args.at(-1) instanceof Uint32Array) {
            offsets = args.pop();
        }
        const unwrap = (x) => {
            if (x) {
                if (x instanceof recordbatch_js_2.RecordBatch) {
                    return [x];
                }
                else if (x instanceof Table) {
                    return x.batches;
                }
                else if (x instanceof data_js_1.Data) {
                    if (x.type instanceof type_js_1.Struct) {
                        return [new recordbatch_js_2.RecordBatch(new schema_js_1.Schema(x.type.children), x)];
                    }
                }
                else if (Array.isArray(x)) {
                    return x.flatMap(v => unwrap(v));
                }
                else if (typeof x[Symbol.iterator] === 'function') {
                    return [...x].flatMap(v => unwrap(v));
                }
                else if (typeof x === 'object') {
                    const keys = Object.keys(x);
                    const vecs = keys.map((k) => new vector_js_1.Vector([x[k]]));
                    const batchSchema = schema !== null && schema !== void 0 ? schema : new schema_js_1.Schema(keys.map((k, i) => new schema_js_1.Field(String(k), vecs[i].type, vecs[i].nullable)));
                    const [, batches] = (0, recordbatch_js_1.distributeVectorsIntoRecordBatches)(batchSchema, vecs);
                    return batches.length === 0 ? [new recordbatch_js_2.RecordBatch(x)] : batches;
                }
            }
            return [];
        };
        const batches = args.flatMap(v => unwrap(v));
        schema = (_c = schema !== null && schema !== void 0 ? schema : (_b = batches[0]) === null || _b === void 0 ? void 0 : _b.schema) !== null && _c !== void 0 ? _c : new schema_js_1.Schema([]);
        if (!(schema instanceof schema_js_1.Schema)) {
            throw new TypeError('Table constructor expects a [Schema, RecordBatch[]] pair.');
        }
        for (const batch of batches) {
            if (!(batch instanceof recordbatch_js_2.RecordBatch)) {
                throw new TypeError('Table constructor expects a [Schema, RecordBatch[]] pair.');
            }
            if (!(0, typecomparator_js_1.compareSchemas)(schema, batch.schema)) {
                throw new TypeError('Table and inner RecordBatch schemas must be equivalent.');
            }
        }
        this.schema = schema;
        this.batches = batches;
        this._offsets = offsets !== null && offsets !== void 0 ? offsets : (0, chunk_js_1.computeChunkOffsets)(this.data);
    }
    /**
     * The contiguous {@link RecordBatch `RecordBatch`} chunks of the Table rows.
     */
    get data() { return this.batches.map(({ data }) => data); }
    /**
     * The number of columns in this Table.
     */
    get numCols() { return this.schema.fields.length; }
    /**
     * The number of rows in this Table.
     */
    get numRows() {
        return this.data.reduce((numRows, data) => numRows + data.length, 0);
    }
    /**
     * The number of null rows in this Table.
     */
    get nullCount() {
        if (this._nullCount === -1) {
            this._nullCount = (0, chunk_js_1.computeChunkNullCounts)(this.data);
        }
        return this._nullCount;
    }
    /**
     * Check whether an element is null.
     *
     * @param index The index at which to read the validity bitmap.
     */
    // @ts-ignore
    isValid(index) { return false; }
    /**
     * Get an element value by position.
     *
     * @param index The index of the element to read.
     */
    // @ts-ignore
    get(index) { return null; }
    /**
      * Get an element value by position.
      * @param index The index of the element to read. A negative index will count back from the last element.
      */
    // @ts-ignore
    at(index) {
        return this.get((0, vector_js_2.wrapIndex)(index, this.numRows));
    }
    /**
     * Set an element value by position.
     *
     * @param index The index of the element to write.
     * @param value The value to set.
     */
    // @ts-ignore
    set(index, value) { return; }
    /**
     * Retrieve the index of the first occurrence of a value in an Vector.
     *
     * @param element The value to locate in the Vector.
     * @param offset The index at which to begin the search. If offset is omitted, the search starts at index 0.
     */
    // @ts-ignore
    indexOf(element, offset) { return -1; }
    /**
     * Iterator for rows in this Table.
     */
    [Symbol.iterator]() {
        if (this.batches.length > 0) {
            return iterator_js_1.instance.visit(new vector_js_1.Vector(this.data));
        }
        return (new Array(0))[Symbol.iterator]();
    }
    /**
     * Return a JavaScript Array of the Table rows.
     *
     * @returns An Array of Table rows.
     */
    toArray() {
        return [...this];
    }
    /**
     * Returns a string representation of the Table rows.
     *
     * @returns A string representation of the Table rows.
     */
    toString() {
        return `[\n  ${this.toArray().join(',\n  ')}\n]`;
    }
    /**
     * Combines two or more Tables of the same schema.
     *
     * @param others Additional Tables to add to the end of this Tables.
     */
    concat(...others) {
        const schema = this.schema;
        const data = this.data.concat(others.flatMap(({ data }) => data));
        return new Table(schema, data.map((data) => new recordbatch_js_2.RecordBatch(schema, data)));
    }
    /**
     * Return a zero-copy sub-section of this Table.
     *
     * @param begin The beginning of the specified portion of the Table.
     * @param end The end of the specified portion of the Table. This is exclusive of the element at the index 'end'.
     */
    slice(begin, end) {
        const schema = this.schema;
        [begin, end] = (0, vector_js_2.clampRange)({ length: this.numRows }, begin, end);
        const data = (0, chunk_js_1.sliceChunks)(this.data, this._offsets, begin, end);
        return new Table(schema, data.map((chunk) => new recordbatch_js_2.RecordBatch(schema, chunk)));
    }
    /**
     * Returns a child Vector by name, or null if this Vector has no child with the given name.
     *
     * @param name The name of the child to retrieve.
     */
    getChild(name) {
        return this.getChildAt(this.schema.fields.findIndex((f) => f.name === name));
    }
    /**
     * Returns a child Vector by index, or null if this Vector has no child at the supplied index.
     *
     * @param index The index of the child to retrieve.
     */
    getChildAt(index) {
        if (index > -1 && index < this.schema.fields.length) {
            const data = this.data.map((data) => data.children[index]);
            if (data.length === 0) {
                const { type } = this.schema.fields[index];
                const empty = (0, data_js_1.makeData)({ type, length: 0, nullCount: 0 });
                data.push(empty._changeLengthAndBackfillNullBitmap(this.numRows));
            }
            return new vector_js_1.Vector(data);
        }
        return null;
    }
    /**
     * Sets a child Vector by name.
     *
     * @param name The name of the child to overwrite.
     * @returns A new Table with the supplied child for the specified name.
     */
    setChild(name, child) {
        var _b;
        return this.setChildAt((_b = this.schema.fields) === null || _b === void 0 ? void 0 : _b.findIndex((f) => f.name === name), child);
    }
    setChildAt(index, child) {
        let schema = this.schema;
        let batches = [...this.batches];
        if (index > -1 && index < this.numCols) {
            if (!child) {
                child = new vector_js_1.Vector([(0, data_js_1.makeData)({ type: new type_js_1.Null, length: this.numRows })]);
            }
            const fields = schema.fields.slice();
            const field = fields[index].clone({ type: child.type });
            const children = this.schema.fields.map((_, i) => this.getChildAt(i));
            [fields[index], children[index]] = [field, child];
            [schema, batches] = (0, recordbatch_js_1.distributeVectorsIntoRecordBatches)(schema, children);
        }
        return new Table(schema, batches);
    }
    /**
     * Construct a new Table containing only specified columns.
     *
     * @param columnNames Names of columns to keep.
     * @returns A new Table of columns matching the specified names.
     */
    select(columnNames) {
        const nameToIndex = this.schema.fields.reduce((m, f, i) => m.set(f.name, i), new Map());
        return this.selectAt(columnNames.map((columnName) => nameToIndex.get(columnName)).filter((x) => x > -1));
    }
    /**
     * Construct a new Table containing only columns at the specified indices.
     *
     * @param columnIndices Indices of columns to keep.
     * @returns A new Table of columns at the specified indices.
     */
    selectAt(columnIndices) {
        const schema = this.schema.selectAt(columnIndices);
        const data = this.batches.map((batch) => batch.selectAt(columnIndices));
        return new Table(schema, data);
    }
    assign(other) {
        const fields = this.schema.fields;
        const [indices, oldToNew] = other.schema.fields.reduce((memo, f2, newIdx) => {
            const [indices, oldToNew] = memo;
            const i = fields.findIndex((f) => f.name === f2.name);
            ~i ? (oldToNew[i] = newIdx) : indices.push(newIdx);
            return memo;
        }, [[], []]);
        const schema = this.schema.assign(other.schema);
        const columns = [
            ...fields.map((_, i) => [i, oldToNew[i]]).map(([i, j]) => (j === undefined ? this.getChildAt(i) : other.getChildAt(j))),
            ...indices.map((i) => other.getChildAt(i))
        ].filter(Boolean);
        return new Table(...(0, recordbatch_js_1.distributeVectorsIntoRecordBatches)(schema, columns));
    }
}
exports.Table = Table;
_a = Symbol.toStringTag;
// Initialize this static property via an IIFE so bundlers don't tree-shake
// out this logic, but also so we're still compliant with `"sideEffects": false`
Table[_a] = ((proto) => {
    proto.schema = null;
    proto.batches = [];
    proto._offsets = new Uint32Array([0]);
    proto._nullCount = -1;
    proto[Symbol.isConcatSpreadable] = true;
    proto['isValid'] = (0, chunk_js_1.wrapChunkedCall1)(chunk_js_1.isChunkedValid);
    proto['get'] = (0, chunk_js_1.wrapChunkedCall1)(get_js_1.instance.getVisitFn(enum_js_1.Type.Struct));
    proto['set'] = (0, chunk_js_1.wrapChunkedCall2)(set_js_1.instance.getVisitFn(enum_js_1.Type.Struct));
    proto['indexOf'] = (0, chunk_js_1.wrapChunkedIndexOf)(indexof_js_1.instance.getVisitFn(enum_js_1.Type.Struct));
    return 'Table';
})(Table.prototype);
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
function makeTable(input) {
    const vecs = {};
    const inputs = Object.entries(input);
    for (const [key, col] of inputs) {
        vecs[key] = (0, vector_js_1.makeVector)(col);
    }
    return new Table(vecs);
}
exports.makeTable = makeTable;
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
function tableFromArrays(input) {
    const vecs = {};
    const inputs = Object.entries(input);
    for (const [key, col] of inputs) {
        vecs[key] = (0, factories_js_1.vectorFromArray)(col);
    }
    return new Table(vecs);
}
exports.tableFromArrays = tableFromArrays;

//# sourceMappingURL=table.js.map
