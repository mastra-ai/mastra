import { Vector } from './vector.js';
import { BufferType } from './enum.js';
import { DataType } from './type.js';
/** @ignore */ export type kUnknownNullCount = -1;
/** @ignore */ export declare const kUnknownNullCount = -1;
/** @ignore */ export type NullBuffer = Uint8Array | null | undefined;
/** @ignore */ export type TypeIdsBuffer = Int8Array | ArrayLike<number> | Iterable<number> | undefined;
/** @ignore */ export type ValueOffsetsBuffer = Int32Array | ArrayLike<number> | Iterable<number> | undefined;
/** @ignore */ export type LargeValueOffsetsBuffer = BigInt64Array | ArrayLike<bigint> | Iterable<bigint> | undefined;
/** @ignore */ export type DataBuffer<T extends DataType> = T['TArray'] | ArrayLike<number> | Iterable<number> | undefined;
/** @ignore */
export interface Buffers<T extends DataType> {
    [BufferType.OFFSET]: T['TOffsetArray'];
    [BufferType.DATA]: T['TArray'];
    [BufferType.VALIDITY]: Uint8Array;
    [BufferType.TYPE]: T['TArray'];
}
/** @ignore */
export interface Data<T extends DataType = DataType> {
    readonly TType: T['TType'];
    readonly TArray: T['TArray'];
    readonly TValue: T['TValue'];
}
/**
 * Data structure underlying {@link Vector}s. Use the convenience method {@link makeData}.
 */
