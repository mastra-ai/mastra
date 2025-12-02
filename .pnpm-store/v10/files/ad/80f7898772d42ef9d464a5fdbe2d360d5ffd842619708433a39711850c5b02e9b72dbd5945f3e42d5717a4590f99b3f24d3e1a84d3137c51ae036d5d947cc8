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

import { Type, Precision, DateUnit, TimeUnit, IntervalUnit, UnionMode } from './enum.js';
import { DataType, Float, Int, Date_, Interval, Time, Timestamp, Union, Duration } from './type.js';

export abstract class Visitor {
    public visitMany(nodes: any[], ...args: any[][]) {
        return nodes.map((node, i) => this.visit(node, ...args.map((x) => x[i])));
    }
    public visit(...args: any[]) {
        return this.getVisitFn(args[0], false).apply(this, args);
    }
    public getVisitFn(node: any, throwIfNotFound = true) {
        return getVisitFn(this, node, throwIfNotFound);
    }
    public getVisitFnByTypeId(typeId: Type, throwIfNotFound = true) {
        return getVisitFnByTypeId(this, typeId, throwIfNotFound);
    }
    public visitNull(_node: any, ..._args: any[]): any { return null; }
    public visitBool(_node: any, ..._args: any[]): any { return null; }
    public visitInt(_node: any, ..._args: any[]): any { return null; }
    public visitFloat(_node: any, ..._args: any[]): any { return null; }
    public visitUtf8(_node: any, ..._args: any[]): any { return null; }
    public visitLargeUtf8(_node: any, ..._args: any[]): any { return null; }
    public visitBinary(_node: any, ..._args: any[]): any { return null; }
    public visitLargeBinary(_node: any, ..._args: any[]): any { return null; }
    public visitFixedSizeBinary(_node: any, ..._args: any[]): any { return null; }
    public visitDate(_node: any, ..._args: any[]): any { return null; }
    public visitTimestamp(_node: any, ..._args: any[]): any { return null; }
    public visitTime(_node: any, ..._args: any[]): any { return null; }
    public visitDecimal(_node: any, ..._args: any[]): any { return null; }
    public visitList(_node: any, ..._args: any[]): any { return null; }
    public visitStruct(_node: any, ..._args: any[]): any { return null; }
    public visitUnion(_node: any, ..._args: any[]): any { return null; }
    public visitDictionary(_node: any, ..._args: any[]): any { return null; }
    public visitInterval(_node: any, ..._args: any[]): any { return null; }
    public visitDuration(_node: any, ..._args: any[]): any { return null; }
    public visitFixedSizeList(_node: any, ..._args: any[]): any { return null; }
    public visitMap(_node: any, ..._args: any[]): any { return null; }
}

/** @ignore */
function getVisitFn<T extends DataType>(visitor: Visitor, node: any, throwIfNotFound = true) {
    if (typeof node === 'number') {
        return getVisitFnByTypeId(visitor, node, throwIfNotFound);
    }
    if (typeof node === 'string' && (node in Type)) {
        return getVisitFnByTypeId(visitor, Type[node as keyof typeof Type], throwIfNotFound);
    }
    if (node && (node instanceof DataType)) {
        return getVisitFnByTypeId(visitor, inferDType(node as T), throwIfNotFound);
    }
    if (node?.type && (node.type instanceof DataType)) {
        return getVisitFnByTypeId(visitor, inferDType(node.type as T), throwIfNotFound);
    }
    return getVisitFnByTypeId(visitor, Type.NONE, throwIfNotFound);
}

