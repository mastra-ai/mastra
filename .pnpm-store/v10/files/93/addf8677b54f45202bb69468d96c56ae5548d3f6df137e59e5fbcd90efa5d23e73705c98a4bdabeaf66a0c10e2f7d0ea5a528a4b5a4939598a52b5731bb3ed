export declare class ColumnTypeParseError extends Error {
    readonly args: Record<string, unknown>;
    constructor(message: string, args?: Record<string, unknown>);
}
export declare const SimpleColumnTypes: readonly ["Bool", "UInt8", "Int8", "UInt16", "Int16", "UInt32", "Int32", "UInt64", "Int64", "UInt128", "Int128", "UInt256", "Int256", "Float32", "Float64", "String", "UUID", "Date", "Date32", "IPv4", "IPv6"];
export type SimpleColumnType = (typeof SimpleColumnTypes)[number];
export interface ParsedColumnSimple {
    type: 'Simple';
    /** Without LowCardinality and Nullable. For example:
     *  * UInt8 -> UInt8
     *  * LowCardinality(Nullable(String)) -> String */
    columnType: SimpleColumnType;
    /** The original type before parsing. */
    sourceType: string;
}
export interface ParsedColumnFixedString {
    type: 'FixedString';
    sizeBytes: number;
    sourceType: string;
}
export interface ParsedColumnDateTime {
    type: 'DateTime';
    timezone: string | null;
    sourceType: string;
}
export interface ParsedColumnDateTime64 {
    type: 'DateTime64';
    timezone: string | null;
    /** Valid range: [0 : 9] */
    precision: number;
    sourceType: string;
}
export interface ParsedColumnEnum {
    type: 'Enum';
    /** Index to name */
    values: Record<number, string>;
    /** UInt8 or UInt16 */
    intSize: 8 | 16;
    sourceType: string;
}
/** Int size for Decimal depends on the Precision
 *  * 32 bits  for precision <  10
 *  * 64 bits  for precision <  19
 *  * 128 bits for precision <  39
 *  * 256 bits for precision >= 39
 */
export interface DecimalParams {
    precision: number;
    scale: number;
    intSize: 32 | 64 | 128 | 256;
}
export interface ParsedColumnDecimal {
    type: 'Decimal';
    params: DecimalParams;
    sourceType: string;
}
/** Tuple, Array or Map itself cannot be Nullable */
export interface ParsedColumnNullable {
    type: 'Nullable';
    value: ParsedColumnSimple | ParsedColumnEnum | ParsedColumnDecimal | ParsedColumnFixedString | ParsedColumnDateTime | ParsedColumnDateTime64;
    sourceType: string;
}
/** Array cannot be Nullable or LowCardinality, but its value type can be.
 *  Arrays can be multidimensional, e.g. Array(Array(Array(T))).
 *  Arrays are allowed to have a Map as the value type.
 */
export interface ParsedColumnArray {
    type: 'Array';
    value: ParsedColumnNullable | ParsedColumnSimple | ParsedColumnFixedString | ParsedColumnDecimal | ParsedColumnEnum | ParsedColumnMap | ParsedColumnDateTime | ParsedColumnDateTime64 | ParsedColumnTuple;
    /** Array(T) = 1 dimension, Array(Array(T)) = 2, etc. */
    dimensions: number;
    sourceType: string;
}
/** @see https://clickhouse.com/docs/en/sql-reference/data-types/map */
export interface ParsedColumnMap {
    type: 'Map';
    /** Possible key types:
     *  - String, Integer, UUID, Date, Date32, etc ({@link ParsedColumnSimple})
     *  - FixedString
     *  - DateTime
     *  - Enum
     */
    key: ParsedColumnSimple | ParsedColumnFixedString | ParsedColumnEnum | ParsedColumnDateTime;
    /** Value types are arbitrary, including Map, Array, and Tuple. */
    value: ParsedColumnType;
    sourceType: string;
}
export interface ParsedColumnTuple {
    type: 'Tuple';
    /** Element types are arbitrary, including Map, Array, and Tuple. */
    elements: ParsedColumnType[];
    sourceType: string;
}
export type ParsedColumnType = ParsedColumnSimple | ParsedColumnEnum | ParsedColumnFixedString | ParsedColumnNullable | ParsedColumnDecimal | ParsedColumnDateTime | ParsedColumnDateTime64 | ParsedColumnArray | ParsedColumnTuple | ParsedColumnMap;
/**
 * @experimental - incomplete, unstable API;
 * originally intended to be used for RowBinary/Native header parsing internally.
 * Currently unsupported source types:
 * * Geo
 * * (Simple)AggregateFunction
 * * Nested
 * * Old/new JSON
 * * Dynamic
 * * Variant
 */
export declare function parseColumnType(sourceType: string): ParsedColumnType;
export declare function parseDecimalType({ columnType, sourceType, }: ParseColumnTypeParams): ParsedColumnDecimal;
export declare function parseEnumType({ columnType, sourceType, }: ParseColumnTypeParams): ParsedColumnEnum;
export declare function parseMapType({ columnType, sourceType, }: ParseColumnTypeParams): ParsedColumnMap;
export declare function parseTupleType({ columnType, sourceType, }: ParseColumnTypeParams): ParsedColumnTuple;
export declare function parseArrayType({ columnType, sourceType, }: ParseColumnTypeParams): ParsedColumnArray;
export declare function parseDateTimeType({ columnType, sourceType, }: ParseColumnTypeParams): ParsedColumnDateTime;
export declare function parseDateTime64Type({ columnType, sourceType, }: ParseColumnTypeParams): ParsedColumnDateTime64;
export declare function parseFixedStringType({ columnType, sourceType, }: ParseColumnTypeParams): ParsedColumnFixedString;
export declare function asNullableType(value: ParsedColumnType, sourceType: string): ParsedColumnNullable;
/** Used for Map key/value types and Tuple elements.
 *  * `String, UInt8` results in [`String`, `UInt8`].
 *  * `String, UInt8, Array(String)` results in [`String`, `UInt8`, `Array(String)`].
 *  * Throws if parsed values are below the required minimum. */
export declare function getElementsTypes({ columnType, sourceType }: ParseColumnTypeParams, minElements: number): string[];
interface ParseColumnTypeParams {
    /** A particular type to parse, such as DateTime. */
    columnType: string;
    /** Full type definition, such as Map(String, DateTime). */
    sourceType: string;
}
export {};
