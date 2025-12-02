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
import { Field } from '../schema.js';
import { Vector } from '../vector.js';
import { Visitor } from '../visitor.js';
import { bigIntToNumber } from '../util/bigint.js';
import { encodeUtf8 } from '../util/utf8.js';
import { TypeToDataType } from '../interfaces.js';
import { float64ToUint16 } from '../util/math.js';
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
export class SetVisitor extends Visitor { }

/** @ignore */
function wrapSet<T extends DataType>(fn: (data: Data<T>, _1: any, _2: any) => void) {
    return (data: Data<T>, _1: any, _2: any) => {
        if (data.setValid(_1, _2 != null)) {
            return fn(data, _1, _2);
        }
    };
}

/** @ignore */
export const setEpochMsToDays = (data: Int32Array, index: number, epochMs: number) => { data[index] = Math.floor(epochMs / 86400000); };

/** @ignore */
export const setVariableWidthBytes = <T extends Int32Array | BigInt64Array>(values: Uint8Array, valueOffsets: T, index: number, value: Uint8Array) => {
    if (index + 1 < valueOffsets.length) {
        const x = bigIntToNumber(valueOffsets[index]);
        const y = bigIntToNumber(valueOffsets[index + 1]);
        values.set(value.subarray(0, y - x), x);
    }
};

/** @ignore */
const setBool = <T extends Bool>({ offset, values }: Data<T>, index: number, val: boolean) => {
    const idx = offset + index;
    val ? (values[idx >> 3] |= (1 << (idx % 8)))  // true
        : (values[idx >> 3] &= ~(1 << (idx % 8))); // false

};
/** @ignore */
export const setInt = <T extends Int>({ values }: Data<T>, index: number, value: T['TValue']): void => { values[index] = value; };
/** @ignore */
export const setFloat = <T extends Float32 | Float64>({ values }: Data<T>, index: number, value: T['TValue']): void => { values[index] = value; };
/** @ignore */
export const setFloat16 = <T extends Float16>({ values }: Data<T>, index: number, value: T['TValue']): void => { values[index] = float64ToUint16(value); };
/* istanbul ignore next */
/** @ignore */
export const setAnyFloat = <T extends Float>(data: Data<T>, index: number, value: T['TValue']): void => {
    switch (data.type.precision) {
        case Precision.HALF:
            return setFloat16(data as Data<Float16>, index, value);
        case Precision.SINGLE:
        case Precision.DOUBLE:
            return setFloat(data as Data<Float32 | Float64>, index, value);
    }
};
/** @ignore */
export const setDateDay = <T extends DateDay>({ values }: Data<T>, index: number, value: T['TValue']): void => { setEpochMsToDays(values, index, value.valueOf()); };
/** @ignore */
export const setDateMillisecond = <T extends DateMillisecond>({ values }: Data<T>, index: number, value: T['TValue']): void => { values[index] = BigInt(value); };
/** @ignore */
export const setFixedSizeBinary = <T extends FixedSizeBinary>({ stride, values }: Data<T>, index: number, value: T['TValue']): void => { values.set(value.subarray(0, stride), stride * index); };

/** @ignore */
const setBinary = <T extends Binary | LargeBinary>({ values, valueOffsets }: Data<T>, index: number, value: T['TValue']) => setVariableWidthBytes(values, valueOffsets, index, value);
/** @ignore */
const setUtf8 = <T extends Utf8 | LargeUtf8>({ values, valueOffsets }: Data<T>, index: number, value: T['TValue']) => setVariableWidthBytes(values, valueOffsets, index, encodeUtf8(value));

/* istanbul ignore next */
export const setDate = <T extends Date_>(data: Data<T>, index: number, value: T['TValue']): void => {
    data.type.unit === DateUnit.DAY
        ? setDateDay(data as Data<DateDay>, index, value)
        : setDateMillisecond(data as Data<DateMillisecond>, index, value);
};

