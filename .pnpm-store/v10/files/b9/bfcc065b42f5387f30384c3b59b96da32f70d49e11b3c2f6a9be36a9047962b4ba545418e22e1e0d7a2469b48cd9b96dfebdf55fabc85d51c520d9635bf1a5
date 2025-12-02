import { Data } from '../data.js';
import { Vector } from '../vector.js';
import { Visitor } from '../visitor.js';
import { TypeToDataType } from '../interfaces.js';
import { Type } from '../enum.js';
import { DataType, Dictionary, Bool, Null, Utf8, LargeUtf8, Binary, LargeBinary, Decimal, FixedSizeBinary, List, FixedSizeList, Map_, Struct, Float, Float16, Float32, Float64, Int, Uint8, Uint16, Uint32, Uint64, Int8, Int16, Int32, Int64, Date_, DateDay, DateMillisecond, Interval, IntervalDayTime, IntervalYearMonth, Time, TimeSecond, TimeMillisecond, TimeMicrosecond, TimeNanosecond, Timestamp, TimestampSecond, TimestampMillisecond, TimestampMicrosecond, TimestampNanosecond, Duration, DurationSecond, DurationMillisecond, DurationMicrosecond, DurationNanosecond, Union, DenseUnion, SparseUnion } from '../type.js';
/** @ignore */
export interface GetVisitor extends Visitor {
    visit<T extends DataType>(node: Data<T>, index: number): T['TValue'] | null;
    visitMany<T extends DataType>(nodes: Data<T>[], indices: number[]): (T['TValue'] | null)[];
    getVisitFn<T extends DataType>(node: Vector<T> | Data<T> | T): (data: Data<T>, index: number) => T['TValue'] | null;
    getVisitFn<T extends Type>(node: T): (data: Data<TypeToDataType<T>>, index: number) => TypeToDataType<T>['TValue'];
    visitNull<T extends Null>(data: Data<T>, index: number): T['TValue'] | null;
    visitBool<T extends Bool>(data: Data<T>, index: number): T['TValue'] | null;
    visitInt<T extends Int>(data: Data<T>, index: number): T['TValue'] | null;
    visitInt8<T extends Int8>(data: Data<T>, index: number): T['TValue'] | null;
    visitInt16<T extends Int16>(data: Data<T>, index: number): T['TValue'] | null;
    visitInt32<T extends Int32>(data: Data<T>, index: number): T['TValue'] | null;
    visitInt64<T extends Int64>(data: Data<T>, index: number): T['TValue'] | null;
    visitUint8<T extends Uint8>(data: Data<T>, index: number): T['TValue'] | null;
    visitUint16<T extends Uint16>(data: Data<T>, index: number): T['TValue'] | null;
    visitUint32<T extends Uint32>(data: Data<T>, index: number): T['TValue'] | null;
    visitUint64<T extends Uint64>(data: Data<T>, index: number): T['TValue'] | null;
    visitFloat<T extends Float>(data: Data<T>, index: number): T['TValue'] | null;
    visitFloat16<T extends Float16>(data: Data<T>, index: number): T['TValue'] | null;
    visitFloat32<T extends Float32>(data: Data<T>, index: number): T['TValue'] | null;
    visitFloat64<T extends Float64>(data: Data<T>, index: number): T['TValue'] | null;
    visitUtf8<T extends Utf8>(data: Data<T>, index: number): T['TValue'] | null;
    visitLargeUtf8<T extends LargeUtf8>(data: Data<T>, index: number): T['TValue'] | null;
    visitBinary<T extends Binary>(data: Data<T>, index: number): T['TValue'] | null;
    visitLargeBinary<T extends LargeBinary>(data: Data<T>, index: number): T['TValue'] | null;
    visitFixedSizeBinary<T extends FixedSizeBinary>(data: Data<T>, index: number): T['TValue'] | null;
    visitDate<T extends Date_>(data: Data<T>, index: number): T['TValue'] | null;
    visitDateDay<T extends DateDay>(data: Data<T>, index: number): T['TValue'] | null;
    visitDateMillisecond<T extends DateMillisecond>(data: Data<T>, index: number): T['TValue'] | null;
    visitTimestamp<T extends Timestamp>(data: Data<T>, index: number): T['TValue'] | null;
    visitTimestampSecond<T extends TimestampSecond>(data: Data<T>, index: number): T['TValue'] | null;
    visitTimestampMillisecond<T extends TimestampMillisecond>(data: Data<T>, index: number): T['TValue'] | null;
    visitTimestampMicrosecond<T extends TimestampMicrosecond>(data: Data<T>, index: number): T['TValue'] | null;
    visitTimestampNanosecond<T extends TimestampNanosecond>(data: Data<T>, index: number): T['TValue'] | null;
    visitTime<T extends Time>(data: Data<T>, index: number): T['TValue'] | null;
    visitTimeSecond<T extends TimeSecond>(data: Data<T>, index: number): T['TValue'] | null;
    visitTimeMillisecond<T extends TimeMillisecond>(data: Data<T>, index: number): T['TValue'] | null;
    visitTimeMicrosecond<T extends TimeMicrosecond>(data: Data<T>, index: number): T['TValue'] | null;
    visitTimeNanosecond<T extends TimeNanosecond>(data: Data<T>, index: number): T['TValue'] | null;
    visitDecimal<T extends Decimal>(data: Data<T>, index: number): T['TValue'] | null;
    visitList<T extends List>(data: Data<T>, index: number): T['TValue'] | null;
    visitStruct<T extends Struct>(data: Data<T>, index: number): T['TValue'] | null;
    visitUnion<T extends Union>(data: Data<T>, index: number): T['TValue'] | null;
    visitDenseUnion<T extends DenseUnion>(data: Data<T>, index: number): T['TValue'] | null;
    visitSparseUnion<T extends SparseUnion>(data: Data<T>, index: number): T['TValue'] | null;
    visitDictionary<T extends Dictionary>(data: Data<T>, index: number): T['TValue'] | null;
    visitInterval<T extends Interval>(data: Data<T>, index: number): T['TValue'] | null;
    visitIntervalDayTime<T extends IntervalDayTime>(data: Data<T>, index: number): T['TValue'] | null;
    visitIntervalYearMonth<T extends IntervalYearMonth>(data: Data<T>, index: number): T['TValue'] | null;
    visitDuration<T extends Duration>(data: Data<T>, index: number): T['TValue'] | null;
    visitDurationSecond<T extends DurationSecond>(data: Data<T>, index: number): T['TValue'] | null;
    visitDurationMillisecond<T extends DurationMillisecond>(data: Data<T>, index: number): T['TValue'] | null;
    visitDurationMicrosecond<T extends DurationMicrosecond>(data: Data<T>, index: number): T['TValue'] | null;
    visitDurationNanosecond<T extends DurationNanosecond>(data: Data<T>, index: number): T['TValue'] | null;
    visitFixedSizeList<T extends FixedSizeList>(data: Data<T>, index: number): T['TValue'] | null;
    visitMap<T extends Map_>(data: Data<T>, index: number): T['TValue'] | null;
}
/** @ignore */
export declare class GetVisitor extends Visitor {
}
/** @ignore */
export declare const instance: GetVisitor;
