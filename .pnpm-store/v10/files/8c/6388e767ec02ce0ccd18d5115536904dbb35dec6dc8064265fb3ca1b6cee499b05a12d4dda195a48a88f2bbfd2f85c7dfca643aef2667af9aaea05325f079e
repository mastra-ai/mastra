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
exports.builderThroughAsyncIterable = exports.builderThroughIterable = exports.tableFromJSON = exports.vectorFromArray = exports.makeBuilder = void 0;
const tslib_1 = require("tslib");
const schema_js_1 = require("./schema.js");
const dtypes = require("./type.js");
const data_js_1 = require("./data.js");
const vector_js_1 = require("./vector.js");
const builderctor_js_1 = require("./visitor/builderctor.js");
const table_js_1 = require("./table.js");
const recordbatch_js_1 = require("./recordbatch.js");
const typecomparator_js_1 = require("./visitor/typecomparator.js");
function makeBuilder(options) {
    const type = options.type;
    const builder = new (builderctor_js_1.instance.getVisitFn(type)())(options);
    if (type.children && type.children.length > 0) {
        const children = options['children'] || [];
        const defaultOptions = { 'nullValues': options['nullValues'] };
        const getChildOptions = Array.isArray(children)
            ? ((_, i) => children[i] || defaultOptions)
            : (({ name }) => children[name] || defaultOptions);
        for (const [index, field] of type.children.entries()) {
            const { type } = field;
            const opts = getChildOptions(field, index);
            builder.children.push(makeBuilder(Object.assign(Object.assign({}, opts), { type })));
        }
    }
    return builder;
}
exports.makeBuilder = makeBuilder;
function vectorFromArray(init, type) {
    if (init instanceof data_js_1.Data || init instanceof vector_js_1.Vector || init.type instanceof dtypes.DataType || ArrayBuffer.isView(init)) {
        return (0, vector_js_1.makeVector)(init);
    }
    const options = { type: type !== null && type !== void 0 ? type : inferType(init), nullValues: [null] };
    const chunks = [...builderThroughIterable(options)(init)];
    const vector = chunks.length === 1 ? chunks[0] : chunks.reduce((a, b) => a.concat(b));
    if (dtypes.DataType.isDictionary(vector.type)) {
        return vector.memoize();
    }
    return vector;
}
exports.vectorFromArray = vectorFromArray;
/**
 * Creates a {@link Table} from an array of objects.
 *
 * @param array A table of objects.
 */
function tableFromJSON(array) {
    const vector = vectorFromArray(array);
    const batch = new recordbatch_js_1.RecordBatch(new schema_js_1.Schema(vector.type.children), vector.data[0]);
    return new table_js_1.Table(batch);
}
exports.tableFromJSON = tableFromJSON;
function inferType(value) {
    if (value.length === 0) {
        return new dtypes.Null;
    }
    let nullsCount = 0;
    let arraysCount = 0;
    let objectsCount = 0;
    let numbersCount = 0;
    let stringsCount = 0;
    let bigintsCount = 0;
    let booleansCount = 0;
    let datesCount = 0;
    for (const val of value) {
        if (val == null) {
            ++nullsCount;
            continue;
        }
        switch (typeof val) {
            case 'bigint':
                ++bigintsCount;
                continue;
            case 'boolean':
                ++booleansCount;
                continue;
            case 'number':
                ++numbersCount;
                continue;
            case 'string':
                ++stringsCount;
                continue;
            case 'object':
                if (Array.isArray(val)) {
                    ++arraysCount;
                }
                else if (Object.prototype.toString.call(val) === '[object Date]') {
                    ++datesCount;
                }
                else {
                    ++objectsCount;
                }
                continue;
        }
        throw new TypeError('Unable to infer Vector type from input values, explicit type declaration expected.');
    }
    if (numbersCount + nullsCount === value.length) {
        return new dtypes.Float64;
    }
    else if (stringsCount + nullsCount === value.length) {
        return new dtypes.Dictionary(new dtypes.Utf8, new dtypes.Int32);
    }
    else if (bigintsCount + nullsCount === value.length) {
        return new dtypes.Int64;
    }
    else if (booleansCount + nullsCount === value.length) {
        return new dtypes.Bool;
    }
    else if (datesCount + nullsCount === value.length) {
        return new dtypes.TimestampMillisecond;
    }
    else if (arraysCount + nullsCount === value.length) {
        const array = value;
        const childType = inferType(array[array.findIndex((ary) => ary != null)]);
        if (array.every((ary) => ary == null || (0, typecomparator_js_1.compareTypes)(childType, inferType(ary)))) {
            return new dtypes.List(new schema_js_1.Field('', childType, true));
        }
    }
    else if (objectsCount + nullsCount === value.length) {
        const fields = new Map();
        for (const row of value) {
            for (const key of Object.keys(row)) {
                if (!fields.has(key) && row[key] != null) {
                    // use the type inferred for the first instance of a found key
                    fields.set(key, new schema_js_1.Field(key, inferType([row[key]]), true));
                }
            }
        }
        return new dtypes.Struct([...fields.values()]);
    }
    throw new TypeError('Unable to infer Vector type from input values, explicit type declaration expected.');
}
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
function builderThroughIterable(options) {
    const { ['queueingStrategy']: queueingStrategy = 'count' } = options;
    const { ['highWaterMark']: highWaterMark = queueingStrategy !== 'bytes' ? Number.POSITIVE_INFINITY : Math.pow(2, 14) } = options;
    const sizeProperty = queueingStrategy !== 'bytes' ? 'length' : 'byteLength';
    return function* (source) {
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
    };
}
exports.builderThroughIterable = builderThroughIterable;
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
function builderThroughAsyncIterable(options) {
    const { ['queueingStrategy']: queueingStrategy = 'count' } = options;
    const { ['highWaterMark']: highWaterMark = queueingStrategy !== 'bytes' ? Number.POSITIVE_INFINITY : Math.pow(2, 14) } = options;
    const sizeProperty = queueingStrategy !== 'bytes' ? 'length' : 'byteLength';
    return function (source) {
        return tslib_1.__asyncGenerator(this, arguments, function* () {
            var _a, e_1, _b, _c;
            let numChunks = 0;
            const builder = makeBuilder(options);
            try {
                for (var _d = true, source_1 = tslib_1.__asyncValues(source), source_1_1; source_1_1 = yield tslib_1.__await(source_1.next()), _a = source_1_1.done, !_a; _d = true) {
                    _c = source_1_1.value;
                    _d = false;
                    const value = _c;
                    if (builder.append(value)[sizeProperty] >= highWaterMark) {
                        ++numChunks && (yield yield tslib_1.__await(builder.toVector()));
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = source_1.return)) yield tslib_1.__await(_b.call(source_1));
                }
                finally { if (e_1) throw e_1.error; }
            }
            if (builder.finish().length > 0 || numChunks === 0) {
                yield yield tslib_1.__await(builder.toVector());
            }
        });
    };
}
exports.builderThroughAsyncIterable = builderThroughAsyncIterable;

//# sourceMappingURL=factories.js.map
