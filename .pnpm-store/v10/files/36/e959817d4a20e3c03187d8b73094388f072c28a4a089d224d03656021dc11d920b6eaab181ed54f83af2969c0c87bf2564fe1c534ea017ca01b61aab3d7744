import { Table as ArrowTable, Binary, BufferType, DataType, Field, FixedSizeBinary, FixedSizeList, Float, Int, LargeBinary, List, Null, RecordBatch, Schema, Struct, Utf8 } from "apache-arrow";
import { Buffers } from "apache-arrow/data";
import { type EmbeddingFunction } from "./embedding/embedding_function";
import { EmbeddingFunctionConfig } from "./embedding/registry";
export * from "apache-arrow";
export type SchemaLike = Schema | {
    fields: FieldLike[];
    metadata: Map<string, string>;
    get names(): unknown[];
};
export type FieldLike = Field | {
    type: string;
    name: string;
    nullable: boolean;
    metadata?: Map<string, string>;
};
export type DataLike = import("apache-arrow").Data<Struct<any>> | {
    type: any;
    length: number;
    offset: number;
    stride: number;
    nullable: boolean;
    children: DataLike[];
    get nullCount(): number;
    values: Buffers<any>[BufferType.DATA];
    typeIds: Buffers<any>[BufferType.TYPE];
    nullBitmap: Buffers<any>[BufferType.VALIDITY];
    valueOffsets: Buffers<any>[BufferType.OFFSET];
};
export type RecordBatchLike = RecordBatch | {
    schema: SchemaLike;
    data: DataLike;
};
export type TableLike = ArrowTable | {
    schema: SchemaLike;
    batches: RecordBatchLike[];
};
export type IntoVector = Float32Array | Float64Array | number[] | Promise<Float32Array | Float64Array | number[]>;
export type MultiVector = IntoVector[];
export declare function isMultiVector(value: unknown): value is MultiVector;
export declare function isIntoVector(value: unknown): value is IntoVector;
export declare function isArrowTable(value: object): value is TableLike;
export declare function isNull(value: unknown): value is Null;
export declare function isInt(value: unknown): value is Int;
export declare function isFloat(value: unknown): value is Float;
export declare function isBinary(value: unknown): value is Binary;
export declare function isLargeBinary(value: unknown): value is LargeBinary;
export declare function isUtf8(value: unknown): value is Utf8;
export declare function isLargeUtf8(value: unknown): value is Utf8;
export declare function isBool(value: unknown): value is Utf8;
export declare function isDecimal(value: unknown): value is Utf8;
export declare function isDate(value: unknown): value is Utf8;
export declare function isTime(value: unknown): value is Utf8;
export declare function isTimestamp(value: unknown): value is Utf8;
export declare function isInterval(value: unknown): value is Utf8;
export declare function isDuration(value: unknown): value is Utf8;
export declare function isList(value: unknown): value is List;
export declare function isStruct(value: unknown): value is Struct;
export declare function isUnion(value: unknown): value is Struct;
export declare function isFixedSizeBinary(value: unknown): value is FixedSizeBinary;
export declare function isFixedSizeList(value: unknown): value is FixedSizeList;
/** Data type accepted by NodeJS SDK */
export type Data = Record<string, unknown>[] | TableLike;
export declare class VectorColumnOptions {
    /** Vector column type. */
    type: Float;
    constructor(values?: Partial<VectorColumnOptions>);
}
/** Options to control the makeArrowTable call. */
export declare class MakeArrowTableOptions {
    schema?: SchemaLike;
    vectorColumns: Record<string, VectorColumnOptions>;
    embeddings?: EmbeddingFunction<unknown>;
    embeddingFunction?: EmbeddingFunctionConfig;
    /**
     * If true then string columns will be encoded with dictionary encoding
     *
     * Set this to true if your string columns tend to repeat the same values
     * often.  For more precise control use the `schema` property to specify the
     * data type for individual columns.
     *
     * If `schema` is provided then this property is ignored.
     */
    dictionaryEncodeStrings: boolean;
    constructor(values?: Partial<MakeArrowTableOptions>);
}
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
export declare function makeArrowTable(data: Array<Record<string, unknown>>, options?: Partial<MakeArrowTableOptions>, metadata?: Map<string, string>): ArrowTable;
/**
 * Create an empty Arrow table with the provided schema
 */
