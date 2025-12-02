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

import { Data } from '../data.js';
import { BN } from '../util/bn.js';
import { Vector } from '../vector.js';
import { Visitor } from '../visitor.js';
import { MapRow } from '../row/map.js';
import { StructRow, StructRowProxy } from '../row/struct.js';
import { bigIntToNumber, divideBigInts } from '../util/bigint.js';
import { decodeUtf8 } from '../util/utf8.js';
import { TypeToDataType } from '../interfaces.js';
import { uint16ToFloat64 } from '../util/math.js';
import { Type, UnionMode, Precision, DateUnit, TimeUnit, IntervalUnit } from '../enum.js';
import {
    DataType, Dictionary,
    Bool, Null, Utf8, LargeUtf8, Binary, LargeBinary, Decimal, FixedSizeBinary, List, FixedSizeList, Map_, Struct,
    Float, Float16, Float32, Float64,
    Int, Uint8, Uint16, Uint32, Uint64, Int8, Int16, Int32, Int64,
    Date_, DateDay, DateMillisecond,
    Interval, IntervalDayTime, IntervalYearMonth,
    Time, TimeSecond, TimeMillisecond, TimeMicrosecond, TimeNanosecond,
    Timestamp, TimestampSecond, TimestampMillisecond, TimestampMicrosecond, TimestampNanosecond,
    Duration, DurationSecond, DurationMillisecond, DurationMicrosecond, DurationNanosecond,
    Union, DenseUnion, SparseUnion,
} from '../type.js';

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
export class GetVisitor extends Visitor { }

/** @ignore */
function wrapGet<T extends DataType>(fn: (data: Data<T>, _1: any) => any) {
    return (data: Data<T>, _1: any) => data.getValid(_1) ? fn(data, _1) : null;
}

/** @ignore */const epochDaysToMs = (data: Int32Array, index: number) => 86400000 * data[index];

/** @ignore */
const getNull = <T extends Null>(_data: Data<T>, _index: number): T['TValue'] => null;
/** @ignore */
const getVariableWidthBytes = (values: Uint8Array, valueOffsets: Int32Array | BigInt64Array, index: number) => {
    if (index + 1 >= valueOffsets.length) {
        return null as any;
    }
    const x = bigIntToNumber(valueOffsets[index]);
    const y = bigIntToNumber(valueOffsets[index + 1]);
    return values.subarray(x, y);
};

/** @ignore */
const getBool = <T extends Bool>({ offset, values }: Data<T>, index: number): T['TValue'] => {
    const idx = offset + index;
    const byte = values[idx >> 3];
    return (byte & 1 << (idx % 8)) !== 0;
};

/** @ignore */
type Numeric1X = Int8 | Int16 | Int32 | Uint8 | Uint16 | Uint32 | Float32 | Float64;
/** @ignore */
type Numeric2X = Int64 | Uint64;

/** @ignore */
const getDateDay = <T extends DateDay>({ values }: Data<T>, index: number): T['TValue'] => epochDaysToMs(values, index);
/** @ignore */
const getDateMillisecond = <T extends DateMillisecond>({ values }: Data<T>, index: number): T['TValue'] => bigIntToNumber(values[index]);
/** @ignore */
const getNumeric = <T extends Numeric1X>({ stride, values }: Data<T>, index: number): T['TValue'] => values[stride * index];
/** @ignore */
const getFloat16 = <T extends Float16>({ stride, values }: Data<T>, index: number): T['TValue'] => uint16ToFloat64(values[stride * index]);
/** @ignore */
const getBigInts = <T extends Numeric2X>({ values }: Data<T>, index: number): T['TValue'] => values[index];
/** @ignore */
const getFixedSizeBinary = <T extends FixedSizeBinary>({ stride, values }: Data<T>, index: number): T['TValue'] => values.subarray(stride * index, stride * (index + 1));

/** @ignore */
const getBinary = <T extends Binary | LargeBinary>({ values, valueOffsets }: Data<T>, index: number): T['TValue'] => getVariableWidthBytes(values, valueOffsets, index);
/** @ignore */
const getUtf8 = <T extends Utf8 | LargeUtf8>({ values, valueOffsets }: Data<T>, index: number): T['TValue'] => {
    const bytes = getVariableWidthBytes(values, valueOffsets, index);
    return bytes !== null ? decodeUtf8(bytes) : null as any;
};

