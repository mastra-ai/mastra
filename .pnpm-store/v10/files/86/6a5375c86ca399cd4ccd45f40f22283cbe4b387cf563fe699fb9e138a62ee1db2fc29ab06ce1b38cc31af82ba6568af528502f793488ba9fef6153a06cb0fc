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
import { Visitor } from '../visitor.mjs';
import { Null } from '../fb/null.mjs';
import { Int } from '../fb/int.mjs';
import { FloatingPoint } from '../fb/floating-point.mjs';
import { Binary } from '../fb/binary.mjs';
import { LargeBinary } from '../fb/large-binary.mjs';
import { Bool } from '../fb/bool.mjs';
import { Utf8 } from '../fb/utf8.mjs';
import { LargeUtf8 } from '../fb/large-utf8.mjs';
import { Decimal } from '../fb/decimal.mjs';
import { Date } from '../fb/date.mjs';
import { Time } from '../fb/time.mjs';
import { Timestamp } from '../fb/timestamp.mjs';
import { Interval } from '../fb/interval.mjs';
import { Duration } from '../fb/duration.mjs';
import { List } from '../fb/list.mjs';
import { Struct_ as Struct } from '../fb/struct-.mjs';
import { Union } from '../fb/union.mjs';
import { DictionaryEncoding } from '../fb/dictionary-encoding.mjs';
import { FixedSizeBinary } from '../fb/fixed-size-binary.mjs';
import { FixedSizeList } from '../fb/fixed-size-list.mjs';
import { Map as Map_ } from '../fb/map.mjs';
/** @ignore */
export class TypeAssembler extends Visitor {
    visit(node, builder) {
        return (node == null || builder == null) ? undefined : super.visit(node, builder);
    }
    visitNull(_node, b) {
        Null.startNull(b);
        return Null.endNull(b);
    }
    visitInt(node, b) {
        Int.startInt(b);
        Int.addBitWidth(b, node.bitWidth);
        Int.addIsSigned(b, node.isSigned);
        return Int.endInt(b);
    }
    visitFloat(node, b) {
        FloatingPoint.startFloatingPoint(b);
        FloatingPoint.addPrecision(b, node.precision);
        return FloatingPoint.endFloatingPoint(b);
    }
    visitBinary(_node, b) {
        Binary.startBinary(b);
        return Binary.endBinary(b);
    }
    visitLargeBinary(_node, b) {
        LargeBinary.startLargeBinary(b);
        return LargeBinary.endLargeBinary(b);
    }
    visitBool(_node, b) {
        Bool.startBool(b);
        return Bool.endBool(b);
    }
    visitUtf8(_node, b) {
        Utf8.startUtf8(b);
        return Utf8.endUtf8(b);
    }
    visitLargeUtf8(_node, b) {
        LargeUtf8.startLargeUtf8(b);
        return LargeUtf8.endLargeUtf8(b);
    }
    visitDecimal(node, b) {
        Decimal.startDecimal(b);
        Decimal.addScale(b, node.scale);
        Decimal.addPrecision(b, node.precision);
        Decimal.addBitWidth(b, node.bitWidth);
        return Decimal.endDecimal(b);
    }
    visitDate(node, b) {
        Date.startDate(b);
        Date.addUnit(b, node.unit);
        return Date.endDate(b);
    }
    visitTime(node, b) {
        Time.startTime(b);
        Time.addUnit(b, node.unit);
        Time.addBitWidth(b, node.bitWidth);
        return Time.endTime(b);
    }
    visitTimestamp(node, b) {
        const timezone = (node.timezone && b.createString(node.timezone)) || undefined;
        Timestamp.startTimestamp(b);
        Timestamp.addUnit(b, node.unit);
        if (timezone !== undefined) {
            Timestamp.addTimezone(b, timezone);
        }
        return Timestamp.endTimestamp(b);
    }
    visitInterval(node, b) {
        Interval.startInterval(b);
        Interval.addUnit(b, node.unit);
        return Interval.endInterval(b);
    }
    visitDuration(node, b) {
        Duration.startDuration(b);
        Duration.addUnit(b, node.unit);
        return Duration.endDuration(b);
    }
    visitList(_node, b) {
        List.startList(b);
        return List.endList(b);
    }
    visitStruct(_node, b) {
        Struct.startStruct_(b);
        return Struct.endStruct_(b);
    }
    visitUnion(node, b) {
        Union.startTypeIdsVector(b, node.typeIds.length);
        const typeIds = Union.createTypeIdsVector(b, node.typeIds);
        Union.startUnion(b);
        Union.addMode(b, node.mode);
        Union.addTypeIds(b, typeIds);
        return Union.endUnion(b);
    }
    visitDictionary(node, b) {
        const indexType = this.visit(node.indices, b);
        DictionaryEncoding.startDictionaryEncoding(b);
        DictionaryEncoding.addId(b, BigInt(node.id));
        DictionaryEncoding.addIsOrdered(b, node.isOrdered);
        if (indexType !== undefined) {
            DictionaryEncoding.addIndexType(b, indexType);
        }
        return DictionaryEncoding.endDictionaryEncoding(b);
    }
    visitFixedSizeBinary(node, b) {
        FixedSizeBinary.startFixedSizeBinary(b);
        FixedSizeBinary.addByteWidth(b, node.byteWidth);
        return FixedSizeBinary.endFixedSizeBinary(b);
    }
    visitFixedSizeList(node, b) {
        FixedSizeList.startFixedSizeList(b);
        FixedSizeList.addListSize(b, node.listSize);
        return FixedSizeList.endFixedSizeList(b);
    }
    visitMap(node, b) {
        Map_.startMap(b);
        Map_.addKeysSorted(b, node.keysSorted);
        return Map_.endMap(b);
    }
}
/** @ignore */
export const instance = new TypeAssembler();

//# sourceMappingURL=typeassembler.mjs.map
