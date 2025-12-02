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
exports._InternalEmptyPlaceholderRecordBatch = exports.RecordBatch = void 0;
const data_js_1 = require("./data.js");
const table_js_1 = require("./table.js");
const vector_js_1 = require("./vector.js");
const schema_js_1 = require("./schema.js");
const type_js_1 = require("./type.js");
const vector_js_2 = require("./util/vector.js");
const get_js_1 = require("./visitor/get.js");
const set_js_1 = require("./visitor/set.js");
const indexof_js_1 = require("./visitor/indexof.js");
const iterator_js_1 = require("./visitor/iterator.js");
/** @ignore */
class RecordBatch {
    constructor(...args) {
        switch (args.length) {
            case 2: {
                [this.schema] = args;
                if (!(this.schema instanceof schema_js_1.Schema)) {
                    throw new TypeError('RecordBatch constructor expects a [Schema, Data] pair.');
                }
                [,
                    this.data = (0, data_js_1.makeData)({
                        nullCount: 0,
                        type: new type_js_1.Struct(this.schema.fields),
                        children: this.schema.fields.map((f) => (0, data_js_1.makeData)({ type: f.type, nullCount: 0 }))
                    })
                ] = args;
                if (!(this.data instanceof data_js_1.Data)) {
                    throw new TypeError('RecordBatch constructor expects a [Schema, Data] pair.');
                }
                [this.schema, this.data] = ensureSameLengthData(this.schema, this.data.children);
                break;
            }
            case 1: {
                const [obj] = args;
                const { fields, children, length } = Object.keys(obj).reduce((memo, name, i) => {
                    memo.children[i] = obj[name];
                    memo.length = Math.max(memo.length, obj[name].length);
                    memo.fields[i] = schema_js_1.Field.new({ name, type: obj[name].type, nullable: true });
                    return memo;
                }, {
                    length: 0,
                    fields: new Array(),
                    children: new Array(),
                });
                const schema = new schema_js_1.Schema(fields);
                const data = (0, data_js_1.makeData)({ type: new type_js_1.Struct(fields), length, children, nullCount: 0 });
                [this.schema, this.data] = ensureSameLengthData(schema, data.children, length);
                break;
            }
            default: throw new TypeError('RecordBatch constructor expects an Object mapping names to child Data, or a [Schema, Data] pair.');
        }
    }
    get dictionaries() {
        return this._dictionaries || (this._dictionaries = collectDictionaries(this.schema.fields, this.data.children));
    }
    /**
     * The number of columns in this RecordBatch.
     */
    get numCols() { return this.schema.fields.length; }
    /**
     * The number of rows in this RecordBatch.
     */
    get numRows() { return this.data.length; }
    /**
     * The number of null rows in this RecordBatch.
     */
    get nullCount() {
        return this.data.nullCount;
    }
    /**
     * Check whether an row is null.
     * @param index The index at which to read the validity bitmap.
     */
    isValid(index) {
        return this.data.getValid(index);
    }
    /**
     * Get a row by position.
     * @param index The index of the row to read.
     */
    get(index) {
        return get_js_1.instance.visit(this.data, index);
    }
    /**
      * Get a row value by position.
      * @param index The index of the row to read. A negative index will count back from the last row.
      */
    at(index) {
        return this.get((0, vector_js_2.wrapIndex)(index, this.numRows));
    }
    /**
     * Set a row by position.
     * @param index The index of the row to write.
     * @param value The value to set.
     */
    set(index, value) {
        return set_js_1.instance.visit(this.data, index, value);
    }
    /**
     * Retrieve the index of the first occurrence of a row in an RecordBatch.
     * @param element The row to locate in the RecordBatch.
     * @param offset The index at which to begin the search. If offset is omitted, the search starts at index 0.
     */
    indexOf(element, offset) {
        return indexof_js_1.instance.visit(this.data, element, offset);
    }
    /**
     * Iterator for rows in this RecordBatch.
     */
    [Symbol.iterator]() {
        return iterator_js_1.instance.visit(new vector_js_1.Vector([this.data]));
    }
    /**
     * Return a JavaScript Array of the RecordBatch rows.
     * @returns An Array of RecordBatch rows.
     */
    toArray() {
        return [...this];
    }
    /**
     * Combines two or more RecordBatch of the same schema.
     * @param others Additional RecordBatch to add to the end of this RecordBatch.
     */
    concat(...others) {
        return new table_js_1.Table(this.schema, [this, ...others]);
    }
    /**
     * Return a zero-copy sub-section of this RecordBatch.
     * @param start The beginning of the specified portion of the RecordBatch.
     * @param end The end of the specified portion of the RecordBatch. This is exclusive of the row at the index 'end'.
     */
    slice(begin, end) {
        const [slice] = new vector_js_1.Vector([this.data]).slice(begin, end).data;
        return new RecordBatch(this.schema, slice);
    }
    /**
     * Returns a child Vector by name, or null if this Vector has no child with the given name.
     * @param name The name of the child to retrieve.
     */
    getChild(name) {
        var _b;
        return this.getChildAt((_b = this.schema.fields) === null || _b === void 0 ? void 0 : _b.findIndex((f) => f.name === name));
    }
    /**
     * Returns a child Vector by index, or null if this Vector has no child at the supplied index.
     * @param index The index of the child to retrieve.
     */
    getChildAt(index) {
        if (index > -1 && index < this.schema.fields.length) {
            return new vector_js_1.Vector([this.data.children[index]]);
        }
        return null;
    }
    /**
     * Sets a child Vector by name.
     * @param name The name of the child to overwrite.
     * @returns A new RecordBatch with the new child for the specified name.
     */
    setChild(name, child) {
        var _b;
        return this.setChildAt((_b = this.schema.fields) === null || _b === void 0 ? void 0 : _b.findIndex((f) => f.name === name), child);
    }
    setChildAt(index, child) {
        let schema = this.schema;
        let data = this.data;
        if (index > -1 && index < this.numCols) {
            if (!child) {
                child = new vector_js_1.Vector([(0, data_js_1.makeData)({ type: new type_js_1.Null, length: this.numRows })]);
            }
            const fields = schema.fields.slice();
            const children = data.children.slice();
            const field = fields[index].clone({ type: child.type });
            [fields[index], children[index]] = [field, child.data[0]];
            schema = new schema_js_1.Schema(fields, new Map(this.schema.metadata));
            data = (0, data_js_1.makeData)({ type: new type_js_1.Struct(fields), children });
        }
        return new RecordBatch(schema, data);
    }
    /**
     * Construct a new RecordBatch containing only specified columns.
     *
     * @param columnNames Names of columns to keep.
     * @returns A new RecordBatch of columns matching the specified names.
     */
    select(columnNames) {
        const schema = this.schema.select(columnNames);
        const type = new type_js_1.Struct(schema.fields);
        const children = [];
        for (const name of columnNames) {
            const index = this.schema.fields.findIndex((f) => f.name === name);
            if (~index) {
                children[index] = this.data.children[index];
            }
        }
        return new RecordBatch(schema, (0, data_js_1.makeData)({ type, length: this.numRows, children }));
    }
    /**
     * Construct a new RecordBatch containing only columns at the specified indices.
     *
     * @param columnIndices Indices of columns to keep.
     * @returns A new RecordBatch of columns matching at the specified indices.
     */
    selectAt(columnIndices) {
        const schema = this.schema.selectAt(columnIndices);
        const children = columnIndices.map((i) => this.data.children[i]).filter(Boolean);
        const subset = (0, data_js_1.makeData)({ type: new type_js_1.Struct(schema.fields), length: this.numRows, children });
        return new RecordBatch(schema, subset);
    }
}
exports.RecordBatch = RecordBatch;
_a = Symbol.toStringTag;
// Initialize this static property via an IIFE so bundlers don't tree-shake
// out this logic, but also so we're still compliant with `"sideEffects": false`
RecordBatch[_a] = ((proto) => {
    proto._nullCount = -1;
    proto[Symbol.isConcatSpreadable] = true;
    return 'RecordBatch';
})(RecordBatch.prototype);
/** @ignore */
function ensureSameLengthData(schema, chunks, maxLength = chunks.reduce((max, col) => Math.max(max, col.length), 0)) {
    var _b;
    const fields = [...schema.fields];
    const children = [...chunks];
    const nullBitmapSize = ((maxLength + 63) & ~63) >> 3;
    for (const [idx, field] of schema.fields.entries()) {
        const chunk = chunks[idx];
        if (!chunk || chunk.length !== maxLength) {
            fields[idx] = field.clone({ nullable: true });
            children[idx] = (_b = chunk === null || chunk === void 0 ? void 0 : chunk._changeLengthAndBackfillNullBitmap(maxLength)) !== null && _b !== void 0 ? _b : (0, data_js_1.makeData)({
                type: field.type,
                length: maxLength,
                nullCount: maxLength,
                nullBitmap: new Uint8Array(nullBitmapSize)
            });
        }
    }
    return [
        schema.assign(fields),
        (0, data_js_1.makeData)({ type: new type_js_1.Struct(fields), length: maxLength, children })
    ];
}
/** @ignore */
function collectDictionaries(fields, children, dictionaries = new Map()) {
    var _b, _c;
    if (((_b = fields === null || fields === void 0 ? void 0 : fields.length) !== null && _b !== void 0 ? _b : 0) > 0 && ((fields === null || fields === void 0 ? void 0 : fields.length) === (children === null || children === void 0 ? void 0 : children.length))) {
        for (let i = -1, n = fields.length; ++i < n;) {
            const { type } = fields[i];
            const data = children[i];
            for (const next of [data, ...(((_c = data === null || data === void 0 ? void 0 : data.dictionary) === null || _c === void 0 ? void 0 : _c.data) || [])]) {
                collectDictionaries(type.children, next === null || next === void 0 ? void 0 : next.children, dictionaries);
            }
            if (type_js_1.DataType.isDictionary(type)) {
                const { id } = type;
                if (!dictionaries.has(id)) {
                    if (data === null || data === void 0 ? void 0 : data.dictionary) {
                        dictionaries.set(id, data.dictionary);
                    }
                }
                else if (dictionaries.get(id) !== data.dictionary) {
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
class _InternalEmptyPlaceholderRecordBatch extends RecordBatch {
    constructor(schema) {
        const children = schema.fields.map((f) => (0, data_js_1.makeData)({ type: f.type }));
        const data = (0, data_js_1.makeData)({ type: new type_js_1.Struct(schema.fields), nullCount: 0, children });
        super(schema, data);
    }
}
exports._InternalEmptyPlaceholderRecordBatch = _InternalEmptyPlaceholderRecordBatch;

//# sourceMappingURL=recordbatch.js.map
