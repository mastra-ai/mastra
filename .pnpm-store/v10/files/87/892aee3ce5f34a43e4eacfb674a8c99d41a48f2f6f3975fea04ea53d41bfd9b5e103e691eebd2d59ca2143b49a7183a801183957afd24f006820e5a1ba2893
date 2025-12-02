import { Data } from '../data.js';
import { Visitor } from '../visitor.js';
import { TypeToDataType } from '../interfaces.js';
import { Type } from '../enum.js';
import { DataType, Dictionary, Bool, Null, Utf8, LargeUtf8, Binary, LargeBinary, Decimal, FixedSizeBinary, List, FixedSizeList, Map_, Struct, Float, Float16, Float32, Float64, Int, Uint8, Uint16, Uint32, Uint64, Int8, Int16, Int32, Int64, Date_, DateDay, DateMillisecond, Interval, IntervalDayTime, IntervalYearMonth, Time, TimeSecond, TimeMillisecond, TimeMicrosecond, TimeNanosecond, Timestamp, TimestampSecond, TimestampMillisecond, TimestampMicrosecond, TimestampNanosecond, Duration, DurationSecond, DurationMillisecond, DurationMicrosecond, DurationNanosecond, Union, DenseUnion, SparseUnion } from '../type.js';
/** @ignore */
export interface SetVisitor extends Visitor {
    visit<T extends DataType>(node: Data<T>, index: number, value: T['TValue']): void;
    visitMany<T extends DataType>(nodes: Data<T>[], indices: number[], values: T['TValue'][]): void[];
    getVisitFn<T extends DataType>(node: Data<T> | T): (data: Data<T>, index: number, value: Data<T>['TValue']) => void;
    getVisitFn<T extends Type>(node: T): (data: Data<TypeToDataType<T>>, index: number, value: TypeToDataType<T>['TValue']) => void;
    visitNull<T extends Null>(data: Data<T>, index: number, value: T['TValue']): void;
    visitBool<T extends Bool>(data: Data<T>, index: number, value: T['TValue']): void;
    visitInt<T extends Int>(data: Data<T>, index: number, value: T['TValue']): void;
    visitInt8<T extends Int8>(data: Data<T>, index: number, value: T['TValue']): void;
    visitInt16<T extends Int16>(data: Data<T>, index: number, value: T['TValue']): void;
    visitInt32<T extends Int32>(data: Data<T>, index: number, value: T['TValue']): void;
    visitInt64<T extends Int64>(data: Data<T>, index: number, value: T['TValue']): void;
    visitUint8<T extends Uint8>(data: Data<T>, index: number, value: T['TValue']): void;
    visitUint16<T extends Uint16>(data: Data<T>, index: number, value: T['TValue']): void;
    visitUint32<T extends Uint32>(data: Data<T>, index: number, value: T['TValue']): void;
    visitUint64<T extends Uint64>(data: Data<T>, index: number, value: T['TValue']): void;
    visitFloat<T extends Float>(data: Data<T>, index: number, value: T['TValue']): void;
    visitFloat16<T extends Float16>(data: Data<T>, index: number, value: T['TValue']): void;
    visitFloat32<T extends Float32>(data: Data<T>, index: number, value: T['TValue']): void;
    visitFloat64<T extends Float64>(data: Data<T>, index: number, value: T['TValue']): void;
    visitUtf8<T extends Utf8>(data: Data<T>, index: number, value: T['TValue']): void;
    visitLargeUtf8<T extends LargeUtf8>(data: Data<T>, index: number, value: T['TValue']): void;
    visitBinary<T extends Binary>(data: Data<T>, index: number, value: T['TValue']): void;
    visitLargeBinary<T extends LargeBinary>(data: Data<T>, index: number, value: T['TValue']): void;
    visitFixedSizeBinary<T extends FixedSizeBinary>(data: Data<T>, index: number, value: T['TValue']): void;
    visitDate<T extends Date_>(data: Data<T>, index: number, value: T['TValue']): void;
    visitDateDay<T extends DateDay>(data: Data<T>, index: number, value: T['TValue']): void;
    visitDateMillisecond<T extends DateMillisecond>(data: Data<T>, index: number, value: T['TValue']): void;
    visitTimestamp<T extends Timestamp>(data: Data<T>, index: number, value: T['TValue']): void;
    visitTimestampSecond<T extends TimestampSecond>(data: Data<T>, index: number, value: T['TValue']): void;
    visitTimestampMillisecond<T extends TimestampMillisecond>(data: Data<T>, index: number, value: T['TValue']): void;
    visitTimestampMicrosecond<T extends TimestampMicrosecond>(data: Data<T>, index: number, value: T['TValue']): void;
    visitTimestampNanosecond<T extends TimestampNanosecond>(data: Data<T>, index: number, value: T['TValue']): void;
    visitTime<T extends Time>(data: Data<T>, index: number, value: T['TValue']): void;
    visitTimeSecond<T extends TimeSecond>(data: Data<T>, index: number, value: T['TValue']): void;
    visitTimeMillisecond<T extends TimeMillisecond>(data: Data<T>, index: number, value: T['TValue']): void;
    visitTimeMicrosecond<T extends TimeMicrosecond>(data: Data<T>, index: number, value: T['TValue']): void;
    visitTimeNanosecond<T extends TimeNanosecond>(data: Data<T>, index: number, value: T['TValue']): void;
    visitDecimal<T extends Decimal>(data: Data<T>, index: number, value: T['TValue']): void;
    visitList<T extends List>(data: Data<T>, index: number, value: T['TValue']): void;
    visitStruct<T extends Struct>(data: Data<T>, index: number, value: T['TValue']): void;
    visitUnion<T extends Union>(data: Data<T>, index: number, value: T['TValue']): void;
    visitDenseUnion<T extends DenseUnion>(data: Data<T>, index: number, value: T['TValue']): void;
    visitSparseUnion<T extends SparseUnion>(data: Data<T>, index: number, value: T['TValue']): void;
    visitDictionary<T extends Dictionary>(data: Data<T>, index: number, value: T['TValue']): void;
    visitInterval<T extends Interval>(data: Data<T>, index: number, value: T['TValue']): void;
    visitIntervalDayTime<T extends IntervalDayTime>(data: Data<T>, index: number, value: T['TValue']): void;
    visitIntervalYearMonth<T extends IntervalYearMonth>(data: Data<T>, index: number, value: T['TValue']): void;
    visitDuration<T extends Duration>(data: Data<T>, index: number, value: T['TValue']): void;
    visitDurationSecond<T extends DurationSecond>(data: Data<T>, index: number, value: T['TValue']): void;
    visitDurationMillisecond<T extends DurationMillisecond>(data: Data<T>, index: number, value: T['TValue']): void;
    visitDurationMicrosecond<T extends DurationMicrosecond>(data: Data<T>, index: number, value: T['TValue']): void;
    visitDurationNanosecond<T extends DurationNanosecond>(data: Data<T>, index: number, value: T['TValue']): void;
    visitFixedSizeList<T extends FixedSizeList>(data: Data<T>, index: number, value: T['TValue']): void;
    visitMap<T extends Map_>(data: Data<T>, index: number, value: T['TValue']): void;
}
/** @ignore */
export declare class SetVisitor extends Visitor {
}
/** @ignore */
export declare const setEpochMsToDays: (data: Int32Array, index: number, epochMs: number) => void;
/** @ignore */
export declare const setVariableWidthBytes: <T extends Int32Array | BigInt64Array>(values: Uint8Array, valueOffsets: T, index: number, value: Uint8Array) => void;
/** @ignore */
export declare const setInt: <T extends Int<Type.Int | Type.Int8 | Type.Int16 | Type.Int32 | Type.Int64 | Type.Uint8 | Type.Uint16 | Type.Uint32 | Type.Uint64>>({ values }: Data<T>, index: number, value: T['TValue']) => void;
/** @ignore */
export declare const setFloat: <T extends Float32 | Float64>({ values }: Data<T>, index: number, value: T['TValue']) => void;
/** @ignore */
export declare const setFloat16: <T extends Float16>({ values }: Data<T>, index: number, value: T['TValue']) => void;
/** @ignore */
export declare const setAnyFloat: <T extends Float<Type.Float | Type.Float16 | Type.Float32 | Type.Float64>>(data: Data<T>, index: number, value: T['TValue']) => void;
/** @ignore */
export declare const setDateDay: <T extends DateDay>({ values }: Data<T>, index: number, value: T['TValue']) => void;
/** @ignore */
export declare const setDateMillisecond: <T extends DateMillisecond>({ values }: Data<T>, index: number, value: T['TValue']) => void;
/** @ignore */
export declare const setFixedSizeBinary: <T extends FixedSizeBinary>({ stride, values }: Data<T>, index: number, value: T['TValue']) => void;
export declare const setDate: <T extends Date_<import("../type.js").Dates>>(data: Data<T>, index: number, value: T['TValue']) => void;
/** @ignore */
export declare const setTimestampSecond: <T extends TimestampSecond>({ values }: Data<T>, index: number, value: T['TValue']) => void;
/** @ignore */
export declare const setTimestampMillisecond: <T extends TimestampMillisecond>({ values }: Data<T>, index: number, value: T['TValue']) => void;
/** @ignore */
export declare const setTimestampMicrosecond: <T extends TimestampMicrosecond>({ values }: Data<T>, index: number, value: T['TValue']) => void;
/** @ignore */
export declare const setTimestampNanosecond: <T extends TimestampNanosecond>({ values }: Data<T>, index: number, value: T['TValue']) => void;
/** @ignore */
export declare const setTimestamp: <T extends Timestamp<Type.Timestamp | Type.TimestampSecond | Type.TimestampMillisecond | Type.TimestampMicrosecond | Type.TimestampNanosecond>>(data: Data<T>, index: number, value: T['TValue']) => void;
/** @ignore */
export declare const setTimeSecond: <T extends TimeSecond>({ values }: Data<T>, index: number, value: T['TValue']) => void;
/** @ignore */
export declare const setTimeMillisecond: <T extends TimeMillisecond>({ values }: Data<T>, index: number, value: T['TValue']) => void;
/** @ignore */
export declare const setTimeMicrosecond: <T extends TimeMicrosecond>({ values }: Data<T>, index: number, value: T['TValue']) => void;
/** @ignore */
export declare const setTimeNanosecond: <T extends TimeNanosecond>({ values }: Data<T>, index: number, value: T['TValue']) => void;
/** @ignore */
export declare const setTime: <T extends Time<Type.Time | Type.TimeSecond | Type.TimeMillisecond | Type.TimeMicrosecond | Type.TimeNanosecond>>(data: Data<T>, index: number, value: T['TValue']) => void;
/** @ignore */
export declare const setDecimal: <T extends Decimal>({ values, stride }: Data<T>, index: number, value: T['TValue']) => void;
/** @ignore */
export declare const setIntervalValue: <T extends Interval<Type.Interval | Type.IntervalDayTime | Type.IntervalYearMonth>>(data: Data<T>, index: number, value: T['TValue']) => void;
/** @ignore */
export declare const setIntervalDayTime: <T extends IntervalDayTime>({ values }: Data<T>, index: number, value: T['TValue']) => void;
/** @ignore */
export declare const setIntervalYearMonth: <T extends IntervalYearMonth>({ values }: Data<T>, index: number, value: T['TValue']) => void;
/** @ignore */
export declare const setDurationSecond: <T extends DurationSecond>({ values }: Data<T>, index: number, value: T['TValue']) => void;
/** @ignore */
export declare const setDurationMillisecond: <T extends DurationMillisecond>({ values }: Data<T>, index: number, value: T['TValue']) => void;
/** @ignore */
export declare const setDurationMicrosecond: <T extends DurationMicrosecond>({ values }: Data<T>, index: number, value: T['TValue']) => void;
/** @ignore */
export declare const setDurationNanosecond: <T extends DurationNanosecond>({ values }: Data<T>, index: number, value: T['TValue']) => void;
/** @ignore */
export declare const setDuration: <T extends Duration<Type.Duration | Type.DurationSecond | Type.DurationMillisecond | Type.DurationMicrosecond | Type.DurationNanosecond>>(data: Data<T>, index: number, value: T['TValue']) => void;
/** @ignore */
export declare const instance: SetVisitor;