export declare class Data<T extends DataType = DataType> {
    readonly type: T;
    readonly length: number;
    readonly offset: number;
    readonly stride: number;
    readonly children: Data[];
    /**
     * The dictionary for this Vector, if any. Only used for Dictionary type.
     */
    dictionary?: Vector;
    readonly values: Buffers<T>[BufferType.DATA];
    readonly typeIds: Buffers<T>[BufferType.TYPE];
    readonly nullBitmap: Buffers<T>[BufferType.VALIDITY];
    readonly valueOffsets: Buffers<T>[BufferType.OFFSET];
    get typeId(): T['TType'];
    get ArrayType(): T['ArrayType'];
    get buffers(): Buffers<T>;
    get nullable(): boolean;
    get byteLength(): number;
    protected _nullCount: number | kUnknownNullCount;
    get nullCount(): number;
    constructor(type: T, offset: number, length: number, nullCount?: number, buffers?: Partial<Buffers<T>> | Data<T>, children?: Data[], dictionary?: Vector);
    getValid(index: number): boolean;
    setValid(index: number, value: boolean): boolean;
    clone<R extends DataType = T>(type?: R, offset?: number, length?: number, nullCount?: number, buffers?: Buffers<R>, children?: Data[]): Data<R>;
    slice(offset: number, length: number): Data<T>;
    _changeLengthAndBackfillNullBitmap(newLength: number): Data<T>;
    protected _sliceBuffers(offset: number, length: number, stride: number, typeId: T['TType']): Buffers<T>;
    protected _sliceChildren(children: Data[], offset: number, length: number): Data[];
}
import { Dictionary, Bool, Null, Utf8, LargeUtf8, Binary, LargeBinary, Decimal, FixedSizeBinary, List, FixedSizeList, Map_, Struct, Float, Int, Date_, Interval, Duration, Time, Timestamp, Union, DenseUnion, SparseUnion } from './type.js';
/** @ignore */
interface DataProps_<T extends DataType> {
    type: T;
    offset?: number;
    length?: number;
    nullCount?: number;
    nullBitmap?: NullBuffer;
}
interface NullDataProps<T extends Null> {
    type: T;
    offset?: number;
    length?: number;
}
interface IntDataProps<T extends Int> extends DataProps_<T> {
    data?: DataBuffer<T>;
}
interface DictionaryDataProps<T extends Dictionary> extends DataProps_<T> {
    data?: DataBuffer<T>;
    dictionary?: Vector<T['dictionary']>;
}
interface FloatDataProps<T extends Float> extends DataProps_<T> {
    data?: DataBuffer<T>;
}
interface BoolDataProps<T extends Bool> extends DataProps_<T> {
    data?: DataBuffer<T>;
}
interface DecimalDataProps<T extends Decimal> extends DataProps_<T> {
    data?: DataBuffer<T>;
}
interface Date_DataProps<T extends Date_> extends DataProps_<T> {
    data?: DataBuffer<T>;
}
interface TimeDataProps<T extends Time> extends DataProps_<T> {
    data?: DataBuffer<T>;
}
interface TimestampDataProps<T extends Timestamp> extends DataProps_<T> {
    data?: DataBuffer<T>;
}
interface IntervalDataProps<T extends Interval> extends DataProps_<T> {
    data?: DataBuffer<T>;
}
interface DurationDataProps<T extends Duration> extends DataProps_<T> {
    data?: DataBuffer<T>;
}
interface FixedSizeBinaryDataProps<T extends FixedSizeBinary> extends DataProps_<T> {
    data?: DataBuffer<T>;
}
interface BinaryDataProps<T extends Binary> extends DataProps_<T> {
    valueOffsets: ValueOffsetsBuffer;
    data?: DataBuffer<T>;
}
interface LargeBinaryDataProps<T extends LargeBinary> extends DataProps_<T> {
    valueOffsets: LargeValueOffsetsBuffer | ValueOffsetsBuffer;
    data?: DataBuffer<T>;
}
interface Utf8DataProps<T extends Utf8> extends DataProps_<T> {
    valueOffsets: ValueOffsetsBuffer;
    data?: DataBuffer<T>;
}
interface LargeUtf8DataProps<T extends LargeUtf8> extends DataProps_<T> {
    valueOffsets: LargeValueOffsetsBuffer | ValueOffsetsBuffer;
    data?: DataBuffer<T>;
}
interface ListDataProps<T extends List> extends DataProps_<T> {
    valueOffsets: ValueOffsetsBuffer;
    child: Data<T['valueType']>;
}
interface FixedSizeListDataProps<T extends FixedSizeList> extends DataProps_<T> {
    child: Data<T['valueType']>;
}
interface StructDataProps<T extends Struct> extends DataProps_<T> {
    children: Data[];
}
interface Map_DataProps<T extends Map_> extends DataProps_<T> {
    valueOffsets: ValueOffsetsBuffer;
    child: Data;
}
interface SparseUnionDataProps<T extends SparseUnion> extends DataProps_<T> {
    nullBitmap: never;
    typeIds: TypeIdsBuffer;
    children: Data[];
}
interface DenseUnionDataProps<T extends DenseUnion> extends DataProps_<T> {
    nullBitmap: never;
    typeIds: TypeIdsBuffer;
    children: Data[];
    valueOffsets: ValueOffsetsBuffer;
}
interface UnionDataProps<T extends Union> extends DataProps_<T> {
    typeIds: TypeIdsBuffer;
    children: Data[];
    valueOffsets?: ValueOffsetsBuffer;
}
export type DataProps<T extends DataType> = (T extends Null ? NullDataProps<T> : T extends Int ? IntDataProps<T> : T extends Dictionary ? DictionaryDataProps<T> : T extends Float ? FloatDataProps<T> : T extends Bool ? BoolDataProps<T> : T extends Decimal ? DecimalDataProps<T> : T extends Date_ ? Date_DataProps<T> : T extends Time ? TimeDataProps<T> : T extends Timestamp ? TimestampDataProps<T> : T extends Interval ? IntervalDataProps<T> : T extends Duration ? DurationDataProps<T> : T extends FixedSizeBinary ? FixedSizeBinaryDataProps<T> : T extends Binary ? BinaryDataProps<T> : T extends LargeBinary ? LargeBinaryDataProps<T> : T extends Utf8 ? Utf8DataProps<T> : T extends LargeUtf8 ? LargeUtf8DataProps<T> : T extends List ? ListDataProps<T> : T extends FixedSizeList ? FixedSizeListDataProps<T> : T extends Struct ? StructDataProps<T> : T extends Map_ ? Map_DataProps<T> : T extends SparseUnion ? SparseUnionDataProps<T> : T extends DenseUnion ? DenseUnionDataProps<T> : T extends Union ? UnionDataProps<T> : DataProps_<T>);
export declare function makeData<T extends Null>(props: NullDataProps<T>): Data<T>;
export declare function makeData<T extends Int>(props: IntDataProps<T>): Data<T>;
export declare function makeData<T extends Dictionary>(props: DictionaryDataProps<T>): Data<T>;
export declare function makeData<T extends Float>(props: FloatDataProps<T>): Data<T>;
export declare function makeData<T extends Bool>(props: BoolDataProps<T>): Data<T>;
export declare function makeData<T extends Decimal>(props: DecimalDataProps<T>): Data<T>;
export declare function makeData<T extends Date_>(props: Date_DataProps<T>): Data<T>;
export declare function makeData<T extends Time>(props: TimeDataProps<T>): Data<T>;
export declare function makeData<T extends Timestamp>(props: TimestampDataProps<T>): Data<T>;
export declare function makeData<T extends Interval>(props: IntervalDataProps<T>): Data<T>;
export declare function makeData<T extends Duration>(props: DurationDataProps<T>): Data<T>;
export declare function makeData<T extends FixedSizeBinary>(props: FixedSizeBinaryDataProps<T>): Data<T>;
export declare function makeData<T extends Binary>(props: BinaryDataProps<T>): Data<T>;
export declare function makeData<T extends LargeBinary>(props: LargeBinaryDataProps<T>): Data<T>;
export declare function makeData<T extends Utf8>(props: Utf8DataProps<T>): Data<T>;
export declare function makeData<T extends LargeUtf8>(props: LargeUtf8DataProps<T>): Data<T>;
export declare function makeData<T extends List>(props: ListDataProps<T>): Data<T>;
export declare function makeData<T extends FixedSizeList>(props: FixedSizeListDataProps<T>): Data<T>;
export declare function makeData<T extends Struct>(props: StructDataProps<T>): Data<T>;
export declare function makeData<T extends Map_>(props: Map_DataProps<T>): Data<T>;
export declare function makeData<T extends SparseUnion>(props: SparseUnionDataProps<T>): Data<T>;
export declare function makeData<T extends DenseUnion>(props: DenseUnionDataProps<T>): Data<T>;
export declare function makeData<T extends Union>(props: UnionDataProps<T>): Data<T>;
export declare function makeData<T extends DataType>(props: DataProps_<T>): Data<T>;
export {};