/* istanbul ignore next */
/** @ignore */
const getInt = <T extends Int>({ values }: Data<T>, index: number): T['TValue'] => values[index];

/* istanbul ignore next */
/** @ignore */
const getFloat = <T extends Float>({ type, values }: Data<T>, index: number): T['TValue'] => (
    type.precision !== Precision.HALF ? values[index] : uint16ToFloat64(values[index])
);

/* istanbul ignore next */
/** @ignore */
const getDate = <T extends Date_>(data: Data<T>, index: number): T['TValue'] => (
    data.type.unit === DateUnit.DAY
        ? getDateDay(data as Data<DateDay>, index)
        : getDateMillisecond(data as Data<DateMillisecond>, index)
);

/** @ignore */
const getTimestampSecond = <T extends TimestampSecond>({ values }: Data<T>, index: number): T['TValue'] => 1000 * bigIntToNumber(values[index]);
/** @ignore */
const getTimestampMillisecond = <T extends TimestampMillisecond>({ values }: Data<T>, index: number): T['TValue'] => bigIntToNumber(values[index]);
/** @ignore */
const getTimestampMicrosecond = <T extends TimestampMicrosecond>({ values }: Data<T>, index: number): T['TValue'] => divideBigInts(values[index], BigInt(1000));
/** @ignore */
const getTimestampNanosecond = <T extends TimestampNanosecond>({ values }: Data<T>, index: number): T['TValue'] => divideBigInts(values[index], BigInt(1000000));
/* istanbul ignore next */
/** @ignore */
const getTimestamp = <T extends Timestamp>(data: Data<T>, index: number): T['TValue'] => {
    switch (data.type.unit) {
        case TimeUnit.SECOND: return getTimestampSecond(data as Data<TimestampSecond>, index);
        case TimeUnit.MILLISECOND: return getTimestampMillisecond(data as Data<TimestampMillisecond>, index);
        case TimeUnit.MICROSECOND: return getTimestampMicrosecond(data as Data<TimestampMicrosecond>, index);
        case TimeUnit.NANOSECOND: return getTimestampNanosecond(data as Data<TimestampNanosecond>, index);
    }
};

/** @ignore */
const getTimeSecond = <T extends TimeSecond>({ values }: Data<T>, index: number): T['TValue'] => values[index];
/** @ignore */
const getTimeMillisecond = <T extends TimeMillisecond>({ values }: Data<T>, index: number): T['TValue'] => values[index];
/** @ignore */
const getTimeMicrosecond = <T extends TimeMicrosecond>({ values }: Data<T>, index: number): T['TValue'] => values[index];
/** @ignore */
const getTimeNanosecond = <T extends TimeNanosecond>({ values }: Data<T>, index: number): T['TValue'] => values[index];
/* istanbul ignore next */
/** @ignore */
const getTime = <T extends Time>(data: Data<T>, index: number): T['TValue'] => {
    switch (data.type.unit) {
        case TimeUnit.SECOND: return getTimeSecond(data as Data<TimeSecond>, index);
        case TimeUnit.MILLISECOND: return getTimeMillisecond(data as Data<TimeMillisecond>, index);
        case TimeUnit.MICROSECOND: return getTimeMicrosecond(data as Data<TimeMicrosecond>, index);
        case TimeUnit.NANOSECOND: return getTimeNanosecond(data as Data<TimeNanosecond>, index);
    }
};

/** @ignore */
const getDecimal = <T extends Decimal>({ values, stride }: Data<T>, index: number): T['TValue'] => BN.decimal(values.subarray(stride * index, stride * (index + 1)));

/** @ignore */
const getList = <T extends List>(data: Data<T>, index: number): T['TValue'] => {
    const { valueOffsets, stride, children } = data;
    const { [index * stride]: begin, [index * stride + 1]: end } = valueOffsets;
    const child: Data<T['valueType']> = children[0];
    const slice = child.slice(begin, end - begin);
    return new Vector([slice]) as T['TValue'];
};

