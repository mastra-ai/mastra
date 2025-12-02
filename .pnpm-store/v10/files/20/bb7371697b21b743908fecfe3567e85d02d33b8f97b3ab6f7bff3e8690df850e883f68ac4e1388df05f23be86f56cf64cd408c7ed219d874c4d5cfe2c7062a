"use strict";
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: Copyright The LanceDB Authors
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MakeArrowTableOptions = exports.VectorColumnOptions = void 0;
exports.isMultiVector = isMultiVector;
exports.isIntoVector = isIntoVector;
exports.isArrowTable = isArrowTable;
exports.isNull = isNull;
exports.isInt = isInt;
exports.isFloat = isFloat;
exports.isBinary = isBinary;
exports.isLargeBinary = isLargeBinary;
exports.isUtf8 = isUtf8;
exports.isLargeUtf8 = isLargeUtf8;
exports.isBool = isBool;
exports.isDecimal = isDecimal;
exports.isDate = isDate;
exports.isTime = isTime;
exports.isTimestamp = isTimestamp;
exports.isInterval = isInterval;
exports.isDuration = isDuration;
exports.isList = isList;
exports.isStruct = isStruct;
exports.isUnion = isUnion;
exports.isFixedSizeBinary = isFixedSizeBinary;
exports.isFixedSizeList = isFixedSizeList;
exports.makeArrowTable = makeArrowTable;
exports.makeEmptyTable = makeEmptyTable;
exports.convertToTable = convertToTable;
exports.newVectorType = newVectorType;
exports.fromRecordsToBuffer = fromRecordsToBuffer;
exports.fromRecordsToStreamBuffer = fromRecordsToStreamBuffer;
exports.fromTableToBuffer = fromTableToBuffer;
exports.fromDataToBuffer = fromDataToBuffer;
exports.fromBufferToRecordBatch = fromBufferToRecordBatch;
exports.fromRecordBatchToBuffer = fromRecordBatchToBuffer;
exports.fromTableToStreamBuffer = fromTableToStreamBuffer;
exports.createEmptyTable = createEmptyTable;
exports.ensureNestedFieldsExist = ensureNestedFieldsExist;
exports.dataTypeToJson = dataTypeToJson;
const apache_arrow_1 = require("apache-arrow");
const registry_1 = require("./embedding/registry");
const sanitize_1 = require("./sanitize");
/**
 * Check if a field name indicates a vector column.
 */
function nameSuggestsVectorColumn(fieldName) {
    const nameLower = fieldName.toLowerCase();
    return nameLower.includes("vector") || nameLower.includes("embedding");
}
__exportStar(require("apache-arrow"), exports);
function isMultiVector(value) {
    return Array.isArray(value) && isIntoVector(value[0]);
}
function isIntoVector(value) {
    return (value instanceof Float32Array ||
        value instanceof Float64Array ||
        (Array.isArray(value) && !Array.isArray(value[0])));
}
function isArrowTable(value) {
    if (value instanceof apache_arrow_1.Table)
        return true;
    return "schema" in value && "batches" in value;
}
function isNull(value) {
    return value instanceof apache_arrow_1.Null || apache_arrow_1.DataType.isNull(value);
}
function isInt(value) {
    return value instanceof apache_arrow_1.Int || apache_arrow_1.DataType.isInt(value);
}
function isFloat(value) {
    return value instanceof apache_arrow_1.Float || apache_arrow_1.DataType.isFloat(value);
}
function isBinary(value) {
    return value instanceof apache_arrow_1.Binary || apache_arrow_1.DataType.isBinary(value);
}
function isLargeBinary(value) {
    return value instanceof apache_arrow_1.LargeBinary || apache_arrow_1.DataType.isLargeBinary(value);
}
function isUtf8(value) {
    return value instanceof apache_arrow_1.Utf8 || apache_arrow_1.DataType.isUtf8(value);
}
function isLargeUtf8(value) {
    return value instanceof apache_arrow_1.Utf8 || apache_arrow_1.DataType.isLargeUtf8(value);
}
function isBool(value) {
    return value instanceof apache_arrow_1.Utf8 || apache_arrow_1.DataType.isBool(value);
}
function isDecimal(value) {
    return value instanceof apache_arrow_1.Utf8 || apache_arrow_1.DataType.isDecimal(value);
}
function isDate(value) {
    return value instanceof apache_arrow_1.Utf8 || apache_arrow_1.DataType.isDate(value);
}
function isTime(value) {
    return value instanceof apache_arrow_1.Utf8 || apache_arrow_1.DataType.isTime(value);
}
function isTimestamp(value) {
    return value instanceof apache_arrow_1.Utf8 || apache_arrow_1.DataType.isTimestamp(value);
}
function isInterval(value) {
    return value instanceof apache_arrow_1.Utf8 || apache_arrow_1.DataType.isInterval(value);
}
function isDuration(value) {
    return value instanceof apache_arrow_1.Utf8 || apache_arrow_1.DataType.isDuration(value);
}
function isList(value) {
    return value instanceof apache_arrow_1.List || apache_arrow_1.DataType.isList(value);
}
function isStruct(value) {
    return value instanceof apache_arrow_1.Struct || apache_arrow_1.DataType.isStruct(value);
}
function isUnion(value) {
    return value instanceof apache_arrow_1.Struct || apache_arrow_1.DataType.isUnion(value);
}
function isFixedSizeBinary(value) {
    return value instanceof apache_arrow_1.FixedSizeBinary || apache_arrow_1.DataType.isFixedSizeBinary(value);
}
function isFixedSizeList(value) {
    return value instanceof apache_arrow_1.FixedSizeList || apache_arrow_1.DataType.isFixedSizeList(value);
}
/*
 * Options to control how a column should be converted to a vector array
 */
