import type { TKeys } from "apache-arrow/type";
import { DataType, Date_, Decimal, DenseUnion, Dictionary, Duration, Field, FixedSizeBinary, FixedSizeList, Float, Int, Interval, List, Map_, Schema, SchemaLike, SparseUnion, Struct, Table, TableLike, Time, Timestamp, TimestampMicrosecond, TimestampMillisecond, TimestampNanosecond, TimestampSecond, Type, Union } from "./arrow";
export declare function sanitizeMetadata(metadataLike?: unknown): Map<string, string> | undefined;
export declare function sanitizeInt(typeLike: object): Int<Type.Int | Type.Int8 | Type.Int16 | Type.Int32 | Type.Int64 | Type.Uint8 | Type.Uint16 | Type.Uint32 | Type.Uint64>;
export declare function sanitizeFloat(typeLike: object): Float<Type.Float | Type.Float16 | Type.Float32 | Type.Float64>;
export declare function sanitizeDecimal(typeLike: object): Decimal;
export declare function sanitizeDate(typeLike: object): Date_<import("apache-arrow/type").Dates>;
export declare function sanitizeTime(typeLike: object): Time<Type.Time | Type.TimeSecond | Type.TimeMillisecond | Type.TimeMicrosecond | Type.TimeNanosecond>;
export declare function sanitizeTimestamp(typeLike: object): Timestamp<Type.Timestamp | Type.TimestampSecond | Type.TimestampMillisecond | Type.TimestampMicrosecond | Type.TimestampNanosecond>;
export declare function sanitizeTypedTimestamp(typeLike: object, Datatype: typeof TimestampNanosecond | typeof TimestampMicrosecond | typeof TimestampMillisecond | typeof TimestampSecond): TimestampSecond | TimestampMillisecond | TimestampMicrosecond | TimestampNanosecond;
export declare function sanitizeInterval(typeLike: object): Interval<Type.Interval | Type.IntervalDayTime | Type.IntervalYearMonth>;
export declare function sanitizeList(typeLike: object): List<any>;
export declare function sanitizeStruct(typeLike: object): Struct<any>;
export declare function sanitizeUnion(typeLike: object): Union<Type.Union | Type.DenseUnion | Type.SparseUnion>;
export declare function sanitizeTypedUnion(typeLike: object, UnionType: typeof DenseUnion | typeof SparseUnion): SparseUnion | DenseUnion;
export declare function sanitizeFixedSizeBinary(typeLike: object): FixedSizeBinary;
export declare function sanitizeFixedSizeList(typeLike: object): FixedSizeList<any>;
export declare function sanitizeMap(typeLike: object): Map_<any, any>;
export declare function sanitizeDuration(typeLike: object): Duration<Type.Duration | Type.DurationSecond | Type.DurationMillisecond | Type.DurationMicrosecond | Type.DurationNanosecond>;
export declare function sanitizeDictionary(typeLike: object): Dictionary<DataType<any, any>, TKeys>;
export declare function sanitizeType(typeLike: unknown): DataType<any>;
export declare function sanitizeField(fieldLike: unknown): Field;
/**
 * Convert something schemaLike into a Schema instance
 *
 * This method is often needed even when the caller is using a Schema
 * instance because they might be using a different instance of apache-arrow
 * than lancedb is using.
 */
export declare function sanitizeSchema(schemaLike: SchemaLike): Schema;
export declare function sanitizeTable(tableLike: TableLike): Table;
export declare function dataTypeFromName(typeName: string): DataType;