/** @ignore */
export const setTimestampSecond = <T extends TimestampSecond>({ values }: Data<T>, index: number, value: T['TValue']): void => { values[index] = BigInt(value / 1000); };
/** @ignore */
export const setTimestampMillisecond = <T extends TimestampMillisecond>({ values }: Data<T>, index: number, value: T['TValue']): void => { values[index] = BigInt(value); };
/** @ignore */
export const setTimestampMicrosecond = <T extends TimestampMicrosecond>({ values }: Data<T>, index: number, value: T['TValue']): void => { values[index] = BigInt(value * 1000); };
/** @ignore */
export const setTimestampNanosecond = <T extends TimestampNanosecond>({ values }: Data<T>, index: number, value: T['TValue']): void => { values[index] = BigInt(value * 1000000); };
/* istanbul ignore next */
/** @ignore */
export const setTimestamp = <T extends Timestamp>(data: Data<T>, index: number, value: T['TValue']): void => {
    switch (data.type.unit) {
        case TimeUnit.SECOND: return setTimestampSecond(data as Data<TimestampSecond>, index, value);
        case TimeUnit.MILLISECOND: return setTimestampMillisecond(data as Data<TimestampMillisecond>, index, value);
        case TimeUnit.MICROSECOND: return setTimestampMicrosecond(data as Data<TimestampMicrosecond>, index, value);
        case TimeUnit.NANOSECOND: return setTimestampNanosecond(data as Data<TimestampNanosecond>, index, value);
    }
};

/** @ignore */
export const setTimeSecond = <T extends TimeSecond>({ values }: Data<T>, index: number, value: T['TValue']): void => { values[index] = value; };
/** @ignore */
export const setTimeMillisecond = <T extends TimeMillisecond>({ values }: Data<T>, index: number, value: T['TValue']): void => { values[index] = value; };
/** @ignore */
export const setTimeMicrosecond = <T extends TimeMicrosecond>({ values }: Data<T>, index: number, value: T['TValue']): void => { values[index] = value; };
/** @ignore */
export const setTimeNanosecond = <T extends TimeNanosecond>({ values }: Data<T>, index: number, value: T['TValue']): void => { values[index] = value; };
/* istanbul ignore next */
/** @ignore */
export const setTime = <T extends Time>(data: Data<T>, index: number, value: T['TValue']): void => {
    switch (data.type.unit) {
        case TimeUnit.SECOND: return setTimeSecond(data as Data<TimeSecond>, index, value as TimeSecond['TValue']);
        case TimeUnit.MILLISECOND: return setTimeMillisecond(data as Data<TimeMillisecond>, index, value as TimeMillisecond['TValue']);
        case TimeUnit.MICROSECOND: return setTimeMicrosecond(data as Data<TimeMicrosecond>, index, value as TimeMicrosecond['TValue']);
        case TimeUnit.NANOSECOND: return setTimeNanosecond(data as Data<TimeNanosecond>, index, value as TimeNanosecond['TValue']);
    }
};

/** @ignore */
export const setDecimal = <T extends Decimal>({ values, stride }: Data<T>, index: number, value: T['TValue']): void => { values.set(value.subarray(0, stride), stride * index); };

/** @ignore */
const setList = <T extends List>(data: Data<T>, index: number, value: T['TValue']): void => {
    const values = data.children[0];
    const valueOffsets = data.valueOffsets;
    const set = instance.getVisitFn(values);
    if (Array.isArray(value)) {
        for (let idx = -1, itr = valueOffsets[index], end = valueOffsets[index + 1]; itr < end;) {
            set(values, itr++, value[++idx]);
        }
    } else {
        for (let idx = -1, itr = valueOffsets[index], end = valueOffsets[index + 1]; itr < end;) {
            set(values, itr++, value.get(++idx));
        }
    }
};

/** @ignore */
const setMap = <T extends Map_>(data: Data<T>, index: number, value: T['TValue']) => {
    const values = data.children[0];
    const { valueOffsets } = data;
    const set = instance.getVisitFn(values);
    let { [index]: idx, [index + 1]: end } = valueOffsets;
    const entries = value instanceof Map ? value.entries() : Object.entries(value);
    for (const val of entries) {
        set(values, idx, val);
        if (++idx >= end) break;
    }
};

/** @ignore */ type SetFunc<T extends DataType> = (data: Data<T>, i: number, v: T['TValue']) => void;

/** @ignore */ const _setStructArrayValue = (o: number, v: any[]) =>
    <T extends DataType>(set: SetFunc<T>, c: Data<T>, _: Field, i: number) => c && set(c, o, v[i]);

/** @ignore */ const _setStructVectorValue = (o: number, v: Vector) =>
    <T extends DataType>(set: SetFunc<T>, c: Data<T>, _: Field, i: number) => c && set(c, o, v.get(i));

/** @ignore */ const _setStructMapValue = (o: number, v: Map<string, any>) =>
    <T extends DataType>(set: SetFunc<T>, c: Data<T>, f: Field, _: number) => c && set(c, o, v.get(f.name));