class VectorColumnOptions {
    /** Vector column type. */
    type = new apache_arrow_1.Float32();
    constructor(values) {
        Object.assign(this, values);
    }
}
exports.VectorColumnOptions = VectorColumnOptions;
// biome-ignore lint/suspicious/noExplicitAny: skip
function vectorFromArray(data, type) {
    // Workaround for: https://github.com/apache/arrow/issues/45862
    // If FSL type with float
    if (apache_arrow_1.DataType.isFixedSizeList(type) && apache_arrow_1.DataType.isFloat(type.valueType)) {
        const extendedData = [...data, new Array(type.listSize).fill(0.0)];
        const array = (0, apache_arrow_1.vectorFromArray)(extendedData, type);
        return array.slice(0, data.length);
    }
    else if (type === undefined) {
        return (0, apache_arrow_1.vectorFromArray)(data);
    }
    else {
        return (0, apache_arrow_1.vectorFromArray)(data, type);
    }
}
/** Options to control the makeArrowTable call. */
class MakeArrowTableOptions {
    /*
     * Schema of the data.
     *
     * If this is not provided then the data type will be inferred from the
     * JS type.  Integer numbers will become int64, floating point numbers
     * will become float64 and arrays will become variable sized lists with
     * the data type inferred from the first element in the array.
     *
     * The schema must be specified if there are no records (e.g. to make
     * an empty table)
     */
    schema;
    /*
     * Mapping from vector column name to expected type
     *
     * Lance expects vector columns to be fixed size list arrays (i.e. tensors)
     * However, `makeArrowTable` will not infer this by default (it creates
     * variable size list arrays).  This field can be used to indicate that a column
     * should be treated as a vector column and converted to a fixed size list.
     *
     * The keys should be the names of the vector columns.  The value specifies the
     * expected data type of the vector columns.
     *
     * If `schema` is provided then this field is ignored.
     *
     * By default, the column named "vector" will be assumed to be a float32
     * vector column.
     */
    vectorColumns = {
        vector: new VectorColumnOptions(),
    };
    embeddings;
    embeddingFunction;
    /**
     * If true then string columns will be encoded with dictionary encoding
     *
     * Set this to true if your string columns tend to repeat the same values
     * often.  For more precise control use the `schema` property to specify the
     * data type for individual columns.
     *
     * If `schema` is provided then this property is ignored.
     */
    dictionaryEncodeStrings = false;
    constructor(values) {
        Object.assign(this, values);
    }
}
exports.MakeArrowTableOptions = MakeArrowTableOptions;
/**
 * An enhanced version of the apache-arrow makeTable function from Apache Arrow
 * that supports nested fields and embeddings columns.
 *
 * (typically you do not need to call this function.  It will be called automatically
 * when creating a table or adding data to it)
 *
 * This function converts an array of Record<String, any> (row-major JS objects)
 * to an Arrow Table (a columnar structure)
 *
 * If a schema is provided then it will be used to determine the resulting array
 * types.  Fields will also be reordered to fit the order defined by the schema.
 *
 * If a schema is not provided then the types will be inferred and the field order
 * will be controlled by the order of properties in the first record.  If a type
 * is inferred it will always be nullable.
 *
 * If not all fields are found in the data, then a subset of the schema will be
 * returned.
 *
 * If the input is empty then a schema must be provided to create an empty table.
 *
 * When a schema is not specified then data types will be inferred.  The inference
 * rules are as follows:
 *
 *  - boolean => Bool
 *  - number => Float64
 *  - bigint => Int64
 *  - String => Utf8
 *  - Buffer => Binary
 *  - Record<String, any> => Struct
 *  - Array<any> => List
 * @example
 * ```ts
 * import { fromTableToBuffer, makeArrowTable } from "../arrow";
 * import { Field, FixedSizeList, Float16, Float32, Int32, Schema } from "apache-arrow";
 *
 * const schema = new Schema([
 *   new Field("a", new Int32()),
 *   new Field("b", new Float32()),
 *   new Field("c", new FixedSizeList(3, new Field("item", new Float16()))),
 *  ]);
 *  const table = makeArrowTable([
 *    { a: 1, b: 2, c: [1, 2, 3] },
 *    { a: 4, b: 5, c: [4, 5, 6] },
 *    { a: 7, b: 8, c: [7, 8, 9] },
 *  ], { schema });
 * ```
 *
 * By default it assumes that the column named `vector` is a vector column
 * and it will be converted into a fixed size list array of type float32.
 * The `vectorColumns` option can be used to support other vector column
 * names and data types.
 *
 * ```ts
 * const schema = new Schema([
 *   new Field("a", new Float64()),
 *   new Field("b", new Float64()),
 *   new Field(
 *     "vector",
 *     new FixedSizeList(3, new Field("item", new Float32()))
 *   ),
 * ]);
 * const table = makeArrowTable([
 *   { a: 1, b: 2, vector: [1, 2, 3] },
 *   { a: 4, b: 5, vector: [4, 5, 6] },
 *   { a: 7, b: 8, vector: [7, 8, 9] },
 * ]);
 * assert.deepEqual(table.schema, schema);
 * ```
 *
 * You can specify the vector column types and names using the options as well
 *
 * ```ts
 * const schema = new Schema([
 *   new Field('a', new Float64()),
 *   new Field('b', new Float64()),
 *   new Field('vec1', new FixedSizeList(3, new Field('item', new Float16()))),
 *   new Field('vec2', new FixedSizeList(3, new Field('item', new Float16())))
 * ]);
 * const table = makeArrowTable([
 *   { a: 1, b: 2, vec1: [1, 2, 3], vec2: [2, 4, 6] },
 *   { a: 4, b: 5, vec1: [4, 5, 6], vec2: [8, 10, 12] },
 *   { a: 7, b: 8, vec1: [7, 8, 9], vec2: [14, 16, 18] }
 * ], {
 *   vectorColumns: {
 *     vec1: { type: new Float16() },
 *     vec2: { type: new Float16() }
 *   }
 * }
 * assert.deepEqual(table.schema, schema)
 * ```
 */
