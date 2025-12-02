"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.instance = exports.TypeAssembler = void 0;
const visitor_js_1 = require("../visitor.js");
const null_js_1 = require("../fb/null.js");
const int_js_1 = require("../fb/int.js");
const floating_point_js_1 = require("../fb/floating-point.js");
const binary_js_1 = require("../fb/binary.js");
const large_binary_js_1 = require("../fb/large-binary.js");
const bool_js_1 = require("../fb/bool.js");
const utf8_js_1 = require("../fb/utf8.js");
const large_utf8_js_1 = require("../fb/large-utf8.js");
const decimal_js_1 = require("../fb/decimal.js");
const date_js_1 = require("../fb/date.js");
const time_js_1 = require("../fb/time.js");
const timestamp_js_1 = require("../fb/timestamp.js");
const interval_js_1 = require("../fb/interval.js");
const duration_js_1 = require("../fb/duration.js");
const list_js_1 = require("../fb/list.js");
const struct__js_1 = require("../fb/struct-.js");
const union_js_1 = require("../fb/union.js");
const dictionary_encoding_js_1 = require("../fb/dictionary-encoding.js");
const fixed_size_binary_js_1 = require("../fb/fixed-size-binary.js");
const fixed_size_list_js_1 = require("../fb/fixed-size-list.js");
const map_js_1 = require("../fb/map.js");
/** @ignore */
class TypeAssembler extends visitor_js_1.Visitor {
    visit(node, builder) {
        return (node == null || builder == null) ? undefined : super.visit(node, builder);
    }
    visitNull(_node, b) {
        null_js_1.Null.startNull(b);
        return null_js_1.Null.endNull(b);
    }
    visitInt(node, b) {
        int_js_1.Int.startInt(b);
        int_js_1.Int.addBitWidth(b, node.bitWidth);
        int_js_1.Int.addIsSigned(b, node.isSigned);
        return int_js_1.Int.endInt(b);
    }
    visitFloat(node, b) {
        floating_point_js_1.FloatingPoint.startFloatingPoint(b);
        floating_point_js_1.FloatingPoint.addPrecision(b, node.precision);
        return floating_point_js_1.FloatingPoint.endFloatingPoint(b);
    }
    visitBinary(_node, b) {
        binary_js_1.Binary.startBinary(b);
        return binary_js_1.Binary.endBinary(b);
    }
    visitLargeBinary(_node, b) {
        large_binary_js_1.LargeBinary.startLargeBinary(b);
        return large_binary_js_1.LargeBinary.endLargeBinary(b);
    }
    visitBool(_node, b) {
        bool_js_1.Bool.startBool(b);
        return bool_js_1.Bool.endBool(b);
    }
    visitUtf8(_node, b) {
        utf8_js_1.Utf8.startUtf8(b);
        return utf8_js_1.Utf8.endUtf8(b);
    }
    visitLargeUtf8(_node, b) {
        large_utf8_js_1.LargeUtf8.startLargeUtf8(b);
        return large_utf8_js_1.LargeUtf8.endLargeUtf8(b);
    }
    visitDecimal(node, b) {
        decimal_js_1.Decimal.startDecimal(b);
        decimal_js_1.Decimal.addScale(b, node.scale);
        decimal_js_1.Decimal.addPrecision(b, node.precision);
        decimal_js_1.Decimal.addBitWidth(b, node.bitWidth);
        return decimal_js_1.Decimal.endDecimal(b);
    }
    visitDate(node, b) {
        date_js_1.Date.startDate(b);
        date_js_1.Date.addUnit(b, node.unit);
        return date_js_1.Date.endDate(b);
    }
    visitTime(node, b) {
        time_js_1.Time.startTime(b);
        time_js_1.Time.addUnit(b, node.unit);
        time_js_1.Time.addBitWidth(b, node.bitWidth);
        return time_js_1.Time.endTime(b);
    }
    visitTimestamp(node, b) {
        const timezone = (node.timezone && b.createString(node.timezone)) || undefined;
        timestamp_js_1.Timestamp.startTimestamp(b);
        timestamp_js_1.Timestamp.addUnit(b, node.unit);
        if (timezone !== undefined) {
            timestamp_js_1.Timestamp.addTimezone(b, timezone);
        }
        return timestamp_js_1.Timestamp.endTimestamp(b);
    }
    visitInterval(node, b) {
        interval_js_1.Interval.startInterval(b);
        interval_js_1.Interval.addUnit(b, node.unit);
        return interval_js_1.Interval.endInterval(b);
    }
    visitDuration(node, b) {
        duration_js_1.Duration.startDuration(b);
        duration_js_1.Duration.addUnit(b, node.unit);
        return duration_js_1.Duration.endDuration(b);
    }
    visitList(_node, b) {
        list_js_1.List.startList(b);
        return list_js_1.List.endList(b);
    }
    visitStruct(_node, b) {
        struct__js_1.Struct_.startStruct_(b);
        return struct__js_1.Struct_.endStruct_(b);
    }
    visitUnion(node, b) {
        union_js_1.Union.startTypeIdsVector(b, node.typeIds.length);
        const typeIds = union_js_1.Union.createTypeIdsVector(b, node.typeIds);
        union_js_1.Union.startUnion(b);
        union_js_1.Union.addMode(b, node.mode);
        union_js_1.Union.addTypeIds(b, typeIds);
        return union_js_1.Union.endUnion(b);
    }
    visitDictionary(node, b) {
        const indexType = this.visit(node.indices, b);
        dictionary_encoding_js_1.DictionaryEncoding.startDictionaryEncoding(b);
        dictionary_encoding_js_1.DictionaryEncoding.addId(b, BigInt(node.id));
        dictionary_encoding_js_1.DictionaryEncoding.addIsOrdered(b, node.isOrdered);
        if (indexType !== undefined) {
            dictionary_encoding_js_1.DictionaryEncoding.addIndexType(b, indexType);
        }
        return dictionary_encoding_js_1.DictionaryEncoding.endDictionaryEncoding(b);
    }
    visitFixedSizeBinary(node, b) {
        fixed_size_binary_js_1.FixedSizeBinary.startFixedSizeBinary(b);
        fixed_size_binary_js_1.FixedSizeBinary.addByteWidth(b, node.byteWidth);
        return fixed_size_binary_js_1.FixedSizeBinary.endFixedSizeBinary(b);
    }
    visitFixedSizeList(node, b) {
        fixed_size_list_js_1.FixedSizeList.startFixedSizeList(b);
        fixed_size_list_js_1.FixedSizeList.addListSize(b, node.listSize);
        return fixed_size_list_js_1.FixedSizeList.endFixedSizeList(b);
    }
    visitMap(node, b) {
        map_js_1.Map.startMap(b);
        map_js_1.Map.addKeysSorted(b, node.keysSorted);
        return map_js_1.Map.endMap(b);
    }
}
exports.TypeAssembler = TypeAssembler;
/** @ignore */
exports.instance = new TypeAssembler();

//# sourceMappingURL=typeassembler.js.map