/** @ignore */ const _setStructObjectValue = (o: number, v: { [key: string]: any }) =>
    <T extends DataType>(set: SetFunc<T>, c: Data<T>, f: Field, _: number) => c && set(c, o, v[f.name]);

/** @ignore */
const setStruct = <T extends Struct>(data: Data<T>, index: number, value: T['TValue']) => {

    const childSetters = data.type.children.map((f) => instance.getVisitFn(f.type));
    const set = value instanceof Map ? _setStructMapValue(index, value) :
        value instanceof Vector ? _setStructVectorValue(index, value) :
            Array.isArray(value) ? _setStructArrayValue(index, value) :
                _setStructObjectValue(index, value);

    // eslint-disable-next-line unicorn/no-array-for-each
    data.type.children.forEach((f: Field, i: number) => set(childSetters[i], data.children[i], f, i));
};

/* istanbul ignore next */
/** @ignore */
const setUnion = <
    V extends Data<Union> | Data<DenseUnion> | Data<SparseUnion>
>(data: V, index: number, value: V['TValue']) => {
    data.type.mode === UnionMode.Dense ?
        setDenseUnion(data as Data<DenseUnion>, index, value) :
        setSparseUnion(data as Data<SparseUnion>, index, value);
};

/** @ignore */
const setDenseUnion = <T extends DenseUnion>(data: Data<T>, index: number, value: T['TValue']): void => {
    const childIndex = data.type.typeIdToChildIndex[data.typeIds[index]];
    const child = data.children[childIndex];
    instance.visit(child, data.valueOffsets[index], value);
};

/** @ignore */
const setSparseUnion = <T extends SparseUnion>(data: Data<T>, index: number, value: T['TValue']): void => {
    const childIndex = data.type.typeIdToChildIndex[data.typeIds[index]];
    const child = data.children[childIndex];
    instance.visit(child, index, value);
};

/** @ignore */
const setDictionary = <T extends Dictionary>(data: Data<T>, index: number, value: T['TValue']): void => {
    data.dictionary?.set(data.values[index], value);
};

/* istanbul ignore next */
/** @ignore */
export const setIntervalValue = <T extends Interval>(data: Data<T>, index: number, value: T['TValue']): void => {
    (data.type.unit === IntervalUnit.DAY_TIME)
        ? setIntervalDayTime(data as Data<IntervalDayTime>, index, value)
        : setIntervalYearMonth(data as Data<IntervalYearMonth>, index, value);
};

/** @ignore */
export const setIntervalDayTime = <T extends IntervalDayTime>({ values }: Data<T>, index: number, value: T['TValue']): void => { values.set(value.subarray(0, 2), 2 * index); };
/** @ignore */
export const setIntervalYearMonth = <T extends IntervalYearMonth>({ values }: Data<T>, index: number, value: T['TValue']): void => { values[index] = (value[0] * 12) + (value[1] % 12); };

/** @ignore */
export const setDurationSecond = <T extends DurationSecond>({ values }: Data<T>, index: number, value: T['TValue']): void => { values[index] = value; };
/** @ignore */
export const setDurationMillisecond = <T extends DurationMillisecond>({ values }: Data<T>, index: number, value: T['TValue']): void => { values[index] = value; };
/** @ignore */
export const setDurationMicrosecond = <T extends DurationMicrosecond>({ values }: Data<T>, index: number, value: T['TValue']): void => { values[index] = value; };
/** @ignore */
export const setDurationNanosecond = <T extends DurationNanosecond>({ values }: Data<T>, index: number, value: T['TValue']): void => { values[index] = value; };
/* istanbul ignore next */
/** @ignore */
export const setDuration = <T extends Duration>(data: Data<T>, index: number, value: T['TValue']): void => {
    switch (data.type.unit) {
        case TimeUnit.SECOND: return setDurationSecond(data as Data<DurationSecond>, index, value as DurationSecond['TValue']);
        case TimeUnit.MILLISECOND: return setDurationMillisecond(data as Data<DurationMillisecond>, index, value as DurationMillisecond['TValue']);
        case TimeUnit.MICROSECOND: return setDurationMicrosecond(data as Data<DurationMicrosecond>, index, value as DurationMicrosecond['TValue']);
        case TimeUnit.NANOSECOND: return setDurationNanosecond(data as Data<DurationNanosecond>, index, value as DurationNanosecond['TValue']);
    }
};