function makeArrowTable(data, options, metadata) {
    const opt = new MakeArrowTableOptions(options !== undefined ? options : {});
    let schema = undefined;
    if (opt.schema !== undefined && opt.schema !== null) {
        schema = (0, sanitize_1.sanitizeSchema)(opt.schema);
        schema = validateSchemaEmbeddings(schema, data, options?.embeddingFunction);
    }
    let schemaMetadata = schema?.metadata || new Map();
    if (metadata !== undefined) {
        schemaMetadata = new Map([...schemaMetadata, ...metadata]);
    }
    if (data.length === 0 &&
        (options?.schema === undefined || options?.schema === null)) {
        throw new Error("At least one record or a schema needs to be provided");
    }
    else if (data.length === 0) {
        if (schema === undefined) {
            throw new Error("A schema must be provided if data is empty");
        }
        else {
            schema = new apache_arrow_1.Schema(schema.fields, schemaMetadata);
            return new apache_arrow_1.Table(schema);
        }
    }
    let inferredSchema = inferSchema(data, schema, opt);
    inferredSchema = new apache_arrow_1.Schema(inferredSchema.fields, schemaMetadata);
    const finalColumns = {};
    for (const field of inferredSchema.fields) {
        finalColumns[field.name] = transposeData(data, field);
    }
    return new apache_arrow_1.Table(inferredSchema, finalColumns);
}
function inferSchema(data, schema, opts) {
    // We will collect all fields we see in the data.
    const pathTree = new PathTree();
    for (const [rowI, row] of data.entries()) {
        for (const [path, value] of rowPathsAndValues(row)) {
            if (!pathTree.has(path)) {
                // First time seeing this field.
                if (schema !== undefined) {
                    const field = getFieldForPath(schema, path);
                    if (field === undefined) {
                        throw new Error(`Found field not in schema: ${path.join(".")} at row ${rowI}`);
                    }
                    else {
                        pathTree.set(path, field.type);
                    }
                }
                else {
                    const inferredType = inferType(value, path, opts);
                    if (inferredType === undefined) {
                        throw new Error(`Failed to infer data type for field ${path.join(".")} at row ${rowI}. \
                             Consider providing an explicit schema.`);
                    }
                    pathTree.set(path, inferredType);
                }
            }
            else if (schema === undefined) {
                const currentType = pathTree.get(path);
                const newType = inferType(value, path, opts);
                if (currentType !== newType) {
                    new Error(`Failed to infer schema for data. Previously inferred type \
                     ${currentType} but found ${newType} at row ${rowI}. Consider \
                     providing an explicit schema.`);
                }
            }
        }
    }
    if (schema === undefined) {
        function fieldsFromPathTree(pathTree) {
            const fields = [];
            for (const [name, value] of pathTree.map.entries()) {
                if (value instanceof PathTree) {
                    const children = fieldsFromPathTree(value);
                    fields.push(new apache_arrow_1.Field(name, new apache_arrow_1.Struct(children), true));
                }
                else {
                    fields.push(new apache_arrow_1.Field(name, value, true));
                }
            }
            return fields;
        }
        const fields = fieldsFromPathTree(pathTree);
        return new apache_arrow_1.Schema(fields);
    }
    else {
        function takeMatchingFields(fields, pathTree) {
            const outFields = [];
            for (const field of fields) {
                if (pathTree.map.has(field.name)) {
                    const value = pathTree.get([field.name]);
                    if (value instanceof PathTree) {
                        const struct = field.type;
                        const children = takeMatchingFields(struct.children, value);
                        outFields.push(new apache_arrow_1.Field(field.name, new apache_arrow_1.Struct(children), field.nullable));
                    }
                    else {
                        outFields.push(new apache_arrow_1.Field(field.name, value, field.nullable));
                    }
                }
            }
            return outFields;
        }
        const fields = takeMatchingFields(schema.fields, pathTree);
        return new apache_arrow_1.Schema(fields);
    }
}
function* rowPathsAndValues(row, basePath = []) {
    for (const [key, value] of Object.entries(row)) {
        if (isObject(value)) {
            yield* rowPathsAndValues(value, [...basePath, key]);
        }
        else {
            // Skip undefined values - they should be treated the same as missing fields
            // for embedding function purposes
            if (value !== undefined) {
                yield [[...basePath, key], value];
            }
        }
    }
}
function isObject(value) {
    return (typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        !(value instanceof RegExp) &&
        !(value instanceof Date) &&
        !(value instanceof Set) &&
        !(value instanceof Map) &&
        !(value instanceof Buffer));
}
function getFieldForPath(schema, path) {
    let current = schema;
    for (const key of path) {
        if (current instanceof apache_arrow_1.Schema) {
            const field = current.fields.find((f) => f.name === key);
            if (field === undefined) {
                return undefined;
            }
            current = field;
        }
        else if (current instanceof apache_arrow_1.Field && apache_arrow_1.DataType.isStruct(current.type)) {
            const struct = current.type;
            const field = struct.children.find((f) => f.name === key);
            if (field === undefined) {
                return undefined;
            }
            current = field;
        }
        else {
            return undefined;
        }
    }
    if (current instanceof apache_arrow_1.Field) {
        return current;
    }
    else {
        return undefined;
    }
}
/**
 * Try to infer which Arrow type to use for a given value.
 *
 * May return undefined if the type cannot be inferred.
 */
