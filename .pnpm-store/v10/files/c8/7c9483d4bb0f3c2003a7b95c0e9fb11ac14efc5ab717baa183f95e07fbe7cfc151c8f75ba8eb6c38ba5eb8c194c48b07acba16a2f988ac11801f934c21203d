import { Data } from '../data.js';
import { Type } from '../enum.js';
import { Visitor } from '../visitor.js';
import { TypeToDataType } from '../interfaces.js';
import { DataType, Dictionary, Bool, Null, Utf8, LargeUtf8, Binary, LargeBinary, Decimal, FixedSizeBinary, List, FixedSizeList, Map_, Struct, Float, Float16, Float32, Float64, Int, Uint8, Uint16, Uint32, Uint64, Int8, Int16, Int32, Int64, Date_, DateDay, DateMillisecond, Interval, IntervalDayTime, IntervalYearMonth, Time, TimeSecond, TimeMillisecond, TimeMicrosecond, TimeNanosecond, Timestamp, TimestampSecond, TimestampMillisecond, TimestampMicrosecond, TimestampNanosecond, Duration, DurationSecond, DurationMillisecond, DurationMicrosecond, DurationNanosecond, Union, DenseUnion, SparseUnion } from '../type.js';
/** @ignore */
export interface IndexOfVisitor extends Visitor {
    visit<T extends Data>(node: T, value: T['TValue'] | null, index?: number): number;
    visitMany<T extends Data>(nodes: T[], values: (T['TValue'] | null)[], indices: (number | undefined)[]): number[];
    getVisitFn<T extends DataType>(node: Data<T> | T): (data: Data<T>, value: T['TValue'] | null, index?: number) => number;
    getVisitFn<T extends Type>(node: T): (data: Data<TypeToDataType<T>>, value: TypeToDataType<T>['TValue'] | null, index?: number) => number;
    visitNull<T extends Null>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitBool<T extends Bool>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitInt<T extends Int>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitInt8<T extends Int8>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitInt16<T extends Int16>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitInt32<T extends Int32>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitInt64<T extends Int64>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitUint8<T extends Uint8>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitUint16<T extends Uint16>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitUint32<T extends Uint32>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitUint64<T extends Uint64>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitFloat<T extends Float>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitFloat16<T extends Float16>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitFloat32<T extends Float32>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitFloat64<T extends Float64>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitUtf8<T extends Utf8>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitLargeUtf8<T extends LargeUtf8>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitBinary<T extends Binary>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitLargeBinary<T extends LargeBinary>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitFixedSizeBinary<T extends FixedSizeBinary>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitDate<T extends Date_>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitDateDay<T extends DateDay>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitDateMillisecond<T extends DateMillisecond>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitTimestamp<T extends Timestamp>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitTimestampSecond<T extends TimestampSecond>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitTimestampMillisecond<T extends TimestampMillisecond>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitTimestampMicrosecond<T extends TimestampMicrosecond>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitTimestampNanosecond<T extends TimestampNanosecond>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitTime<T extends Time>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitTimeSecond<T extends TimeSecond>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitTimeMillisecond<T extends TimeMillisecond>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitTimeMicrosecond<T extends TimeMicrosecond>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitTimeNanosecond<T extends TimeNanosecond>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitDecimal<T extends Decimal>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitList<T extends List>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitStruct<T extends Struct>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitUnion<T extends Union>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitDenseUnion<T extends DenseUnion>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitSparseUnion<T extends SparseUnion>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitDictionary<T extends Dictionary>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitInterval<T extends Interval>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitIntervalDayTime<T extends IntervalDayTime>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitIntervalYearMonth<T extends IntervalYearMonth>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitDuration<T extends Duration>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitDurationSecond<T extends DurationSecond>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitDurationMillisecond<T extends DurationMillisecond>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitDurationMicrosecond<T extends DurationMicrosecond>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitDurationNanosecond<T extends DurationNanosecond>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitFixedSizeList<T extends FixedSizeList>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
    visitMap<T extends Map_>(data: Data<T>, value: T['TValue'] | null, index?: number): number;
}
/** @ignore */
export declare class IndexOfVisitor extends Visitor {
}
/** @ignore */
export declare const instance: IndexOfVisitor;