/** @ignore */
const getMap = <T extends Map_>(data: Data<T>, index: number): T['TValue'] => {
    const { valueOffsets, children } = data;
    const { [index]: begin, [index + 1]: end } = valueOffsets;
    const child = children[0] as Data<T['childType']>;
    return new MapRow(child.slice(begin, end - begin));
};

/** @ignore */
const getStruct = <T extends Struct>(data: Data<T>, index: number): T['TValue'] => {
    return new StructRow(data, index) as StructRowProxy<T['TValue']>;
};

/* istanbul ignore next */
/** @ignore */
const getUnion = <
    D extends Data<Union> | Data<DenseUnion> | Data<SparseUnion>
>(data: D, index: number): D['TValue'] => {
    return data.type.mode === UnionMode.Dense ?
        getDenseUnion(data as Data<DenseUnion>, index) :
        getSparseUnion(data as Data<SparseUnion>, index);
};

/** @ignore */
const getDenseUnion = <T extends DenseUnion>(data: Data<T>, index: number): T['TValue'] => {
    const childIndex = data.type.typeIdToChildIndex[data.typeIds[index]];
    const child = data.children[childIndex];
    return instance.visit(child, data.valueOffsets[index]);
};

/** @ignore */
const getSparseUnion = <T extends SparseUnion>(data: Data<T>, index: number): T['TValue'] => {
    const childIndex = data.type.typeIdToChildIndex[data.typeIds[index]];
    const child = data.children[childIndex];
    return instance.visit(child, index);
};

/** @ignore */
const getDictionary = <T extends Dictionary>(data: Data<T>, index: number): T['TValue'] => {
    return data.dictionary?.get(data.values[index]);
};

/* istanbul ignore next */
/** @ignore */
const getInterval = <T extends Interval>(data: Data<T>, index: number): T['TValue'] =>
    (data.type.unit === IntervalUnit.DAY_TIME)
        ? getIntervalDayTime(data as Data<IntervalDayTime>, index)
        : getIntervalYearMonth(data as Data<IntervalYearMonth>, index);

/** @ignore */
const getIntervalDayTime = <T extends IntervalDayTime>({ values }: Data<T>, index: number): T['TValue'] => values.subarray(2 * index, 2 * (index + 1));

/** @ignore */
const getIntervalYearMonth = <T extends IntervalYearMonth>({ values }: Data<T>, index: number): T['TValue'] => {
    const interval = values[index];
    const int32s = new Int32Array(2);
    int32s[0] = Math.trunc(interval / 12); /* years */
    int32s[1] = Math.trunc(interval % 12); /* months */
    return int32s;
};

/** @ignore */
const getDurationSecond = <T extends DurationSecond>({ values }: Data<T>, index: number): T['TValue'] => values[index];
/** @ignore */
const getDurationMillisecond = <T extends DurationMillisecond>({ values }: Data<T>, index: number): T['TValue'] => values[index];
/** @ignore */
const getDurationMicrosecond = <T extends DurationMicrosecond>({ values }: Data<T>, index: number): T['TValue'] => values[index];
/** @ignore */
const getDurationNanosecond = <T extends DurationNanosecond>({ values }: Data<T>, index: number): T['TValue'] => values[index];
/* istanbul ignore next */
/** @ignore */
const getDuration = <T extends Duration>(data: Data<T>, index: number): T['TValue'] => {
    switch (data.type.unit) {
        case TimeUnit.SECOND: return getDurationSecond(data as Data<DurationSecond>, index);
        case TimeUnit.MILLISECOND: return getDurationMillisecond(data as Data<DurationMillisecond>, index);
        case TimeUnit.MICROSECOND: return getDurationMicrosecond(data as Data<DurationMicrosecond>, index);
        case TimeUnit.NANOSECOND: return getDurationNanosecond(data as Data<DurationNanosecond>, index);
    }
};

/** @ignore */
const getFixedSizeList = <T extends FixedSizeList>(data: Data<T>, index: number): T['TValue'] => {
    const { stride, children } = data;
    const child: Data<T['valueType']> = children[0];
    const slice = child.slice(index * stride, stride);
    return new Vector([slice]);
};