function inferType(value, path, opts) {
    if (typeof value === "bigint") {
        return new apache_arrow_1.Int64();
    }
    else if (typeof value === "number") {
        // Even if it's an integer, it's safer to assume Float64. Users can
        // always provide an explicit schema or use BigInt if they mean integer.
        return new apache_arrow_1.Float64();
    }
    else if (typeof value === "string") {
        if (opts.dictionaryEncodeStrings) {
            return new apache_arrow_1.Dictionary(new apache_arrow_1.Utf8(), new apache_arrow_1.Int32());
        }
        else {
            return new apache_arrow_1.Utf8();
        }
    }
    else if (typeof value === "boolean") {
        return new apache_arrow_1.Bool();
    }
    else if (value instanceof Buffer) {
        return new apache_arrow_1.Binary();
    }
    else if (Array.isArray(value)) {
        if (value.length === 0) {
            return undefined; // Without any values we can't infer the type
        }
        if (path.length === 1 && Object.hasOwn(opts.vectorColumns, path[0])) {
            const floatType = (0, sanitize_1.sanitizeType)(opts.vectorColumns[path[0]].type);
            return new apache_arrow_1.FixedSizeList(value.length, new apache_arrow_1.Field("item", floatType, true));
        }
        const valueType = inferType(value[0], path, opts);
        if (valueType === undefined) {
            return undefined;
        }
        // Try to automatically detect embedding columns.
        if (nameSuggestsVectorColumn(path[path.length - 1])) {
            // Check if value is a Uint8Array for integer vector type determination
            if (value instanceof Uint8Array) {
                // For integer vectors, we default to Uint8 (matching Python implementation)
                const child = new apache_arrow_1.Field("item", new apache_arrow_1.Uint8(), true);
                return new apache_arrow_1.FixedSizeList(value.length, child);
            }
            else {
                // For float vectors, we default to Float32
                const child = new apache_arrow_1.Field("item", new apache_arrow_1.Float32(), true);
                return new apache_arrow_1.FixedSizeList(value.length, child);
            }
        }
        else {
            const child = new apache_arrow_1.Field("item", valueType, true);
            return new apache_arrow_1.List(child);
        }
    }
    else {
        // TODO: timestamp
        return undefined;
    }
}
class PathTree {
    map;
    constructor(entries) {
        this.map = new Map();
        if (entries !== undefined) {
            for (const [path, value] of entries) {
                this.set(path, value);
            }
        }
    }
    has(path) {
        let ref = this;
        for (const part of path) {
            if (!(ref instanceof PathTree) || !ref.map.has(part)) {
                return false;
            }
            ref = ref.map.get(part);
        }
        return true;
    }
    get(path) {
        let ref = this;
        for (const part of path) {
            if (!(ref instanceof PathTree) || !ref.map.has(part)) {
                return undefined;
            }
            ref = ref.map.get(part);
        }
        return ref;
    }
    set(path, value) {
        let ref = this;
        for (const part of path.slice(0, path.length - 1)) {
            if (!ref.map.has(part)) {
                ref.map.set(part, new PathTree());
            }
            ref = ref.map.get(part);
        }
        ref.map.set(path[path.length - 1], value);
    }
}
function transposeData(data, field, path = []) {
    if (field.type instanceof apache_arrow_1.Struct) {
        const childFields = field.type.children;
        const fullPath = [...path, field.name];
        const childVectors = childFields.map((child) => {
            return transposeData(data, child, fullPath);
        });
        const structData = (0, apache_arrow_1.makeData)({
            type: field.type,
            children: childVectors,
        });
        return (0, apache_arrow_1.makeVector)(structData);
    }
    else {
        const valuesPath = [...path, field.name];
        const values = data.map((datum) => {
            let current = datum;
            for (const key of valuesPath) {
                if (current == null) {
                    return null;
                }
                if (isObject(current) &&
                    (Object.hasOwn(current, key) || key in current)) {
                    current = current[key];
                }
                else {
                    return null;
                }
            }
            return current;
        });
        return makeVector(values, field.type, undefined, field.nullable);
    }
}
/**
 * Create an empty Arrow table with the provided schema
 */
function makeEmptyTable(schema, metadata) {
    return makeArrowTable([], { schema }, metadata);
}
/**
 * Helper function to convert Array<Array<any>> to a variable sized list array
 */