export declare function makeEmptyTable(schema: SchemaLike, metadata?: Map<string, string>): ArrowTable;
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
export declare function convertToTable(data: Array<Record<string, unknown>>, embeddings?: EmbeddingFunctionConfig, makeTableOptions?: Partial<MakeArrowTableOptions>): Promise<ArrowTable>;
/** Creates the Arrow Type for a Vector column with dimension `dim` */
export declare function newVectorType<T extends Float>(dim: number, innerType: unknown): FixedSizeList<T>;
/**
 * Serialize an Array of records into a buffer using the Arrow IPC File serialization
 *
 * This function will call `convertToTable` and pass on `embeddings` and `schema`
 *
 * `schema` is required if data is empty
 */
export declare function fromRecordsToBuffer(data: Array<Record<string, unknown>>, embeddings?: EmbeddingFunctionConfig, schema?: Schema): Promise<Buffer>;
/**
 * Serialize an Array of records into a buffer using the Arrow IPC Stream serialization
 *
 * This function will call `convertToTable` and pass on `embeddings` and `schema`
 *
 * `schema` is required if data is empty
 */
export declare function fromRecordsToStreamBuffer(data: Array<Record<string, unknown>>, embeddings?: EmbeddingFunctionConfig, schema?: Schema): Promise<Buffer>;
/**
 * Serialize an Arrow Table into a buffer using the Arrow IPC File serialization
 *
 * This function will apply `embeddings` to the table in a manner similar to
 * `convertToTable`.
 *
 * `schema` is required if the table is empty
 */
export declare function fromTableToBuffer(table: ArrowTable, embeddings?: EmbeddingFunctionConfig, schema?: SchemaLike): Promise<Buffer>;
/**
 * Serialize an Arrow Table into a buffer using the Arrow IPC File serialization
 *
 * This function will apply `embeddings` to the table in a manner similar to
 * `convertToTable`.
 *
 * `schema` is required if the table is empty
 */
export declare function fromDataToBuffer(data: Data, embeddings?: EmbeddingFunctionConfig, schema?: Schema): Promise<Buffer>;
/**
 * Read a single record batch from a buffer.
 *
 * Returns null if the buffer does not contain a record batch
 */
export declare function fromBufferToRecordBatch(data: Buffer): Promise<RecordBatch | null>;
/**
 * Create a buffer containing a single record batch
 */
export declare function fromRecordBatchToBuffer(batch: RecordBatch): Promise<Buffer>;
/**
 * Serialize an Arrow Table into a buffer using the Arrow IPC Stream serialization
 *
 * This function will apply `embeddings` to the table in a manner similar to
 * `convertToTable`.
 *
 * `schema` is required if the table is empty
 */
export declare function fromTableToStreamBuffer(table: ArrowTable, embeddings?: EmbeddingFunctionConfig, schema?: SchemaLike): Promise<Buffer>;
/**
 * Create an empty table with the given schema
 */
export declare function createEmptyTable(schema: Schema): ArrowTable;
/**
 * Ensures that all nested fields defined in the schema exist in the data,
 * filling missing fields with null values.
 */
export declare function ensureNestedFieldsExist(data: Array<Record<string, unknown>>, schema: Schema): Array<Record<string, unknown>>;
interface JsonDataType {
    type: string;
    fields?: JsonField[];
    length?: number;
}
interface JsonField {
    name: string;
    type: JsonDataType;
    nullable: boolean;
    metadata: Map<string, string>;
}
export declare function dataTypeToJson(dataType: DataType): JsonDataType;