GetVisitor.prototype.visitNull = wrapGet(getNull);
GetVisitor.prototype.visitBool = wrapGet(getBool);
GetVisitor.prototype.visitInt = wrapGet(getInt);
GetVisitor.prototype.visitInt8 = wrapGet(getNumeric);
GetVisitor.prototype.visitInt16 = wrapGet(getNumeric);
GetVisitor.prototype.visitInt32 = wrapGet(getNumeric);
GetVisitor.prototype.visitInt64 = wrapGet(getBigInts);
GetVisitor.prototype.visitUint8 = wrapGet(getNumeric);
GetVisitor.prototype.visitUint16 = wrapGet(getNumeric);
GetVisitor.prototype.visitUint32 = wrapGet(getNumeric);
GetVisitor.prototype.visitUint64 = wrapGet(getBigInts);
GetVisitor.prototype.visitFloat = wrapGet(getFloat);
GetVisitor.prototype.visitFloat16 = wrapGet(getFloat16);
GetVisitor.prototype.visitFloat32 = wrapGet(getNumeric);
GetVisitor.prototype.visitFloat64 = wrapGet(getNumeric);
GetVisitor.prototype.visitUtf8 = wrapGet(getUtf8);
GetVisitor.prototype.visitLargeUtf8 = wrapGet(getUtf8);
GetVisitor.prototype.visitBinary = wrapGet(getBinary);
GetVisitor.prototype.visitLargeBinary = wrapGet(getBinary);
GetVisitor.prototype.visitFixedSizeBinary = wrapGet(getFixedSizeBinary);
GetVisitor.prototype.visitDate = wrapGet(getDate);
GetVisitor.prototype.visitDateDay = wrapGet(getDateDay);
GetVisitor.prototype.visitDateMillisecond = wrapGet(getDateMillisecond);
GetVisitor.prototype.visitTimestamp = wrapGet(getTimestamp);
GetVisitor.prototype.visitTimestampSecond = wrapGet(getTimestampSecond);
GetVisitor.prototype.visitTimestampMillisecond = wrapGet(getTimestampMillisecond);
GetVisitor.prototype.visitTimestampMicrosecond = wrapGet(getTimestampMicrosecond);
GetVisitor.prototype.visitTimestampNanosecond = wrapGet(getTimestampNanosecond);
GetVisitor.prototype.visitTime = wrapGet(getTime);
GetVisitor.prototype.visitTimeSecond = wrapGet(getTimeSecond);
GetVisitor.prototype.visitTimeMillisecond = wrapGet(getTimeMillisecond);
GetVisitor.prototype.visitTimeMicrosecond = wrapGet(getTimeMicrosecond);
GetVisitor.prototype.visitTimeNanosecond = wrapGet(getTimeNanosecond);
GetVisitor.prototype.visitDecimal = wrapGet(getDecimal);
GetVisitor.prototype.visitList = wrapGet(getList);
GetVisitor.prototype.visitStruct = wrapGet(getStruct);
GetVisitor.prototype.visitUnion = wrapGet(getUnion);
GetVisitor.prototype.visitDenseUnion = wrapGet(getDenseUnion);
GetVisitor.prototype.visitSparseUnion = wrapGet(getSparseUnion);
GetVisitor.prototype.visitDictionary = wrapGet(getDictionary);
GetVisitor.prototype.visitInterval = wrapGet(getInterval);
GetVisitor.prototype.visitIntervalDayTime = wrapGet(getIntervalDayTime);
GetVisitor.prototype.visitIntervalYearMonth = wrapGet(getIntervalYearMonth);
GetVisitor.prototype.visitDuration = wrapGet(getDuration);
GetVisitor.prototype.visitDurationSecond = wrapGet(getDurationSecond);
GetVisitor.prototype.visitDurationMillisecond = wrapGet(getDurationMillisecond);
GetVisitor.prototype.visitDurationMicrosecond = wrapGet(getDurationMicrosecond);
GetVisitor.prototype.visitDurationNanosecond = wrapGet(getDurationNanosecond);
GetVisitor.prototype.visitFixedSizeList = wrapGet(getFixedSizeList);
GetVisitor.prototype.visitMap = wrapGet(getMap);

/** @ignore */
export const instance = new GetVisitor();