// @ts-expect-error (Vector<unknown> is not assignable to Vector<any>)
function makeListVector(lists) {
    if (lists.length === 0 || lists[0].length === 0) {
        throw Error("Cannot infer list vector from empty array or empty list");
    }
    const sampleList = lists[0];
    // biome-ignore lint/suspicious/noExplicitAny: skip
    let inferredType;
    try {
        const sampleVector = makeVector(sampleList);
        inferredType = sampleVector.type;
    }
    catch (error) {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw Error(`Cannot infer list vector.  Cannot infer inner type: ${error}`);
    }
    const listBuilder = (0, apache_arrow_1.makeBuilder)({
        type: new apache_arrow_1.List(new apache_arrow_1.Field("item", inferredType, true)),
    });
    for (const list of lists) {
        listBuilder.append(list);
    }
    return listBuilder.finish().toVector();
}
/** Helper function to convert an Array of JS values to an Arrow Vector */
function makeVector(values, type, stringAsDictionary, nullable) {
    if (type !== undefined) {
        // Convert undefined values to null for nullable fields
        if (nullable) {
            values = values.map((v) => (v === undefined ? null : v));
        }
        // workaround for: https://github.com/apache/arrow-js/issues/68
        if (apache_arrow_1.DataType.isBool(type)) {
            const hasNonNullValue = values.some((v) => v !== null && v !== undefined);
            if (!hasNonNullValue) {
                const nullBitmap = new Uint8Array(Math.ceil(values.length / 8));
                const data = (0, apache_arrow_1.makeData)({
                    type: type,
                    length: values.length,
                    nullCount: values.length,
                    nullBitmap,
                });
                return (0, apache_arrow_1.makeVector)(data);
            }
        }
        // No need for inference, let Arrow create it
        if (type instanceof apache_arrow_1.Int) {
            if (apache_arrow_1.DataType.isInt(type) && type.bitWidth === 64) {
                // wrap in BigInt to avoid bug: https://github.com/apache/arrow/issues/40051
                values = values.map((v) => {
                    if (v === null) {
                        return v;
                    }
                    else if (typeof v === "bigint") {
                        return v;
                    }
                    else if (typeof v === "number") {
                        return BigInt(v);
                    }
                    else {
                        return v;
                    }
                });
            }
            else {
                // Similarly, bigint isn't supported for 16 or 32-bit ints.
                values = values.map((v) => {
                    if (typeof v == "bigint") {
                        return Number(v);
                    }
                    else {
                        return v;
                    }
                });
            }
        }
        return vectorFromArray(values, type);
    }
    if (values.length === 0) {
        throw Error("makeVector requires at least one value or the type must be specfied");
    }
    const sampleValue = values.find((val) => val !== null && val !== undefined);
    if (sampleValue === undefined) {
        throw Error("makeVector cannot infer the type if all values are null or undefined");
    }
    if (Array.isArray(sampleValue)) {
        // Default Arrow inference doesn't handle list types
        return makeListVector(values);
    }
    else if (Buffer.isBuffer(sampleValue)) {
        // Default Arrow inference doesn't handle Buffer
        return vectorFromArray(values, new apache_arrow_1.Binary());
    }
    else if (!(stringAsDictionary ?? false) &&
        (typeof sampleValue === "string" || sampleValue instanceof String)) {
        // If the type is string then don't use Arrow's default inference unless dictionaries are requested
        // because it will always use dictionary encoding for strings
        return vectorFromArray(values, new apache_arrow_1.Utf8());
    }
    else {
        // Convert a JS array of values to an arrow vector
        return vectorFromArray(values);
    }
}
/** Helper function to apply embeddings from metadata to an input table */
async function applyEmbeddingsFromMetadata(table, schema) {
    const registry = (0, registry_1.getRegistry)();
    const functions = await registry.parseFunctions(schema.metadata);
    const columns = Object.fromEntries(table.schema.fields.map((field) => [
        field.name,
        table.getChild(field.name),
    ]));
    for (const functionEntry of functions.values()) {
        const sourceColumn = columns[functionEntry.sourceColumn];
        const destColumn = functionEntry.vectorColumn ?? "vector";
        if (sourceColumn === undefined) {
            throw new Error(`Cannot apply embedding function because the source column '${functionEntry.sourceColumn}' was not present in the data`);
        }
        // Check if destination column exists and handle accordingly
        if (columns[destColumn] !== undefined) {
            const existingColumn = columns[destColumn];
            // If the column exists but is all null, we can fill it with embeddings
            if (existingColumn.nullCount !== existingColumn.length) {
                // Column has non-null values, skip embedding application
                continue;
            }
        }
        if (table.batches.length > 1) {
            throw new Error("Internal error: `makeArrowTable` unexpectedly created a table with more than one batch");
        }
        const values = sourceColumn.toArray();
        const vectors = await functionEntry.function.computeSourceEmbeddings(values);
        if (vectors.length !== values.length) {
            throw new Error("Embedding function did not return an embedding for each input element");
        }
        let destType;
        const dtype = schema.fields.find((f) => f.name === destColumn).type;
        if (isFixedSizeList(dtype)) {
            destType = (0, sanitize_1.sanitizeType)(dtype);
        }
        else {
            throw new Error("Expected FixedSizeList as datatype for vector field, instead got: " +
                dtype);
        }
        const vector = makeVector(vectors, destType);
        columns[destColumn] = vector;
    }
    // Add any missing columns from the schema as null vectors
    for (const field of schema.fields) {
        if (!(field.name in columns)) {
            const nullValues = new Array(table.numRows).fill(null);
            columns[field.name] = makeVector(nullValues, field.type, undefined, field.nullable);
        }
    }
    const newTable = new apache_arrow_1.Table(columns);
    return alignTable(newTable, schema);
}
/** Helper function to apply embeddings to an input table */
async function applyEmbeddings(table, embeddings, schema) {
    if (schema !== undefined && schema !== null) {
        schema = (0, sanitize_1.sanitizeSchema)(schema);
    }
    if (schema?.metadata.has("embedding_functions")) {
        return applyEmbeddingsFromMetadata(table, schema);
    }
    else if (embeddings == null || embeddings === undefined) {
        return table;
    }
    let schemaMetadata = schema?.metadata || new Map();
    if (!(embeddings == null || embeddings === undefined)) {
        const registry = (0, registry_1.getRegistry)();
        const embeddingMetadata = registry.getTableMetadata([embeddings]);
        schemaMetadata = new Map([...schemaMetadata, ...embeddingMetadata]);
    }
    // Convert from ArrowTable to Record<String, Vector>
    const colEntries = [...Array(table.numCols).keys()].map((_, idx) => {
        const name = table.schema.fields[idx].name;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const vec = table.getChildAt(idx);
        return [name, vec];
    });
    const newColumns = Object.fromEntries(colEntries);
    const sourceColumn = newColumns[embeddings.sourceColumn];
    const destColumn = embeddings.vectorColumn ?? "vector";
    const innerDestType = embeddings.function.embeddingDataType() ?? new apache_arrow_1.Float32();
    if (sourceColumn === undefined) {
        throw new Error(`Cannot apply embedding function because the source column '${embeddings.sourceColumn}' was not present in the data`);
    }
    if (table.numRows === 0) {
        if (Object.prototype.hasOwnProperty.call(newColumns, destColumn)) {
            // We have an empty table and it already has the embedding column so no work needs to be done
            // Note: we don't return an error like we did below because this is a common occurrence.  For example,
            // if we call convertToTable with 0 records and a schema that includes the embedding
            return table;
        }
        const dimensions = embeddings.function.ndims();
        if (dimensions !== undefined) {
            const destType = newVectorType(dimensions, innerDestType);
            newColumns[destColumn] = makeVector([], destType);
        }
        else if (schema != null) {
            const destField = schema.fields.find((f) => f.name === destColumn);
            if (destField != null) {
                newColumns[destColumn] = makeVector([], destField.type, undefined, destField.nullable);
            }
            else {
                throw new Error(`Attempt to apply embeddings to an empty table failed because schema was missing embedding column '${destColumn}'`);
            }
        }
        else {
            throw new Error("Attempt to apply embeddings to an empty table when the embeddings function does not specify `embeddingDimension`");
        }
    }
    else {
        // Check if destination column exists and handle accordingly
        if (Object.prototype.hasOwnProperty.call(newColumns, destColumn)) {
            const existingColumn = newColumns[destColumn];
            // If the column exists but is all null, we can fill it with embeddings
            if (existingColumn.nullCount !== existingColumn.length) {
                // Column has non-null values, skip embedding application and return table as-is
                let newTable = new apache_arrow_1.Table(newColumns);
                if (schema != null) {
                    newTable = alignTable(newTable, schema);
                }
                return new apache_arrow_1.Table(new apache_arrow_1.Schema(newTable.schema.fields, schemaMetadata), newTable.batches);
            }
        }
        if (table.batches.length > 1) {
            throw new Error("Internal error: `makeArrowTable` unexpectedly created a table with more than one batch");
        }
        const values = sourceColumn.toArray();
        const vectors = await embeddings.function.computeSourceEmbeddings(values);
        if (vectors.length !== values.length) {
            throw new Error("Embedding function did not return an embedding for each input element");
        }
        const destType = newVectorType(vectors[0].length, innerDestType);
        newColumns[destColumn] = makeVector(vectors, destType);
    }
    let newTable = new apache_arrow_1.Table(newColumns);
    if (schema != null) {
        if (schema.fields.find((f) => f.name === destColumn) === undefined) {
            throw new Error(`When using embedding functions and specifying a schema the schema should include the embedding column but the column ${destColumn} was missing`);
        }
        newTable = alignTable(newTable, schema);
    }
    newTable = new apache_arrow_1.Table(new apache_arrow_1.Schema(newTable.schema.fields, schemaMetadata), newTable.batches);
    return newTable;
}
/**
 * Convert an Array of records into an Arrow Table, optionally applying an
 * embeddings function to it.
 *
 * This function calls `makeArrowTable` first to create the Arrow Table.
 * Any provided `makeTableOptions` (e.g. a schema) will be passed on to
 * that call.
 *
 * The embedding function will be passed a column of values (based on the
 * `sourceColumn` of the embedding function) and expects to receive back
 * number[][] which will be converted into a fixed size list column.  By
 * default this will be a fixed size list of Float32 but that can be
 * customized by the `embeddingDataType` property of the embedding function.
 *
 * If a schema is provided in `makeTableOptions` then it should include the
 * embedding columns.  If no schema is provded then embedding columns will
 * be placed at the end of the table, after all of the input columns.
 */
