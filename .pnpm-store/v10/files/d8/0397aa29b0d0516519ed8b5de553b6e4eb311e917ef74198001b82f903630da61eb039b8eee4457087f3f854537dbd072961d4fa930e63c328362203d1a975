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
import { Type } from '../enum.js';
import { Visitor } from '../visitor.js';
import { instance as getVisitor } from './get.js';
import { TypeToDataType } from '../interfaces.js';
import { getBool, BitIterator } from '../util/bit.js';
import { createElementComparator } from '../util/vector.js';
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
export class IndexOfVisitor extends Visitor { }

/** @ignore */
function nullIndexOf(data: Data<Null>, searchElement?: null) {
    // if you're looking for nulls and the vector isn't empty, we've got 'em!
    return searchElement === null && data.length > 0 ? 0 : -1;
}

/** @ignore */
function indexOfNull<T extends DataType>(data: Data<T>, fromIndex?: number): number {
    const { nullBitmap } = data;
    if (!nullBitmap || data.nullCount <= 0) {
        return -1;
    }
    let i = 0;
    for (const isValid of new BitIterator(nullBitmap, data.offset + (fromIndex || 0), data.length, nullBitmap, getBool)) {
        if (!isValid) { return i; }
        ++i;
    }
    return -1;
}

/** @ignore */
function indexOfValue<T extends DataType>(data: Data<T>, searchElement?: T['TValue'] | null, fromIndex?: number): number {
    if (searchElement === undefined) { return -1; }
    if (searchElement === null) {
        switch (data.typeId) {
            // Unions don't have a nullBitmap of its own, so compare the `searchElement` to `get()`.
            case Type.Union:
                break;
            // Dictionaries do have a nullBitmap, but their dictionary could also have null elements.
            case Type.Dictionary:
                break;
            // All other types can iterate the null bitmap
            default:
                return indexOfNull(data, fromIndex);
        }
    }
    const get = getVisitor.getVisitFn(data);
    const compare = createElementComparator(searchElement);
    for (let i = (fromIndex || 0) - 1, n = data.length; ++i < n;) {
        if (compare(get(data, i))) {
            return i;
        }
    }
    return -1;
}

/** @ignore */
function indexOfUnion<T extends DataType>(data: Data<T>, searchElement?: T['TValue'] | null, fromIndex?: number): number {
    // Unions are special -- they do have a nullBitmap, but so can their children.
    // If the searchElement is null, we don't know whether it came from the Union's
    // bitmap or one of its children's. So we don't interrogate the Union's bitmap,
    // since that will report the wrong index if a child has a null before the Union.
    const get = getVisitor.getVisitFn(data);
    const compare = createElementComparator(searchElement);
    for (let i = (fromIndex || 0) - 1, n = data.length; ++i < n;) {
        if (compare(get(data, i))) {
            return i;
        }
    }
    return -1;
}

IndexOfVisitor.prototype.visitNull = nullIndexOf;
IndexOfVisitor.prototype.visitBool = indexOfValue;
IndexOfVisitor.prototype.visitInt = indexOfValue;
IndexOfVisitor.prototype.visitInt8 = indexOfValue;
IndexOfVisitor.prototype.visitInt16 = indexOfValue;
IndexOfVisitor.prototype.visitInt32 = indexOfValue;
IndexOfVisitor.prototype.visitInt64 = indexOfValue;
IndexOfVisitor.prototype.visitUint8 = indexOfValue;
IndexOfVisitor.prototype.visitUint16 = indexOfValue;
IndexOfVisitor.prototype.visitUint32 = indexOfValue;
IndexOfVisitor.prototype.visitUint64 = indexOfValue;
IndexOfVisitor.prototype.visitFloat = indexOfValue;
IndexOfVisitor.prototype.visitFloat16 = indexOfValue;
IndexOfVisitor.prototype.visitFloat32 = indexOfValue;
IndexOfVisitor.prototype.visitFloat64 = indexOfValue;
IndexOfVisitor.prototype.visitUtf8 = indexOfValue;
IndexOfVisitor.prototype.visitLargeUtf8 = indexOfValue;
IndexOfVisitor.prototype.visitBinary = indexOfValue;
IndexOfVisitor.prototype.visitLargeBinary = indexOfValue;
IndexOfVisitor.prototype.visitFixedSizeBinary = indexOfValue;
IndexOfVisitor.prototype.visitDate = indexOfValue;
IndexOfVisitor.prototype.visitDateDay = indexOfValue;
IndexOfVisitor.prototype.visitDateMillisecond = indexOfValue;
IndexOfVisitor.prototype.visitTimestamp = indexOfValue;
IndexOfVisitor.prototype.visitTimestampSecond = indexOfValue;
IndexOfVisitor.prototype.visitTimestampMillisecond = indexOfValue;
IndexOfVisitor.prototype.visitTimestampMicrosecond = indexOfValue;
IndexOfVisitor.prototype.visitTimestampNanosecond = indexOfValue;
IndexOfVisitor.prototype.visitTime = indexOfValue;
IndexOfVisitor.prototype.visitTimeSecond = indexOfValue;
IndexOfVisitor.prototype.visitTimeMillisecond = indexOfValue;
IndexOfVisitor.prototype.visitTimeMicrosecond = indexOfValue;
IndexOfVisitor.prototype.visitTimeNanosecond = indexOfValue;
IndexOfVisitor.prototype.visitDecimal = indexOfValue;
IndexOfVisitor.prototype.visitList = indexOfValue;
IndexOfVisitor.prototype.visitStruct = indexOfValue;
IndexOfVisitor.prototype.visitUnion = indexOfValue;
IndexOfVisitor.prototype.visitDenseUnion = indexOfUnion;
IndexOfVisitor.prototype.visitSparseUnion = indexOfUnion;
IndexOfVisitor.prototype.visitDictionary = indexOfValue;
IndexOfVisitor.prototype.visitInterval = indexOfValue;
IndexOfVisitor.prototype.visitIntervalDayTime = indexOfValue;
IndexOfVisitor.prototype.visitIntervalYearMonth = indexOfValue;
IndexOfVisitor.prototype.visitDuration = indexOfValue;
IndexOfVisitor.prototype.visitDurationSecond = indexOfValue;
IndexOfVisitor.prototype.visitDurationMillisecond = indexOfValue;
IndexOfVisitor.prototype.visitDurationMicrosecond = indexOfValue;
IndexOfVisitor.prototype.visitDurationNanosecond = indexOfValue;
IndexOfVisitor.prototype.visitFixedSizeList = indexOfValue;
IndexOfVisitor.prototype.visitMap = indexOfValue;

/** @ignore */
export const instance = new IndexOfVisitor();
