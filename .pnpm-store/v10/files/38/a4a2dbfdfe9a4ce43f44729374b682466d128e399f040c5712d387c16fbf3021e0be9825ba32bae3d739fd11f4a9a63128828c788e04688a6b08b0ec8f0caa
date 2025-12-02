import { Vector } from '../vector.js';
import { Visitor } from '../visitor.js';
import { Type } from '../enum.js';
import { TypeToDataType } from '../interfaces.js';
import { DataType, Dictionary, Bool, Null, Utf8, LargeUtf8, Binary, LargeBinary, Decimal, FixedSizeBinary, List, FixedSizeList, Map_, Struct, Float, Float16, Float32, Float64, Int, Uint8, Uint16, Uint32, Uint64, Int8, Int16, Int32, Int64, Date_, DateDay, DateMillisecond, Interval, IntervalDayTime, IntervalYearMonth, Time, TimeSecond, TimeMillisecond, TimeMicrosecond, TimeNanosecond, Timestamp, TimestampSecond, TimestampMillisecond, TimestampMicrosecond, TimestampNanosecond, Duration, DurationSecond, DurationMillisecond, DurationMicrosecond, DurationNanosecond, Union, DenseUnion, SparseUnion } from '../type.js';
/** @ignore */
export interface IteratorVisitor extends Visitor {
    visit<T extends Vector>(node: T): IterableIterator<T['TValue'] | null>;
    visitMany<T extends Vector>(nodes: T[]): IterableIterator<T['TValue'] | null>[];
    getVisitFn<T extends DataType>(node: Vector<T> | T): (vector: Vector<T>) => IterableIterator<T['TValue'] | null>;
    getVisitFn<T extends Type>(node: T): (vector: Vector<TypeToDataType<T>>) => IterableIterator<TypeToDataType<T>['TValue'] | null>;
    visitNull<T extends Null>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitBool<T extends Bool>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitInt<T extends Int>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitInt8<T extends Int8>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitInt16<T extends Int16>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitInt32<T extends Int32>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitInt64<T extends Int64>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitUint8<T extends Uint8>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitUint16<T extends Uint16>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitUint32<T extends Uint32>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitUint64<T extends Uint64>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitFloat<T extends Float>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitFloat16<T extends Float16>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitFloat32<T extends Float32>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitFloat64<T extends Float64>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitUtf8<T extends Utf8>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitLargeUtf8<T extends LargeUtf8>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitBinary<T extends Binary>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitLargeBinary<T extends LargeBinary>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitFixedSizeBinary<T extends FixedSizeBinary>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitDate<T extends Date_>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitDateDay<T extends DateDay>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitDateMillisecond<T extends DateMillisecond>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitTimestamp<T extends Timestamp>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitTimestampSecond<T extends TimestampSecond>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitTimestampMillisecond<T extends TimestampMillisecond>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitTimestampMicrosecond<T extends TimestampMicrosecond>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitTimestampNanosecond<T extends TimestampNanosecond>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitTime<T extends Time>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitTimeSecond<T extends TimeSecond>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitTimeMillisecond<T extends TimeMillisecond>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitTimeMicrosecond<T extends TimeMicrosecond>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitTimeNanosecond<T extends TimeNanosecond>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitDecimal<T extends Decimal>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitList<T extends List>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitStruct<T extends Struct>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitUnion<T extends Union>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitDenseUnion<T extends DenseUnion>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitSparseUnion<T extends SparseUnion>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitDictionary<T extends Dictionary>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitInterval<T extends Interval>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitIntervalDayTime<T extends IntervalDayTime>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitIntervalYearMonth<T extends IntervalYearMonth>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitDuration<T extends Duration>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitDurationSecond<T extends DurationSecond>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitDurationMillisecond<T extends DurationMillisecond>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitDurationMicrosecond<T extends DurationMicrosecond>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitDurationNanosecond<T extends DurationNanosecond>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitFixedSizeList<T extends FixedSizeList>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
    visitMap<T extends Map_>(vector: Vector<T>): IterableIterator<T['TValue'] | null>;
}
/** @ignore */
export declare class IteratorVisitor extends Visitor {
}
/** @ignore */
export declare const instance: IteratorVisitor;
