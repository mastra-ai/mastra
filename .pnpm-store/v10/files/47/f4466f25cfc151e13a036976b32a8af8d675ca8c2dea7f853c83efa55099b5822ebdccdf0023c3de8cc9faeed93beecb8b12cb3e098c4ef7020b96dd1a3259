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
import * as type from '../type.js';
import { Vector } from '../vector.js';
import { DataType } from '../type.js';
import { Visitor } from '../visitor.js';
import { DataTypeCtor } from '../interfaces.js';

/** @ignore */
export interface GetDataTypeConstructor extends Visitor {
    visit<T extends Type>(node: T): DataTypeCtor<T>;
    visitMany<T extends Type>(nodes: T[]): DataTypeCtor<T>[];
    getVisitFn<T extends Type>(node: T): () => DataTypeCtor<T>;
    getVisitFn<T extends DataType>(node: Vector<T> | Data<T> | T): () => DataTypeCtor<T>;
}

/** @ignore */
export class GetDataTypeConstructor extends Visitor {
    public visitNull() { return type.Null; }
    public visitBool() { return type.Bool; }
    public visitInt() { return type.Int; }
    public visitInt8() { return type.Int8; }
    public visitInt16() { return type.Int16; }
    public visitInt32() { return type.Int32; }
    public visitInt64() { return type.Int64; }
    public visitUint8() { return type.Uint8; }
    public visitUint16() { return type.Uint16; }
    public visitUint32() { return type.Uint32; }
    public visitUint64() { return type.Uint64; }
    public visitFloat() { return type.Float; }
    public visitFloat16() { return type.Float16; }
    public visitFloat32() { return type.Float32; }
    public visitFloat64() { return type.Float64; }
    public visitUtf8() { return type.Utf8; }
    public visitLargeUtf8() { return type.LargeUtf8; }
    public visitBinary() { return type.Binary; }
    public visitLargeBinary() { return type.LargeBinary; }
    public visitFixedSizeBinary() { return type.FixedSizeBinary; }
    public visitDate() { return type.Date_; }
    public visitDateDay() { return type.DateDay; }
    public visitDateMillisecond() { return type.DateMillisecond; }
    public visitTimestamp() { return type.Timestamp; }
    public visitTimestampSecond() { return type.TimestampSecond; }
    public visitTimestampMillisecond() { return type.TimestampMillisecond; }
    public visitTimestampMicrosecond() { return type.TimestampMicrosecond; }
    public visitTimestampNanosecond() { return type.TimestampNanosecond; }
    public visitTime() { return type.Time; }
    public visitTimeSecond() { return type.TimeSecond; }
    public visitTimeMillisecond() { return type.TimeMillisecond; }
    public visitTimeMicrosecond() { return type.TimeMicrosecond; }
    public visitTimeNanosecond() { return type.TimeNanosecond; }
    public visitDecimal() { return type.Decimal; }
    public visitList() { return type.List; }
    public visitStruct() { return type.Struct; }
    public visitUnion() { return type.Union; }
    public visitDenseUnion() { return type.DenseUnion; }
    public visitSparseUnion() { return type.SparseUnion; }
    public visitDictionary() { return type.Dictionary; }
    public visitInterval() { return type.Interval; }
    public visitIntervalDayTime() { return type.IntervalDayTime; }
    public visitIntervalYearMonth() { return type.IntervalYearMonth; }
    public visitDuration() { return type.Duration; }
    public visitDurationSecond() { return type.DurationSecond; }
    public visitDurationMillisecond() { return type.DurationMillisecond; }
    public visitDurationMicrosecond() { return type.DurationMicrosecond; }
    public visitDurationNanosecond() { return type.DurationNanosecond; }
    public visitFixedSizeList() { return type.FixedSizeList; }
    public visitMap() { return type.Map_; }
}

/** @ignore */
export const instance = new GetDataTypeConstructor();