async function convertToTable(data, embeddings, makeTableOptions) {
    let processedData = data;
    // If we have a schema with embedding metadata, we need to preprocess the data
    // to ensure all nested fields are present
    if (makeTableOptions?.schema &&
        makeTableOptions.schema.metadata?.has("embedding_functions")) {
        processedData = ensureNestedFieldsExist(data, makeTableOptions.schema);
    }
    const table = makeArrowTable(processedData, makeTableOptions);
    return await applyEmbeddings(table, embeddings, makeTableOptions?.schema);
}
/** Creates the Arrow Type for a Vector column with dimension `dim` */
function newVectorType(dim, innerType) {
    // in Lance we always default to have the elements nullable, so we need to set it to true
    // otherwise we often get schema mismatches because the stored data always has schema with nullable elements
    const children = new apache_arrow_1.Field("item", (0, sanitize_1.sanitizeType)(innerType), true);
    return new apache_arrow_1.FixedSizeList(dim, children);
}
/**
 * Serialize an Array of records into a buffer using the Arrow IPC File serialization
 *
 * This function will call `convertToTable` and pass on `embeddings` and `schema`
 *
 * `schema` is required if data is empty
 */
async function fromRecordsToBuffer(data, embeddings, schema) {
    if (schema !== undefined && schema !== null) {
        schema = (0, sanitize_1.sanitizeSchema)(schema);
    }
    const table = await convertToTable(data, embeddings, { schema });
    const writer = apache_arrow_1.RecordBatchFileWriter.writeAll(table);
    return Buffer.from(await writer.toUint8Array());
}
/**
 * Serialize an Array of records into a buffer using the Arrow IPC Stream serialization
 *
 * This function will call `convertToTable` and pass on `embeddings` and `schema`
 *
 * `schema` is required if data is empty
 */
async function fromRecordsToStreamBuffer(data, embeddings, schema) {
    if (schema !== undefined && schema !== null) {
        schema = (0, sanitize_1.sanitizeSchema)(schema);
    }
    const table = await convertToTable(data, embeddings, { schema });
    const writer = apache_arrow_1.RecordBatchStreamWriter.writeAll(table);
    return Buffer.from(await writer.toUint8Array());
}
/**
 * Serialize an Arrow Table into a buffer using the Arrow IPC File serialization
 *
 * This function will apply `embeddings` to the table in a manner similar to
 * `convertToTable`.
 *
 * `schema` is required if the table is empty
 */
async function fromTableToBuffer(table, embeddings, schema) {
    if (schema !== undefined && schema !== null) {
        schema = (0, sanitize_1.sanitizeSchema)(schema);
    }
    const tableWithEmbeddings = await applyEmbeddings(table, embeddings, schema);
    const writer = apache_arrow_1.RecordBatchFileWriter.writeAll(tableWithEmbeddings);
    return Buffer.from(await writer.toUint8Array());
}
/**
 * Serialize an Arrow Table into a buffer using the Arrow IPC File serialization
 *
 * This function will apply `embeddings` to the table in a manner similar to
 * `convertToTable`.
 *
 * `schema` is required if the table is empty
 */
async function fromDataToBuffer(data, embeddings, schema) {
    if (schema !== undefined && schema !== null) {
        schema = (0, sanitize_1.sanitizeSchema)(schema);
    }
    if (isArrowTable(data)) {
        const table = (0, sanitize_1.sanitizeTable)(data);
        // If we have a schema with embedding functions, we need to ensure all columns exist
        // before applying embeddings, since applyEmbeddingsFromMetadata expects all columns
        // to be present in the table
        if (schema && schema.metadata?.has("embedding_functions")) {
            const alignedTable = alignTableToSchema(table, schema);
            return fromTableToBuffer(alignedTable, embeddings, schema);
        }
        else {
            return fromTableToBuffer(table, embeddings, schema);
        }
    }
    else {
        const table = await convertToTable(data, embeddings, { schema });
        return fromTableToBuffer(table);
    }
}
/**
 * Read a single record batch from a buffer.
 *
 * Returns null if the buffer does not contain a record batch
 */
