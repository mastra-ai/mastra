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
exports.instance = exports.GetBuilderCtor = void 0;
const visitor_js_1 = require("../visitor.js");
const binary_js_1 = require("../builder/binary.js");
const largebinary_js_1 = require("../builder/largebinary.js");
const bool_js_1 = require("../builder/bool.js");
const date_js_1 = require("../builder/date.js");
const decimal_js_1 = require("../builder/decimal.js");
const dictionary_js_1 = require("../builder/dictionary.js");
const fixedsizebinary_js_1 = require("../builder/fixedsizebinary.js");
const fixedsizelist_js_1 = require("../builder/fixedsizelist.js");
const float_js_1 = require("../builder/float.js");
const interval_js_1 = require("../builder/interval.js");
const duration_js_1 = require("../builder/duration.js");
const int_js_1 = require("../builder/int.js");
const list_js_1 = require("../builder/list.js");
const map_js_1 = require("../builder/map.js");
const null_js_1 = require("../builder/null.js");
const struct_js_1 = require("../builder/struct.js");
const timestamp_js_1 = require("../builder/timestamp.js");
const time_js_1 = require("../builder/time.js");
const union_js_1 = require("../builder/union.js");
const utf8_js_1 = require("../builder/utf8.js");
const largeutf8_js_1 = require("../builder/largeutf8.js");
/** @ignore */
class GetBuilderCtor extends visitor_js_1.Visitor {
    visitNull() { return null_js_1.NullBuilder; }
    visitBool() { return bool_js_1.BoolBuilder; }
    visitInt() { return int_js_1.IntBuilder; }
    visitInt8() { return int_js_1.Int8Builder; }
    visitInt16() { return int_js_1.Int16Builder; }
    visitInt32() { return int_js_1.Int32Builder; }
    visitInt64() { return int_js_1.Int64Builder; }
    visitUint8() { return int_js_1.Uint8Builder; }
    visitUint16() { return int_js_1.Uint16Builder; }
    visitUint32() { return int_js_1.Uint32Builder; }
    visitUint64() { return int_js_1.Uint64Builder; }
    visitFloat() { return float_js_1.FloatBuilder; }
    visitFloat16() { return float_js_1.Float16Builder; }
    visitFloat32() { return float_js_1.Float32Builder; }
    visitFloat64() { return float_js_1.Float64Builder; }
    visitUtf8() { return utf8_js_1.Utf8Builder; }
    visitLargeUtf8() { return largeutf8_js_1.LargeUtf8Builder; }
    visitBinary() { return binary_js_1.BinaryBuilder; }
    visitLargeBinary() { return largebinary_js_1.LargeBinaryBuilder; }
    visitFixedSizeBinary() { return fixedsizebinary_js_1.FixedSizeBinaryBuilder; }
    visitDate() { return date_js_1.DateBuilder; }
    visitDateDay() { return date_js_1.DateDayBuilder; }
    visitDateMillisecond() { return date_js_1.DateMillisecondBuilder; }
    visitTimestamp() { return timestamp_js_1.TimestampBuilder; }
    visitTimestampSecond() { return timestamp_js_1.TimestampSecondBuilder; }
    visitTimestampMillisecond() { return timestamp_js_1.TimestampMillisecondBuilder; }
    visitTimestampMicrosecond() { return timestamp_js_1.TimestampMicrosecondBuilder; }
    visitTimestampNanosecond() { return timestamp_js_1.TimestampNanosecondBuilder; }
    visitTime() { return time_js_1.TimeBuilder; }
    visitTimeSecond() { return time_js_1.TimeSecondBuilder; }
    visitTimeMillisecond() { return time_js_1.TimeMillisecondBuilder; }
    visitTimeMicrosecond() { return time_js_1.TimeMicrosecondBuilder; }
    visitTimeNanosecond() { return time_js_1.TimeNanosecondBuilder; }
    visitDecimal() { return decimal_js_1.DecimalBuilder; }
    visitList() { return list_js_1.ListBuilder; }
    visitStruct() { return struct_js_1.StructBuilder; }
    visitUnion() { return union_js_1.UnionBuilder; }
    visitDenseUnion() { return union_js_1.DenseUnionBuilder; }
    visitSparseUnion() { return union_js_1.SparseUnionBuilder; }
    visitDictionary() { return dictionary_js_1.DictionaryBuilder; }
    visitInterval() { return interval_js_1.IntervalBuilder; }
    visitIntervalDayTime() { return interval_js_1.IntervalDayTimeBuilder; }
    visitIntervalYearMonth() { return interval_js_1.IntervalYearMonthBuilder; }
    visitDuration() { return duration_js_1.DurationBuilder; }
    visitDurationSecond() { return duration_js_1.DurationSecondBuilder; }
    visitDurationMillisecond() { return duration_js_1.DurationMillisecondBuilder; }
    visitDurationMicrosecond() { return duration_js_1.DurationMicrosecondBuilder; }
    visitDurationNanosecond() { return duration_js_1.DurationNanosecondBuilder; }
    visitFixedSizeList() { return fixedsizelist_js_1.FixedSizeListBuilder; }
    visitMap() { return map_js_1.MapBuilder; }
}
exports.GetBuilderCtor = GetBuilderCtor;
/** @ignore */
exports.instance = new GetBuilderCtor();

//# sourceMappingURL=builderctor.js.map
