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
import { Vector } from '../vector.js';
import { DataType } from '../type.js';
import { Visitor } from '../visitor.js';
import { BuilderCtor } from '../interfaces.js';
import { BinaryBuilder } from '../builder/binary.js';
import { LargeBinaryBuilder } from '../builder/largebinary.js';
import { BoolBuilder } from '../builder/bool.js';
import { DateBuilder, DateDayBuilder, DateMillisecondBuilder } from '../builder/date.js';
import { DecimalBuilder } from '../builder/decimal.js';
import { DictionaryBuilder } from '../builder/dictionary.js';
import { FixedSizeBinaryBuilder } from '../builder/fixedsizebinary.js';
import { FixedSizeListBuilder } from '../builder/fixedsizelist.js';
import { FloatBuilder, Float16Builder, Float32Builder, Float64Builder } from '../builder/float.js';
import { IntervalBuilder, IntervalDayTimeBuilder, IntervalYearMonthBuilder } from '../builder/interval.js';
import { DurationBuilder, DurationSecondBuilder, DurationMillisecondBuilder, DurationMicrosecondBuilder, DurationNanosecondBuilder } from '../builder/duration.js';
import { IntBuilder, Int8Builder, Int16Builder, Int32Builder, Int64Builder, Uint8Builder, Uint16Builder, Uint32Builder, Uint64Builder } from '../builder/int.js';
import { ListBuilder } from '../builder/list.js';
import { MapBuilder } from '../builder/map.js';
import { NullBuilder } from '../builder/null.js';
import { StructBuilder } from '../builder/struct.js';
import { TimestampBuilder, TimestampSecondBuilder, TimestampMillisecondBuilder, TimestampMicrosecondBuilder, TimestampNanosecondBuilder } from '../builder/timestamp.js';
import { TimeBuilder, TimeSecondBuilder, TimeMillisecondBuilder, TimeMicrosecondBuilder, TimeNanosecondBuilder } from '../builder/time.js';
import { UnionBuilder, DenseUnionBuilder, SparseUnionBuilder } from '../builder/union.js';
import { Utf8Builder } from '../builder/utf8.js';
import { LargeUtf8Builder } from '../builder/largeutf8.js';

/** @ignore */
export interface GetBuilderCtor extends Visitor {
    visit<T extends Type>(type: T): BuilderCtor<T>;
    visitMany<T extends Type>(types: T[]): BuilderCtor<T>[];
    getVisitFn<T extends Type>(type: T): () => BuilderCtor<T>;
    getVisitFn<T extends DataType>(node: Vector<T> | Data<T> | T): () => BuilderCtor<T>;
}

/** @ignore */
export class GetBuilderCtor extends Visitor {
    public visitNull() { return NullBuilder; }
    public visitBool() { return BoolBuilder; }
    public visitInt() { return IntBuilder; }
    public visitInt8() { return Int8Builder; }
    public visitInt16() { return Int16Builder; }
    public visitInt32() { return Int32Builder; }
    public visitInt64() { return Int64Builder; }
    public visitUint8() { return Uint8Builder; }
    public visitUint16() { return Uint16Builder; }
    public visitUint32() { return Uint32Builder; }
    public visitUint64() { return Uint64Builder; }
    public visitFloat() { return FloatBuilder; }
    public visitFloat16() { return Float16Builder; }
    public visitFloat32() { return Float32Builder; }
    public visitFloat64() { return Float64Builder; }
    public visitUtf8() { return Utf8Builder; }
    public visitLargeUtf8() { return LargeUtf8Builder; }
    public visitBinary() { return BinaryBuilder; }
    public visitLargeBinary() { return LargeBinaryBuilder; }
    public visitFixedSizeBinary() { return FixedSizeBinaryBuilder; }
    public visitDate() { return DateBuilder; }
    public visitDateDay() { return DateDayBuilder; }
    public visitDateMillisecond() { return DateMillisecondBuilder; }
    public visitTimestamp() { return TimestampBuilder; }
    public visitTimestampSecond() { return TimestampSecondBuilder; }
    public visitTimestampMillisecond() { return TimestampMillisecondBuilder; }
    public visitTimestampMicrosecond() { return TimestampMicrosecondBuilder; }
    public visitTimestampNanosecond() { return TimestampNanosecondBuilder; }
    public visitTime() { return TimeBuilder; }
    public visitTimeSecond() { return TimeSecondBuilder; }
    public visitTimeMillisecond() { return TimeMillisecondBuilder; }
    public visitTimeMicrosecond() { return TimeMicrosecondBuilder; }
    public visitTimeNanosecond() { return TimeNanosecondBuilder; }
    public visitDecimal() { return DecimalBuilder; }
    public visitList() { return ListBuilder; }
    public visitStruct() { return StructBuilder; }
    public visitUnion() { return UnionBuilder; }
    public visitDenseUnion() { return DenseUnionBuilder; }
    public visitSparseUnion() { return SparseUnionBuilder; }
    public visitDictionary() { return DictionaryBuilder; }
    public visitInterval() { return IntervalBuilder; }
    public visitIntervalDayTime() { return IntervalDayTimeBuilder; }
    public visitIntervalYearMonth() { return IntervalYearMonthBuilder; }
    public visitDuration() { return DurationBuilder; }
    public visitDurationSecond() { return DurationSecondBuilder; }
    public visitDurationMillisecond() { return DurationMillisecondBuilder; }
    public visitDurationMicrosecond() { return DurationMicrosecondBuilder; }
    public visitDurationNanosecond() { return DurationNanosecondBuilder; }
    public visitFixedSizeList() { return FixedSizeListBuilder; }
    public visitMap() { return MapBuilder; }
}

/** @ignore */
export const instance = new GetBuilderCtor();