async function fromBufferToRecordBatch(data) {
    const iter = await apache_arrow_1.RecordBatchFileReader.readAll(Buffer.from(data)).next()
        .value;
    const recordBatch = iter?.next().value;
    return recordBatch || null;
}
/**
 * Create a buffer containing a single record batch
 */
async function fromRecordBatchToBuffer(batch) {
    const writer = new apache_arrow_1.RecordBatchFileWriter().writeAll([batch]);
    return Buffer.from(await writer.toUint8Array());
}
/**
 * Serialize an Arrow Table into a buffer using the Arrow IPC Stream serialization
 *
 * This function will apply `embeddings` to the table in a manner similar to
 * `convertToTable`.
 *
 * `schema` is required if the table is empty
 */
async function fromTableToStreamBuffer(table, embeddings, schema) {
    const tableWithEmbeddings = await applyEmbeddings(table, embeddings, schema);
    const writer = apache_arrow_1.RecordBatchStreamWriter.writeAll(tableWithEmbeddings);
    return Buffer.from(await writer.toUint8Array());
}
/**
 * Reorder the columns in `batch` so that they agree with the field order in `schema`
 */
function alignBatch(batch, schema) {
    const alignedChildren = [];
    for (const field of schema.fields) {
        const indexInBatch = batch.schema.fields?.findIndex((f) => f.name === field.name);
        if (indexInBatch < 0) {
            throw new Error(`The column ${field.name} was not found in the Arrow Table`);
        }
        alignedChildren.push(batch.data.children[indexInBatch]);
    }
    const newData = (0, apache_arrow_1.makeData)({
        type: new apache_arrow_1.Struct(schema.fields),
        length: batch.numRows,
        nullCount: batch.nullCount,
        children: alignedChildren,
    });
    return new apache_arrow_1.RecordBatch(schema, newData);
}
/**
 * Reorder the columns in `table` so that they agree with the field order in `schema`
 */
function alignTable(table, schema) {
    const alignedBatches = table.batches.map((batch) => alignBatch(batch, schema));
    return new apache_arrow_1.Table(schema, alignedBatches);
}
/**
 * Create an empty table with the given schema
 */
function createEmptyTable(schema) {
    return new apache_arrow_1.Table((0, sanitize_1.sanitizeSchema)(schema));
}
function validateSchemaEmbeddings(schema, data, embeddings) {
    const fields = [];
    const missingEmbeddingFields = [];
    // First we check if the field is a `FixedSizeList`
    // Then we check if the data contains the field
    // if it does not, we add it to the list of missing embedding fields
    // Finally, we check if those missing embedding fields are `this._embeddings`
    // if they are not, we throw an error
    for (let field of schema.fields) {
        if (isFixedSizeList(field.type)) {
            field = (0, sanitize_1.sanitizeField)(field);
            if (data.length !== 0 && data?.[0]?.[field.name] === undefined) {
                // Check if there's an embedding function registered for this field
                let hasEmbeddingFunction = false;
                // Check schema metadata for embedding functions
                if (schema.metadata.has("embedding_functions")) {
                    const embeddings = JSON.parse(schema.metadata.get("embedding_functions"));
                    // biome-ignore lint/suspicious/noExplicitAny: we don't know the type of `f`
                    if (embeddings.find((f) => f["vectorColumn"] === field.name)) {
                        hasEmbeddingFunction = true;
                    }
                }
                // Check passed embedding function parameter
                if (embeddings && embeddings.vectorColumn === field.name) {
                    hasEmbeddingFunction = true;
                }
                // If the field is nullable AND there's no embedding function, allow undefined/omitted values
                if (field.nullable && !hasEmbeddingFunction) {
                    fields.push(field);
                }
                else {
                    // Either not nullable OR has embedding function - require explicit values
                    if (hasEmbeddingFunction) {
                        // Don't add to missingEmbeddingFields since this is expected to be filled by embedding function
                        fields.push(field);
                    }
                    else {
                        missingEmbeddingFields.push(field);
                    }
                }
            }
            else {
                fields.push(field);
            }
        }
        else {
            fields.push(field);
        }
    }
    if (missingEmbeddingFields.length > 0 && embeddings === undefined) {
        throw new Error(`Table has embeddings: "${missingEmbeddingFields
            .map((f) => f.name)
            .join(",")}", but no embedding function was provided`);
    }
    return new apache_arrow_1.Schema(fields, schema.metadata);
}
/**
 * Ensures that all nested fields defined in the schema exist in the data,
 * filling missing fields with null values.
 */
function ensureNestedFieldsExist(data, schema) {
    return data.map((row) => {
        const completeRow = {};
        for (const field of schema.fields) {
            if (field.name in row) {
                if (field.type.constructor.name === "Struct" &&
                    row[field.name] !== null &&
                    row[field.name] !== undefined) {
                    // Handle nested struct
                    const nestedValue = row[field.name];
                    completeRow[field.name] = ensureStructFieldsExist(nestedValue, field.type);
                }
                else {
                    // Non-struct field or null struct value
                    completeRow[field.name] = row[field.name];
                }
            }
            else {
                // Field is missing from the data - set to null
                completeRow[field.name] = null;
            }
        }
        return completeRow;
    });
}
/**
 * Recursively ensures that all fields in a struct type exist in the data,
 * filling missing fields with null values.
 */