/** @ignore */
function getVisitFnByTypeId(visitor: Visitor, dtype: Type, throwIfNotFound = true) {
    let fn: any = null;
    switch (dtype) {
        case Type.Null: fn = visitor.visitNull; break;
        case Type.Bool: fn = visitor.visitBool; break;
        case Type.Int: fn = visitor.visitInt; break;
        case Type.Int8: fn = visitor.visitInt8 || visitor.visitInt; break;
        case Type.Int16: fn = visitor.visitInt16 || visitor.visitInt; break;
        case Type.Int32: fn = visitor.visitInt32 || visitor.visitInt; break;
        case Type.Int64: fn = visitor.visitInt64 || visitor.visitInt; break;
        case Type.Uint8: fn = visitor.visitUint8 || visitor.visitInt; break;
        case Type.Uint16: fn = visitor.visitUint16 || visitor.visitInt; break;
        case Type.Uint32: fn = visitor.visitUint32 || visitor.visitInt; break;
        case Type.Uint64: fn = visitor.visitUint64 || visitor.visitInt; break;
        case Type.Float: fn = visitor.visitFloat; break;
        case Type.Float16: fn = visitor.visitFloat16 || visitor.visitFloat; break;
        case Type.Float32: fn = visitor.visitFloat32 || visitor.visitFloat; break;
        case Type.Float64: fn = visitor.visitFloat64 || visitor.visitFloat; break;
        case Type.Utf8: fn = visitor.visitUtf8; break;
        case Type.LargeUtf8: fn = visitor.visitLargeUtf8; break;
        case Type.Binary: fn = visitor.visitBinary; break;
        case Type.LargeBinary: fn = visitor.visitLargeBinary; break;
        case Type.FixedSizeBinary: fn = visitor.visitFixedSizeBinary; break;
        case Type.Date: fn = visitor.visitDate; break;
        case Type.DateDay: fn = visitor.visitDateDay || visitor.visitDate; break;
        case Type.DateMillisecond: fn = visitor.visitDateMillisecond || visitor.visitDate; break;
        case Type.Timestamp: fn = visitor.visitTimestamp; break;
        case Type.TimestampSecond: fn = visitor.visitTimestampSecond || visitor.visitTimestamp; break;
        case Type.TimestampMillisecond: fn = visitor.visitTimestampMillisecond || visitor.visitTimestamp; break;
        case Type.TimestampMicrosecond: fn = visitor.visitTimestampMicrosecond || visitor.visitTimestamp; break;
        case Type.TimestampNanosecond: fn = visitor.visitTimestampNanosecond || visitor.visitTimestamp; break;
        case Type.Time: fn = visitor.visitTime; break;
        case Type.TimeSecond: fn = visitor.visitTimeSecond || visitor.visitTime; break;
        case Type.TimeMillisecond: fn = visitor.visitTimeMillisecond || visitor.visitTime; break;
        case Type.TimeMicrosecond: fn = visitor.visitTimeMicrosecond || visitor.visitTime; break;
        case Type.TimeNanosecond: fn = visitor.visitTimeNanosecond || visitor.visitTime; break;
        case Type.Decimal: fn = visitor.visitDecimal; break;
        case Type.List: fn = visitor.visitList; break;
        case Type.Struct: fn = visitor.visitStruct; break;
        case Type.Union: fn = visitor.visitUnion; break;
        case Type.DenseUnion: fn = visitor.visitDenseUnion || visitor.visitUnion; break;
        case Type.SparseUnion: fn = visitor.visitSparseUnion || visitor.visitUnion; break;
        case Type.Dictionary: fn = visitor.visitDictionary; break;
        case Type.Interval: fn = visitor.visitInterval; break;
        case Type.IntervalDayTime: fn = visitor.visitIntervalDayTime || visitor.visitInterval; break;
        case Type.IntervalYearMonth: fn = visitor.visitIntervalYearMonth || visitor.visitInterval; break;
        case Type.Duration: fn = visitor.visitDuration; break;
        case Type.DurationSecond: fn = visitor.visitDurationSecond || visitor.visitDuration; break;
        case Type.DurationMillisecond: fn = visitor.visitDurationMillisecond || visitor.visitDuration; break;
        case Type.DurationMicrosecond: fn = visitor.visitDurationMicrosecond || visitor.visitDuration; break;
        case Type.DurationNanosecond: fn = visitor.visitDurationNanosecond || visitor.visitDuration; break;
        case Type.FixedSizeList: fn = visitor.visitFixedSizeList; break;
        case Type.Map: fn = visitor.visitMap; break;
    }
    if (typeof fn === 'function') return fn;
    if (!throwIfNotFound) return () => null;
    throw new Error(`Unrecognized type '${Type[dtype]}'`);
}