/** @ignore */
const setFixedSizeList = <T extends FixedSizeList>(data: Data<T>, index: number, value: T['TValue']): void => {
    const { stride } = data;
    const child = data.children[0];
    const set = instance.getVisitFn(child);
    if (Array.isArray(value)) {
        for (let idx = -1, offset = index * stride; ++idx < stride;) {
            set(child, offset + idx, value[idx]);
        }
    } else {
        for (let idx = -1, offset = index * stride; ++idx < stride;) {
            set(child, offset + idx, value.get(idx));
        }
    }
};

SetVisitor.prototype.visitBool = wrapSet(setBool);
SetVisitor.prototype.visitInt = wrapSet(setInt);
SetVisitor.prototype.visitInt8 = wrapSet(setInt);
SetVisitor.prototype.visitInt16 = wrapSet(setInt);
SetVisitor.prototype.visitInt32 = wrapSet(setInt);
SetVisitor.prototype.visitInt64 = wrapSet(setInt);
SetVisitor.prototype.visitUint8 = wrapSet(setInt);
SetVisitor.prototype.visitUint16 = wrapSet(setInt);
SetVisitor.prototype.visitUint32 = wrapSet(setInt);
SetVisitor.prototype.visitUint64 = wrapSet(setInt);
SetVisitor.prototype.visitFloat = wrapSet(setAnyFloat);
SetVisitor.prototype.visitFloat16 = wrapSet(setFloat16);
SetVisitor.prototype.visitFloat32 = wrapSet(setFloat);
SetVisitor.prototype.visitFloat64 = wrapSet(setFloat);
SetVisitor.prototype.visitUtf8 = wrapSet(setUtf8);
SetVisitor.prototype.visitLargeUtf8 = wrapSet(setUtf8);
SetVisitor.prototype.visitBinary = wrapSet(setBinary);
SetVisitor.prototype.visitLargeBinary = wrapSet(setBinary);
SetVisitor.prototype.visitFixedSizeBinary = wrapSet(setFixedSizeBinary);
SetVisitor.prototype.visitDate = wrapSet(setDate);
SetVisitor.prototype.visitDateDay = wrapSet(setDateDay);
SetVisitor.prototype.visitDateMillisecond = wrapSet(setDateMillisecond);
SetVisitor.prototype.visitTimestamp = wrapSet(setTimestamp);
SetVisitor.prototype.visitTimestampSecond = wrapSet(setTimestampSecond);
SetVisitor.prototype.visitTimestampMillisecond = wrapSet(setTimestampMillisecond);
SetVisitor.prototype.visitTimestampMicrosecond = wrapSet(setTimestampMicrosecond);
SetVisitor.prototype.visitTimestampNanosecond = wrapSet(setTimestampNanosecond);
SetVisitor.prototype.visitTime = wrapSet(setTime);
SetVisitor.prototype.visitTimeSecond = wrapSet(setTimeSecond);
SetVisitor.prototype.visitTimeMillisecond = wrapSet(setTimeMillisecond);
SetVisitor.prototype.visitTimeMicrosecond = wrapSet(setTimeMicrosecond);
SetVisitor.prototype.visitTimeNanosecond = wrapSet(setTimeNanosecond);
SetVisitor.prototype.visitDecimal = wrapSet(setDecimal);
SetVisitor.prototype.visitList = wrapSet(setList);
SetVisitor.prototype.visitStruct = wrapSet(setStruct);
SetVisitor.prototype.visitUnion = wrapSet(setUnion);
SetVisitor.prototype.visitDenseUnion = wrapSet(setDenseUnion);
SetVisitor.prototype.visitSparseUnion = wrapSet(setSparseUnion);
SetVisitor.prototype.visitDictionary = wrapSet(setDictionary);
SetVisitor.prototype.visitInterval = wrapSet(setIntervalValue);
SetVisitor.prototype.visitIntervalDayTime = wrapSet(setIntervalDayTime);
SetVisitor.prototype.visitIntervalYearMonth = wrapSet(setIntervalYearMonth);
SetVisitor.prototype.visitDuration = wrapSet(setDuration);
SetVisitor.prototype.visitDurationSecond = wrapSet(setDurationSecond);
SetVisitor.prototype.visitDurationMillisecond = wrapSet(setDurationMillisecond);
SetVisitor.prototype.visitDurationMicrosecond = wrapSet(setDurationMicrosecond);
SetVisitor.prototype.visitDurationNanosecond = wrapSet(setDurationNanosecond);
SetVisitor.prototype.visitFixedSizeList = wrapSet(setFixedSizeList);
SetVisitor.prototype.visitMap = wrapSet(setMap);

/** @ignore */
export const instance = new SetVisitor();
