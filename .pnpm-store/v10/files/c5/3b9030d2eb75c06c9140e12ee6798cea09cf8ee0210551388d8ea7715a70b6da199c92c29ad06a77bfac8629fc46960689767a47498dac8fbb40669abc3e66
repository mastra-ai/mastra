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

import * as flatbuffers from 'flatbuffers';
import Builder = flatbuffers.Builder;

import * as type from '../type.js';
import { Visitor } from '../visitor.js';

import { Null } from '../fb/null.js';
import { Int } from '../fb/int.js';
import { FloatingPoint } from '../fb/floating-point.js';
import { Binary } from '../fb/binary.js';
import { LargeBinary } from '../fb/large-binary.js';
import { Bool } from '../fb/bool.js';
import { Utf8 } from '../fb/utf8.js';
import { LargeUtf8 } from '../fb/large-utf8.js';
import { Decimal } from '../fb/decimal.js';
import { Date } from '../fb/date.js';
import { Time } from '../fb/time.js';
import { Timestamp } from '../fb/timestamp.js';
import { Interval } from '../fb/interval.js';
import { Duration } from '../fb/duration.js';
import { List } from '../fb/list.js';
import { Struct_ as Struct } from '../fb/struct-.js';
import { Union } from '../fb/union.js';
import { DictionaryEncoding } from '../fb/dictionary-encoding.js';
import { FixedSizeBinary } from '../fb/fixed-size-binary.js';
import { FixedSizeList } from '../fb/fixed-size-list.js';
import { Map as Map_ } from '../fb/map.js';

/** @ignore */
export interface TypeAssembler extends Visitor {
    visit<T extends type.DataType>(node: T, builder: Builder): number | undefined;
}

/** @ignore */
export class TypeAssembler extends Visitor {
    public visit<T extends type.DataType>(node: T, builder: Builder): number | undefined {
        return (node == null || builder == null) ? undefined : super.visit(node, builder);
    }
    public visitNull<T extends type.Null>(_node: T, b: Builder) {
        Null.startNull(b);
        return Null.endNull(b);
    }
    public visitInt<T extends type.Int>(node: T, b: Builder) {
        Int.startInt(b);
        Int.addBitWidth(b, node.bitWidth);
        Int.addIsSigned(b, node.isSigned);
        return Int.endInt(b);
    }
    public visitFloat<T extends type.Float>(node: T, b: Builder) {
        FloatingPoint.startFloatingPoint(b);
        FloatingPoint.addPrecision(b, node.precision);
        return FloatingPoint.endFloatingPoint(b);
    }
    public visitBinary<T extends type.Binary>(_node: T, b: Builder) {
        Binary.startBinary(b);
        return Binary.endBinary(b);
    }
    public visitLargeBinary<T extends type.LargeBinary>(_node: T, b: Builder) {
        LargeBinary.startLargeBinary(b);
        return LargeBinary.endLargeBinary(b);
    }
    public visitBool<T extends type.Bool>(_node: T, b: Builder) {
        Bool.startBool(b);
        return Bool.endBool(b);
    }
    public visitUtf8<T extends type.Utf8>(_node: T, b: Builder) {
        Utf8.startUtf8(b);
        return Utf8.endUtf8(b);
    }
    public visitLargeUtf8<T extends type.LargeUtf8>(_node: T, b: Builder) {
        LargeUtf8.startLargeUtf8(b);
        return LargeUtf8.endLargeUtf8(b);
    }
    public visitDecimal<T extends type.Decimal>(node: T, b: Builder) {
        Decimal.startDecimal(b);
        Decimal.addScale(b, node.scale);
        Decimal.addPrecision(b, node.precision);
        Decimal.addBitWidth(b, node.bitWidth);
        return Decimal.endDecimal(b);
    }
    public visitDate<T extends type.Date_>(node: T, b: Builder) {
        Date.startDate(b);
        Date.addUnit(b, node.unit);
        return Date.endDate(b);
    }
    public visitTime<T extends type.Time>(node: T, b: Builder) {
        Time.startTime(b);
        Time.addUnit(b, node.unit);
        Time.addBitWidth(b, node.bitWidth);
        return Time.endTime(b);
    }
    public visitTimestamp<T extends type.Timestamp>(node: T, b: Builder) {
        const timezone = (node.timezone && b.createString(node.timezone)) || undefined;
        Timestamp.startTimestamp(b);
        Timestamp.addUnit(b, node.unit);
        if (timezone !== undefined) {
            Timestamp.addTimezone(b, timezone);
        }
        return Timestamp.endTimestamp(b);
    }
    public visitInterval<T extends type.Interval>(node: T, b: Builder) {
        Interval.startInterval(b);
        Interval.addUnit(b, node.unit);
        return Interval.endInterval(b);
    }
    public visitDuration<T extends type.Duration>(node: T, b: Builder) {
        Duration.startDuration(b);
        Duration.addUnit(b, node.unit);
        return Duration.endDuration(b);
    }
    public visitList<T extends type.List>(_node: T, b: Builder) {
        List.startList(b);
        return List.endList(b);
    }
    public visitStruct<T extends type.Struct>(_node: T, b: Builder) {
        Struct.startStruct_(b);
        return Struct.endStruct_(b);
    }
    public visitUnion<T extends type.Union>(node: T, b: Builder) {
        Union.startTypeIdsVector(b, node.typeIds.length);
        const typeIds = Union.createTypeIdsVector(b, node.typeIds);
        Union.startUnion(b);
        Union.addMode(b, node.mode);
        Union.addTypeIds(b, typeIds);
        return Union.endUnion(b);
    }
    public visitDictionary<T extends type.Dictionary>(node: T, b: Builder) {
        const indexType = this.visit(node.indices, b);
        DictionaryEncoding.startDictionaryEncoding(b);
        DictionaryEncoding.addId(b, BigInt(node.id));
        DictionaryEncoding.addIsOrdered(b, node.isOrdered);
        if (indexType !== undefined) {
            DictionaryEncoding.addIndexType(b, indexType);
        }
        return DictionaryEncoding.endDictionaryEncoding(b);
    }
    public visitFixedSizeBinary<T extends type.FixedSizeBinary>(node: T, b: Builder) {
        FixedSizeBinary.startFixedSizeBinary(b);
        FixedSizeBinary.addByteWidth(b, node.byteWidth);
        return FixedSizeBinary.endFixedSizeBinary(b);
    }
    public visitFixedSizeList<T extends type.FixedSizeList>(node: T, b: Builder) {
        FixedSizeList.startFixedSizeList(b);
        FixedSizeList.addListSize(b, node.listSize);
        return FixedSizeList.endFixedSizeList(b);
    }
    public visitMap<T extends type.Map_>(node: T, b: Builder) {
        Map_.startMap(b);
        Map_.addKeysSorted(b, node.keysSorted);
        return Map_.endMap(b);
    }
}

/** @ignore */
export const instance = new TypeAssembler();