/** @ignore */
function inferDType<T extends DataType>(type: T): Type {
    switch (type.typeId) {
        case Type.Null: return Type.Null;
        case Type.Int: {
            const { bitWidth, isSigned } = (type as any as Int);
            switch (bitWidth) {
                case 8: return isSigned ? Type.Int8 : Type.Uint8;
                case 16: return isSigned ? Type.Int16 : Type.Uint16;
                case 32: return isSigned ? Type.Int32 : Type.Uint32;
                case 64: return isSigned ? Type.Int64 : Type.Uint64;
            }
            // @ts-ignore
            return Type.Int;
        }
        case Type.Float:
            switch ((type as any as Float).precision) {
                case Precision.HALF: return Type.Float16;
                case Precision.SINGLE: return Type.Float32;
                case Precision.DOUBLE: return Type.Float64;
            }
            // @ts-ignore
            return Type.Float;
        case Type.Binary: return Type.Binary;
        case Type.LargeBinary: return Type.LargeBinary;
        case Type.Utf8: return Type.Utf8;
        case Type.LargeUtf8: return Type.LargeUtf8;
        case Type.Bool: return Type.Bool;
        case Type.Decimal: return Type.Decimal;
        case Type.Time:
            switch ((type as any as Time).unit) {
                case TimeUnit.SECOND: return Type.TimeSecond;
                case TimeUnit.MILLISECOND: return Type.TimeMillisecond;
                case TimeUnit.MICROSECOND: return Type.TimeMicrosecond;
                case TimeUnit.NANOSECOND: return Type.TimeNanosecond;
            }
            // @ts-ignore
            return Type.Time;
        case Type.Timestamp:
            switch ((type as any as Timestamp).unit) {
                case TimeUnit.SECOND: return Type.TimestampSecond;
                case TimeUnit.MILLISECOND: return Type.TimestampMillisecond;
                case TimeUnit.MICROSECOND: return Type.TimestampMicrosecond;
                case TimeUnit.NANOSECOND: return Type.TimestampNanosecond;
            }
            // @ts-ignore
            return Type.Timestamp;
        case Type.Date:
            switch ((type as any as Date_).unit) {
                case DateUnit.DAY: return Type.DateDay;
                case DateUnit.MILLISECOND: return Type.DateMillisecond;
            }
            // @ts-ignore
            return Type.Date;
        case Type.Interval:
            switch ((type as any as Interval).unit) {
                case IntervalUnit.DAY_TIME: return Type.IntervalDayTime;
                case IntervalUnit.YEAR_MONTH: return Type.IntervalYearMonth;
            }
            // @ts-ignore
            return Type.Interval;
        case Type.Duration:
            switch ((type as any as Duration).unit) {
                case TimeUnit.SECOND: return Type.DurationSecond;
                case TimeUnit.MILLISECOND: return Type.DurationMillisecond;
                case TimeUnit.MICROSECOND: return Type.DurationMicrosecond;
                case TimeUnit.NANOSECOND: return Type.DurationNanosecond;
            }
            // @ts-ignore
            return Type.Duration;
        case Type.Map: return Type.Map;
        case Type.List: return Type.List;
        case Type.Struct: return Type.Struct;
        case Type.Union:
            switch ((type as any as Union).mode) {
                case UnionMode.Dense: return Type.DenseUnion;
                case UnionMode.Sparse: return Type.SparseUnion;
            }
            // @ts-ignore
            return Type.Union;
        case Type.FixedSizeBinary: return Type.FixedSizeBinary;
        case Type.FixedSizeList: return Type.FixedSizeList;
        case Type.Dictionary: return Type.Dictionary;
    }
    throw new Error(`Unrecognized type '${Type[type.typeId]}'`);
}