function ensureStructFieldsExist(data, structType) {
    const completeStruct = {};
    for (const childField of structType.children) {
        if (childField.name in data) {
            if (childField.type.constructor.name === "Struct" &&
                data[childField.name] !== null &&
                data[childField.name] !== undefined) {
                // Recursively handle nested struct
                completeStruct[childField.name] = ensureStructFieldsExist(data[childField.name], childField.type);
            }
            else {
                // Non-struct field or null struct value
                completeStruct[childField.name] = data[childField.name];
            }
        }
        else {
            // Field is missing - set to null
            completeStruct[childField.name] = null;
        }
    }
    return completeStruct;
}
// Matches format of https://github.com/lancedb/lance/blob/main/rust/lance/src/arrow/json.rs
function dataTypeToJson(dataType) {
    switch (dataType.typeId) {
        // For primitives, matches https://github.com/lancedb/lance/blob/e12bb9eff2a52f753668d4b62c52e4d72b10d294/rust/lance-core/src/datatypes.rs#L185
        case apache_arrow_1.Type.Null:
            return { type: "null" };
        case apache_arrow_1.Type.Bool:
            return { type: "bool" };
        case apache_arrow_1.Type.Int8:
            return { type: "int8" };
        case apache_arrow_1.Type.Int16:
            return { type: "int16" };
        case apache_arrow_1.Type.Int32:
            return { type: "int32" };
        case apache_arrow_1.Type.Int64:
            return { type: "int64" };
        case apache_arrow_1.Type.Uint8:
            return { type: "uint8" };
        case apache_arrow_1.Type.Uint16:
            return { type: "uint16" };
        case apache_arrow_1.Type.Uint32:
            return { type: "uint32" };
        case apache_arrow_1.Type.Uint64:
            return { type: "uint64" };
        case apache_arrow_1.Type.Int: {
            const bitWidth = dataType.bitWidth;
            const signed = dataType.isSigned;
            const prefix = signed ? "" : "u";
            return { type: `${prefix}int${bitWidth}` };
        }
        case apache_arrow_1.Type.Float: {
            switch (dataType.precision) {
                case apache_arrow_1.Precision.HALF:
                    return { type: "halffloat" };
                case apache_arrow_1.Precision.SINGLE:
                    return { type: "float" };
                case apache_arrow_1.Precision.DOUBLE:
                    return { type: "double" };
            }
            throw Error("Unsupported float precision");
        }
        case apache_arrow_1.Type.Float16:
            return { type: "halffloat" };
        case apache_arrow_1.Type.Float32:
            return { type: "float" };
        case apache_arrow_1.Type.Float64:
            return { type: "double" };
        case apache_arrow_1.Type.Utf8:
            return { type: "string" };
        case apache_arrow_1.Type.Binary:
            return { type: "binary" };
        case apache_arrow_1.Type.LargeUtf8:
            return { type: "large_string" };
        case apache_arrow_1.Type.LargeBinary:
            return { type: "large_binary" };
        case apache_arrow_1.Type.List:
            return {
                type: "list",
                fields: [fieldToJson(dataType.children[0])],
            };
        case apache_arrow_1.Type.FixedSizeList: {
            const fixedSizeList = dataType;
            return {
                type: "fixed_size_list",
                fields: [fieldToJson(fixedSizeList.children[0])],
                length: fixedSizeList.listSize,
            };
        }
        case apache_arrow_1.Type.Struct:
            return {
                type: "struct",
                fields: dataType.children.map(fieldToJson),
            };
        case apache_arrow_1.Type.Date: {
            const unit = dataType.unit;
            return {
                type: unit === apache_arrow_1.DateUnit.DAY ? "date32:day" : "date64:ms",
            };
        }
        case apache_arrow_1.Type.Timestamp: {
            const timestamp = dataType;
            const timezone = timestamp.timezone || "-";
            return {
                type: `timestamp:${timestamp.unit}:${timezone}`,
            };
        }
        case apache_arrow_1.Type.Decimal: {
            const decimal = dataType;
            return {
                type: `decimal:${decimal.bitWidth}:${decimal.precision}:${decimal.scale}`,
            };
        }
        case apache_arrow_1.Type.Duration: {
            const duration = dataType;
            return { type: `duration:${duration.unit}` };
        }
        case apache_arrow_1.Type.FixedSizeBinary: {
            const byteWidth = dataType.byteWidth;
            return { type: `fixed_size_binary:${byteWidth}` };
        }
        case apache_arrow_1.Type.Dictionary: {
            const dict = dataType;
            const indexType = dataTypeToJson(dict.indices);
            const valueType = dataTypeToJson(dict.valueType);
            return {
                type: `dict:${valueType.type}:${indexType.type}:false`,
            };
        }
    }
    throw new Error("Unsupported data type");
}
function fieldToJson(field) {
    return {
        name: field.name,
        type: dataTypeToJson(field.type),
        nullable: field.nullable,
        metadata: field.metadata,
    };
}
function alignTableToSchema(table, targetSchema) {
    const existingColumns = new Map();
    // Map existing columns
    for (const field of table.schema.fields) {
        existingColumns.set(field.name, table.getChild(field.name));
    }
    // Create vectors for all fields in target schema
    const alignedColumns = {};
    for (const field of targetSchema.fields) {
        if (existingColumns.has(field.name)) {
            // Column exists, use it
            alignedColumns[field.name] = existingColumns.get(field.name);
        }
        else {
            // Column missing, create null vector
            alignedColumns[field.name] = createNullVector(field, table.numRows);
        }
    }
    // Create new table with aligned schema and columns
    return new apache_arrow_1.Table(targetSchema, alignedColumns);
}
function createNullVector(field, numRows) {
    if (field.type.constructor.name === "Struct") {
        // For struct types, create a struct with null fields
        const structType = field.type;
        const childVectors = structType.children.map((childField) => createNullVector(childField, numRows));
        // Create struct data
        const structData = (0, apache_arrow_1.makeData)({
            type: structType,
            length: numRows,
            nullCount: 0,
            children: childVectors.map((v) => v.data[0]),
        });
        return (0, apache_arrow_1.makeVector)(structData);
    }
    else {
        // For other types, create a vector of nulls
        const nullBitmap = new Uint8Array(Math.ceil(numRows / 8));
        // All bits are 0, meaning all values are null
        const data = (0, apache_arrow_1.makeData)({
            type: field.type,
            length: numRows,
            nullCount: numRows,
            nullBitmap,
        });
        return (0, apache_arrow_1.makeVector)(data);
    }
}