export interface Visitor {
    visitNull(node: any, ...args: any[]): any;
    visitBool(node: any, ...args: any[]): any;
    visitInt(node: any, ...args: any[]): any;
    visitInt8?(node: any, ...args: any[]): any;
    visitInt16?(node: any, ...args: any[]): any;
    visitInt32?(node: any, ...args: any[]): any;
    visitInt64?(node: any, ...args: any[]): any;
    visitUint8?(node: any, ...args: any[]): any;
    visitUint16?(node: any, ...args: any[]): any;
    visitUint32?(node: any, ...args: any[]): any;
    visitUint64?(node: any, ...args: any[]): any;
    visitFloat(node: any, ...args: any[]): any;
    visitFloat16?(node: any, ...args: any[]): any;
    visitFloat32?(node: any, ...args: any[]): any;
    visitFloat64?(node: any, ...args: any[]): any;
    visitUtf8(node: any, ...args: any[]): any;
    visitLargeUtf8(node: any, ...args: any[]): any;
    visitBinary(node: any, ...args: any[]): any;
    visitLargeBinary(node: any, ...args: any[]): any;
    visitFixedSizeBinary(node: any, ...args: any[]): any;
    visitDate(node: any, ...args: any[]): any;
    visitDateDay?(node: any, ...args: any[]): any;
    visitDateMillisecond?(node: any, ...args: any[]): any;
    visitTimestamp(node: any, ...args: any[]): any;
    visitTimestampSecond?(node: any, ...args: any[]): any;
    visitTimestampMillisecond?(node: any, ...args: any[]): any;
    visitTimestampMicrosecond?(node: any, ...args: any[]): any;
    visitTimestampNanosecond?(node: any, ...args: any[]): any;
    visitTime(node: any, ...args: any[]): any;
    visitTimeSecond?(node: any, ...args: any[]): any;
    visitTimeMillisecond?(node: any, ...args: any[]): any;
    visitTimeMicrosecond?(node: any, ...args: any[]): any;
    visitTimeNanosecond?(node: any, ...args: any[]): any;
    visitDecimal(node: any, ...args: any[]): any;
    visitList(node: any, ...args: any[]): any;
    visitStruct(node: any, ...args: any[]): any;
    visitUnion(node: any, ...args: any[]): any;
    visitDenseUnion?(node: any, ...args: any[]): any;
    visitSparseUnion?(node: any, ...args: any[]): any;
    visitDictionary(node: any, ...args: any[]): any;
    visitInterval(node: any, ...args: any[]): any;
    visitIntervalDayTime?(node: any, ...args: any[]): any;
    visitIntervalYearMonth?(node: any, ...args: any[]): any;
    visitDuration(node: any, ...args: any[]): any;
    visitDurationSecond(node: any, ...args: any[]): any;
    visitDurationMillisecond(node: any, ...args: any[]): any;
    visitDurationMicrosecond(node: any, ...args: any[]): any;
    visitDurationNanosecond(node: any, ...args: any[]): any;
    visitFixedSizeList(node: any, ...args: any[]): any;
    visitMap(node: any, ...args: any[]): any;
}

// Add these here so they're picked up by the externs creator
// in the build, and closure-compiler doesn't minify them away
(Visitor.prototype as any).visitInt8 = null;
(Visitor.prototype as any).visitInt16 = null;
(Visitor.prototype as any).visitInt32 = null;
(Visitor.prototype as any).visitInt64 = null;
(Visitor.prototype as any).visitUint8 = null;
(Visitor.prototype as any).visitUint16 = null;
(Visitor.prototype as any).visitUint32 = null;
(Visitor.prototype as any).visitUint64 = null;
(Visitor.prototype as any).visitFloat16 = null;
(Visitor.prototype as any).visitFloat32 = null;
(Visitor.prototype as any).visitFloat64 = null;
(Visitor.prototype as any).visitDateDay = null;
(Visitor.prototype as any).visitDateMillisecond = null;
(Visitor.prototype as any).visitTimestampSecond = null;
(Visitor.prototype as any).visitTimestampMillisecond = null;
(Visitor.prototype as any).visitTimestampMicrosecond = null;
(Visitor.prototype as any).visitTimestampNanosecond = null;
(Visitor.prototype as any).visitTimeSecond = null;
(Visitor.prototype as any).visitTimeMillisecond = null;
(Visitor.prototype as any).visitTimeMicrosecond = null;
(Visitor.prototype as any).visitTimeNanosecond = null;
(Visitor.prototype as any).visitDenseUnion = null;
(Visitor.prototype as any).visitSparseUnion = null;
(Visitor.prototype as any).visitIntervalDayTime = null;
(Visitor.prototype as any).visitIntervalYearMonth = null;
(Visitor.prototype as any).visitDuration = null;
(Visitor.prototype as any).visitDurationSecond = null;
(Visitor.prototype as any).visitDurationMillisecond = null;
(Visitor.prototype as any).visitDurationMicrosecond = null;
(Visitor.prototype as any).visitDurationNanosecond = null;
